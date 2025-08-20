// services/syncService.js
const mongoose = require('mongoose');
const { MongoClient, ObjectId } = require('mongodb');
const dns = require('dns');

const Outbox = require('../models/Outbox');
const Counter = require('../models/Counter');
const Ticket = require('../models/Ticket');

// Modelos usados para reconstruir la transacción compuesta
const Cliente = require('../models/Cliente');
const Vehiculo = require('../models/Vehiculo');
const Abono = require('../models/Abono');
const Movimiento = require('../models/Movimiento');
let MovimientoCliente; // se carga lazy por si el proyecto no lo tiene en todos los despliegues

let remoteClient = null;
let syncing = false;
let SELECTED_REMOTE_DBNAME = null; // nombre de DB remota elegido

// Estado público para monitorizar
const status = {
  lastRun: null,
  lastError: null,
  online: false,
  pendingOutbox: 0,
  lastPullCounts: {},
};

// --------------------- utilidades generales ---------------------

function is24Hex(s) {
  return typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(s);
}

// Extrae un array de 12 bytes desde formas raras (Buffer/Uint8Array/objetos serializados)
function bytesFromAny(x) {
  try {
    if (!x) return null;

    // Array directo
    if (Array.isArray(x) && x.length === 12 && x.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
      return Uint8Array.from(x);
    }

    // { type: 'Buffer', data: [ ... ] }  o  { data:[ ... ] }
    if (typeof x === 'object') {
      if (Array.isArray(x.data) && x.data.length === 12) {
        return Uint8Array.from(x.data);
      }
      if (x.type === 'Buffer' && Array.isArray(x.data) && x.data.length === 12) {
        return Uint8Array.from(x.data);
      }

      // { $binary: { base64: '...' } }
      if (x.$binary && typeof x.$binary.base64 === 'string') {
        const buf = Buffer.from(x.$binary.base64, 'base64');
        if (buf.length === 12) return new Uint8Array(buf);
      }

      // { buffer: { '0':..., '11':... } } (caso que viste)
      if (x.buffer && typeof x.buffer === 'object') {
        const keys = Object.keys(x.buffer).filter(k => /^\d+$/.test(k)).sort((a,b)=>Number(a)-Number(b));
        if (keys.length === 12) {
          const arr = keys.map(k => Number(x.buffer[k]));
          if (arr.every(n => Number.isFinite(n))) return Uint8Array.from(arr);
        }
      }

      // El propio objeto tiene keys '0'..'11'
      const directKeys = Object.keys(x).filter(k => /^\d+$/.test(k)).sort((a,b)=>Number(a)-Number(b));
      if (directKeys.length === 12) {
        const arr = directKeys.map(k => Number(x[k]));
        if (arr.every(n => Number.isFinite(n))) return Uint8Array.from(arr);
      }

      // {_bsontype:'ObjectId', id:{...}}
      if (x._bsontype === 'ObjectId' && x.id) {
        return bytesFromAny(x.id);
      }

      // { id:{ ...buffer/data... } }
      if (x.id) {
        return bytesFromAny(x.id);
      }
    }
  } catch {}
  return null;
}

function hexFromAny(o) {
  try {
    if (!o) return null;
    if (typeof o === 'string') {
      const s = o.trim();
      if (is24Hex(s)) return s;
    }
    if (typeof o === 'object') {
      if (is24Hex(o.$oid)) return o.$oid;
      if (is24Hex(o.oid)) return o.oid;
      if (is24Hex(o._id)) return o._id;
      if (is24Hex(o.id)) return o.id;
      // bytes
      const by = bytesFromAny(o);
      if (by && by.length === 12) {
        return Buffer.from(by).toString('hex');
      }
    }
  } catch {}
  return null;
}

function safeObjectId(id) {
  try {
    if (!id) return null;
    if (id instanceof ObjectId) return id;

    // si viene en alguna forma reconocible → hex
    const hx = hexFromAny(id);
    if (is24Hex(hx)) return new ObjectId(hx);

    // último intento: string directo
    const s = String(id);
    if (is24Hex(s)) return new ObjectId(s);

    // si no pude castear, devuelvo tal cual (para que el caller decida)
    return id;
  } catch {
    return id;
  }
}

function toObjectIdMaybe(v) {
  const casted = safeObjectId(v);
  return casted instanceof ObjectId ? casted : v;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}
function removeNulls(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeNulls);
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') {
      const r = removeNulls(v);
      if (r !== undefined && (typeof r !== 'object' || Object.keys(r).length)) out[k] = r;
    } else out[k] = v;
  }
  return out;
}

// Forzado de ObjectIds por colección
const REF_BY_COLL = {
  vehiculos: ['cliente', 'abono'],
  abonos: ['cliente', 'vehiculo'],
  movimientos: ['cliente', 'vehiculo', 'abono'],
  movimientoclientes: ['cliente', 'vehiculo', 'abono'],
};

// 🔑 CLAVES NATURALES
const NATURAL_KEYS = {
  tickets: ['ticket'],
  users: ['username', 'email'],
  vehiculos: ['patente'],
  clientes: ['dniCuitCuil', 'email'],
  tipovehiculos: ['nombre'],
  tarifas: ['nombre'],
  promos: ['codigo'],
  alertas: ['codigo'],
};

function coerceRefIds(doc, colName) {
  if (!doc || typeof doc !== 'object') return doc;
  const fields = REF_BY_COLL[colName?.toLowerCase()] || [];
  for (const f of fields) {
    if (doc[f] !== undefined) {
      if (Array.isArray(doc[f])) {
        doc[f] = doc[f].map(toObjectIdMaybe);
      } else {
        doc[f] = toObjectIdMaybe(doc[f]);
      }
    }
  }
  return doc;
}

// Normalización para PULL (remote -> local)
function normalizeIds(inputDoc, colName) {
  const clone = deepClone(inputDoc || {});
  if (clone._id != null) clone._id = safeObjectId(clone._id);

  const commonKeys = new Set([
    'cliente', 'vehiculo', 'abono', 'user', 'ticket',
    ...(REF_BY_COLL[colName?.toLowerCase()] || [])
  ]);

  for (const k of commonKeys) {
    if (clone[k] !== undefined) {
      if (Array.isArray(clone[k])) {
        clone[k] = clone[k].map(safeObjectId);
      } else {
        clone[k] = safeObjectId(clone[k]);
      }
    }
  }

  const maybeIdArrays = ['abonos', 'vehiculos', 'movimientos'];
  for (const k of maybeIdArrays) {
    if (Array.isArray(clone[k])) {
      clone[k] = clone[k].map(safeObjectId);
    }
  }

  return removeNulls(clone);
}

function getCollectionNameFromItem(item) {
  if (!item) return null;
  if (item.collection) return item.collection;
  if (item.route) {
    const parts = item.route.split('/').filter(Boolean);
    const apiIndex = parts.indexOf('api');
    if (apiIndex >= 0 && parts.length > apiIndex + 1) return parts[apiIndex + 1];
    const last = parts[parts.length - 1];
    if (last && mongoose.Types.ObjectId.isValid(last) && parts.length >= 2) return parts[parts.length - 2];
    if (parts.length) return parts[parts.length - 1];
  }
  return null;
}

function extractIdFromItem(item) {
  if (!item) return null;
  if (item.document && (item.document._id || item.document.id)) return item.document._id || item.document.id;
  if (item.params && (item.params.id || item.params._id)) return item.params.id || item.params._id;
  if (item.query && (item.query.id || item.query._id)) return item.query.id || item.query._id;
  if (item.route) {
    const parts = item.route.split('/').filter(Boolean);
    for (const part of parts) {
      if (mongoose.Types.ObjectId.isValid(part)) return part;
    }
  }
  return null;
}

async function hasInternet() {
  return new Promise(resolve => {
    dns.lookup('google.com', err => resolve(!err));
  });
}

// DB remota
function getRemoteDbInstance() {
  if (!remoteClient) return null;
  try {
    return remoteClient.db(SELECTED_REMOTE_DBNAME || undefined);
  } catch (_e) {
    return null;
  }
}

async function connectRemote(atlasUri, dbName) {
  if (!atlasUri) throw new Error('No ATLAS URI provista');
  SELECTED_REMOTE_DBNAME = dbName || SELECTED_REMOTE_DBNAME || null;

  const existing = getRemoteDbInstance();
  if (existing) return existing;

  console.log('[syncService] intentando conectar a Atlas...');
  remoteClient = new MongoClient(atlasUri, { serverSelectionTimeoutMS: 3000 });
  await remoteClient.connect();
  const db = remoteClient.db(SELECTED_REMOTE_DBNAME || undefined);
  console.log(`[syncService] conectado a Atlas (remote db="${db.databaseName}")`);
  return db;
}

function looksLikeValidDocument(obj) {
  return !!(obj && typeof obj === 'object' && !Array.isArray(obj));
}

// ---- Heurísticas ----
function isCompositeRegistrarAbono(item) {
  const r = (item && item.route) || '';
  return /\/api\/abonos\/registrar-abono/i.test(r);
}
function isProbablyVehiculoShaped(doc) {
  return !!(doc && (doc.estadiaActual || doc.turno === true || doc.abonado === true || (doc.patente && doc.tipoVehiculo && !doc.tipoAbono)));
}

// --------------------- helpers de escritura remota ---------------------

async function upsertRemoteDoc(remoteDb, colName, rawDoc) {
  if (!rawDoc) return 0;
  const collection = remoteDb.collection(colName);
  const doc = deepClone(rawDoc);
  coerceRefIds(doc, colName);
  doc._id = safeObjectId(doc._id);
  const cleaned = removeNulls(doc);
  const _id = safeObjectId(cleaned._id);
  const rest = deepClone(cleaned);
  delete rest._id;
  await collection.updateOne({ _id }, { $set: rest }, { upsert: true });
  return 1;
}

// Trata especialmente el outbox de /api/abonos/registrar-abono
async function ensureCompositeRegistrarAbonoSynced(remoteDb, item) {
  const body = item?.document || {};

  let cliente = null;
  if (body.cliente && mongoose.Types.ObjectId.isValid(body.cliente)) {
    cliente = await Cliente.findById(body.cliente).lean();
  }
  if (!cliente && body.dniCuitCuil) {
    cliente = await Cliente.findOne({ dniCuitCuil: body.dniCuitCuil }).lean();
  }
  if (!cliente && body.email) {
    cliente = await Cliente.findOne({ email: body.email }).lean();
  }

  let vehiculo = null;
  if (body.patente) {
    vehiculo = await Vehiculo.findOne({ patente: body.patente }).lean();
  }

  let abono = null;
  if (vehiculo && cliente) {
    abono = await Abono.findOne({ vehiculo: vehiculo._id, cliente: cliente._id }).sort({ createdAt: -1 }).lean();
  } else if (body.patente) {
    abono = await Abono.findOne({ patente: body.patente }).sort({ createdAt: -1 }).lean();
  }

  let mov = null;
  if (cliente && body.patente) {
    mov = await Movimiento.findOne({ cliente: cliente._id, patente: body.patente }).sort({ createdAt: -1 }).lean();
  }

  if (!MovimientoCliente) {
    try { MovimientoCliente = require('../models/MovimientoCliente'); } catch (_) {}
  }
  let movCli = null;
  if (MovimientoCliente && cliente) {
    movCli = await MovimientoCliente.findOne({ cliente: cliente._id }).sort({ createdAt: -1 }).lean();
  }

  let pushed = 0;
  pushed += await upsertRemoteDoc(remoteDb, 'clientes', cliente);
  pushed += await upsertRemoteDoc(remoteDb, 'vehiculos', vehiculo);
  pushed += await upsertRemoteDoc(remoteDb, 'abonos', abono);
  pushed += await upsertRemoteDoc(remoteDb, 'movimientos', mov);
  pushed += await upsertRemoteDoc(remoteDb, 'movimientoclientes', movCli);

  if (!pushed) throw new Error('composite_registrar_abono: no se encontraron docs locales para sincronizar');
}

// --------------------- procesamiento de Outbox ---------------------

function buildNaturalKeyFilter(colName, src) {
  const keys = NATURAL_KEYS[colName?.toLowerCase()] || [];
  const filter = {};
  for (const k of keys) {
    if (src[k] !== undefined && src[k] !== null && String(src[k]).trim() !== '') {
      filter[k] = src[k];
    }
  }
  return Object.keys(filter).length ? filter : null;
}

async function processOutboxItem(remoteDb, item) {
  if (isCompositeRegistrarAbono(item)) {
    await ensureCompositeRegistrarAbonoSynced(remoteDb, item);
    return;
  }

  const colName = getCollectionNameFromItem(item);
  if (!colName) throw new Error('invalid_collection');

  if (item.method !== 'DELETE' && !looksLikeValidDocument(item.document)) {
    throw new Error('invalid_document');
  }

  const collection = remoteDb.collection(colName);
  if (!collection) throw new Error(`Colección remota no encontrada: ${colName}`);

  if (item.method === 'POST') {
    const doc = deepClone(item.document || {});
    coerceRefIds(doc, colName);
    const cleaned = removeNulls(doc);

    if (cleaned._id) {
      const _id = safeObjectId(cleaned._id);
      if (_id instanceof ObjectId) {
        const rest = deepClone(cleaned); delete rest._id;
        await collection.updateOne({ _id }, { $set: rest }, { upsert: true });
        return;
      }
    }

    const nk = buildNaturalKeyFilter(colName, cleaned);

    let fallback = null;
    if (!nk) {
      if (colName.toLowerCase() === 'tickets' && cleaned.ticket != null && String(cleaned.ticket).trim() !== '') {
        fallback = { ticket: cleaned.ticket };
      } else if (cleaned.username) {
        fallback = { username: cleaned.username };
      } else if (cleaned.email) {
        fallback = { email: cleaned.email };
      }
    }

    const rest = deepClone(cleaned); delete rest._id;

    if (colName.toLowerCase() === 'tickets' && !nk && !fallback) {
      throw new Error('invalid_document: ticket sin número');
    }

    if (nk || fallback) {
      await collection.updateOne(nk || fallback, { $set: rest }, { upsert: true });
      return;
    }

    await collection.insertOne(cleaned);
    return;

  } else if (item.method === 'PUT' || item.method === 'PATCH') {
    const doc = deepClone(item.document || {});
    coerceRefIds(doc, colName);

    // id: del doc, o inferido de la ruta
    const id = doc._id || extractIdFromItem(item);
    if (!id) throw new Error('sin id en outbox');

    const filter = { _id: safeObjectId(id) };

    // SET limpio (sin null/undefined)
    const setBody = deepClone(doc); delete setBody._id;
    const $set = removeNulls(setBody);

    // UNSET implícito:
    // - campos enviados en null → unset
    // - regla de negocio vehiculos.estadiaActual:
    //   * si NO viene el campo → unset
    //   * si viene vacío ({})   → también unset
    const $unset = {};

    // 1) unsets por null explícito
    Object.keys(setBody || {}).forEach(k => {
      if (setBody[k] === null) { $unset[k] = ""; delete $set[k]; }
    });

    // 2) regla de negocio: vehiculos.estadiaActual
    if (colName.toLowerCase() === 'vehiculos') {
      const hasEstadia = Object.prototype.hasOwnProperty.call(doc, 'estadiaActual');
      const isEmptyObj =
        hasEstadia &&
        doc.estadiaActual &&
        typeof doc.estadiaActual === 'object' &&
        !Array.isArray(doc.estadiaActual) &&
        Object.keys(doc.estadiaActual).length === 0;

      if (!hasEstadia || isEmptyObj) {
        $unset.estadiaActual = "";
        // por las dudas, evitamos setear {} encima
        if ($set && Object.prototype.hasOwnProperty.call($set, 'estadiaActual')) {
          delete $set.estadiaActual;
        }
      }
    }

    const updateOps = Object.keys($unset).length ? { $set, $unset } : { $set };
    await collection.updateOne(filter, updateOps, { upsert: true });
    return;

  } else if (item.method === 'DELETE') {
    const id =
      (item.document && (item.document._id || item.document.id)) ||
      extractIdFromItem(item);

    const isBulk =
      (item.query && (item.query.__bulk === true || item.query.__bulk === 'true')) ||
      (item.query && (item.query.all === true || item.query.all === 'true')) ||
      item.bulk === true || item.bulk === 'true';

    const bulkFilter = (item.query && item.query.filter) ||
                       (item.document && item.document.filter) || {};

    // --- DELETE por id ---
    if (id) {
      await collection.deleteOne({ _id: safeObjectId(id) });
      return;
    }

    // --- DELETE BULK ---
    if (isBulk) {
      const effectiveFilter = (bulkFilter && typeof bulkFilter === 'object' && Object.keys(bulkFilter).length)
        ? bulkFilter
        : {};
      const res = await collection.deleteMany(effectiveFilter);
      console.log(`[syncService] bulk delete remoto en "${colName}": deleted=${res?.deletedCount ?? 0} filter=${JSON.stringify(effectiveFilter)}`);
      return;
    }

    // --- DELETE por claves naturales fallback ---
    const doc = item.document || {};
    const nk = buildNaturalKeyFilter(colName, doc);
    if (nk) { await collection.deleteOne(nk); return; }
    if (doc.ticket !== undefined) { await collection.deleteOne({ ticket: doc.ticket }); return; }
    if (doc.username) { await collection.deleteOne({ username: doc.username }); return; }
    if (doc.email) { await collection.deleteOne({ email: doc.email }); return; }

    throw new Error('DELETE sin id ni bulk flag');

  } else {
    throw new Error('Método no soportado en outbox: ' + item.method);
  }
}

// --------------------- PULL (desde remoto a local) ---------------------

async function upsertLocalDocWithConflictResolution(localCollection, collName, remoteDoc, stats, options = {}) {
  const { mirrorArrays = false } = options; // ← decide si espejar arrays (no recomendado por default)
  const cleaned = normalizeIds(remoteDoc, collName);
  cleaned._id = safeObjectId(cleaned._id);
  const _id = cleaned._id;

  // Campos “array relacionales” a tratar con guantes
  const REL_ARRAYS_BY_COLL = {
    clientes: ['abonos','vehiculos','movimientos'],
    // Podrías sumar otros si usás arrays de refs en otras colecciones
  };
  const relArrays = new Set(REL_ARRAYS_BY_COLL[collName?.toLowerCase()] || []);

  // Separá payload en: scalars/$set vs arrays relacionales
  const rest = deepClone(cleaned);
  delete rest._id;

  const addToSet = {};   // { campo: { $each: [...] } }
  const pullOps  = {};   // { campo: { $nin: [...] } } (cuando mirrorArrays = true)
  const setOps   = {};   // $set para scalars y, si hay mirrorArrays, arrays exactos
  const unsetOps = {};   // $unset (reglas puntuales)

  // 1) Tratamiento especial de arrays relacionales
  for (const field of Object.keys(rest)) {
    if (!relArrays.has(field)) continue;
    const val = rest[field];

    // Nunca setees null/undefined sobre arrays relacionales
    if (val == null) { delete rest[field]; continue; }

    // Si no es array, descartalo; si es array, casteá ids
    if (!Array.isArray(val)) { delete rest[field]; continue; }
    const arr = val.map(safeObjectId).filter(Boolean);

    // Política:
    // - mirrorArrays = false → sólo agrego (no borro). Si llega [], NO toco.
    // - mirrorArrays = true  → si llega con elems, seteo exacto y además hago $pull de los que sobren.
    if (mirrorArrays) {
      if (arr.length > 0) {
        setOps[field] = arr;               // espejo exacto (cuando hay elems)
        pullOps[field] = { $nin: arr };    // saco extras
      } else {
        // NO setear [] para evitar wipes por carreras → no tocar el campo
      }
    } else {
      if (arr.length > 0) {
        addToSet[field] = { $each: arr };  // sólo agrego
      } else {
        // arr vacío → no tocar
      }
    }
    delete rest[field]; // lo saco de $set general para no sobreescribir
  }

  // 2) $set del resto (scalars/objetos NO relacionales)
  Object.assign(setOps, removeNulls(rest));

  // 3) Regla de negocio para vehiculos.estadiaActual: si no viene o viene {}, unsets
  if (collName.toLowerCase() === 'vehiculos') {
    const hasEstadia = Object.prototype.hasOwnProperty.call(cleaned, 'estadiaActual');
    const isEmptyObj =
      hasEstadia &&
      cleaned.estadiaActual &&
      typeof cleaned.estadiaActual === 'object' &&
      !Array.isArray(cleaned.estadiaActual) &&
      Object.keys(cleaned.estadiaActual).length === 0;

    if (!hasEstadia || isEmptyObj) {
      unsetOps.estadiaActual = "";
      if (hasEstadia && setOps && Object.prototype.hasOwnProperty.call(setOps, 'estadiaActual')) {
        delete setOps.estadiaActual; // no dejar {}
      }
    }
  }

  // 4) Construyo update
  const updateOps = {};
  if (Object.keys(setOps).length)     updateOps.$set     = setOps;
  if (Object.keys(addToSet).length)   updateOps.$addToSet = addToSet;
  if (Object.keys(unsetOps).length)   updateOps.$unset   = unsetOps;
  if (mirrorArrays) {
    // Para los pulls de arrays espejados: sólo tiene efecto si el campo existe
    for (const k of Object.keys(pullOps)) {
      // usamos $pull con $nin, pero sólo si también hacemos $set del campo en este update
      // (evita hacer pull sin que exista aún el campo)
      if (updateOps.$set && Object.prototype.hasOwnProperty.call(updateOps.$set, k)) {
        updateOps.$pull = Object.assign(updateOps.$pull || {}, { [k]: pullOps[k] });
      }
    }
  }

  try {
    await localCollection.updateOne({ _id }, Object.keys(updateOps).length ? updateOps : { $set: {} }, { upsert: true });
    return true;
  } catch (err) {
    // Conflictos UNIQUE → misma lógica que ya tenías
    const code = err && (err.code || (err.errorResponse && err.errorResponse.code));
    if (code !== 11000) throw err;

    const keys = NATURAL_KEYS[collName?.toLowerCase()] || [];
    let anyDelete = false;
    for (const k of keys) {
      if (cleaned[k] === undefined || cleaned[k] === null) continue;
      const f = {}; f[k] = cleaned[k]; f._id = { $ne: cleaned._id };
      const delRes = await localCollection.deleteMany(f);
      if (delRes && delRes.deletedCount) {
        anyDelete = true;
        console.warn(`[syncService] ${collName}: conflicto UNIQUE (${k}="${cleaned[k]}"). Borré locales duplicados: ${delRes.deletedCount}.`);
      }
    }

    if (!anyDelete) {
      const msg = String(err.message || '');
      const m = msg.match(/dup key:\s*\{\s*([^}]+)\s*\}/i);
      if (m && m[1]) {
        const pair = m[1].split(':').map(s => s.trim());
        if (pair.length >= 2) {
          const field = pair[0].replace(/^\{?\s*"?(\w+)"?\s*$/, '$1');
          const value = (pair.slice(1).join(':').trim().replace(/^"|"$/g, ''));
          if (field && value !== undefined) {
            const f = {}; f[field] = value; f._id = { $ne: cleaned._id };
            const delRes = await localCollection.deleteMany(f);
            if (delRes && delRes.deletedCount) {
              anyDelete = true;
              console.warn(`[syncService] ${collName}: conflicto UNIQUE (${field}="${value}"). Borré locales duplicados: ${delRes.deletedCount}.`);
            }
          }
        }
      }
    }

    await localCollection.updateOne({ _id }, Object.keys(updateOps).length ? updateOps : { $set: {} }, { upsert: true });
    if (stats) stats.conflictsResolved = (stats.conflictsResolved || 0) + 1;
    return true;
  }
}

/**
 * PULL principal. Con mirrorAll = true, hace “mirror” (borrado local de sobrantes)
 * **para TODAS** las colecciones (excepto skip).
 */
async function pullCollectionsFromRemote(remoteDb, requestedCollections = [], opts = {}) {
  const local = mongoose.connection;
  const resultCounts = {};
  const mirrorAll = !!opts.mirrorAll;
  const mirrorSet = new Set((opts.mirrorCollections || []).map(s => s.trim()).filter(Boolean));

  if (opts.pullAll) {
    const cols = await remoteDb.listCollections().toArray();
    const names = cols.map(c => c.name).filter(n => !n.startsWith('system.') && n !== 'outbox');
    requestedCollections = names;
  }

  const skipConfigured = new Set((opts.skipCollections || []).map(s => s.toLowerCase()));
  const skipBulk = opts.skipCollectionsSet || new Set();

  requestedCollections = (requestedCollections || [])
    .filter(c => c !== 'counters')
    .filter(c => !skipConfigured.has(String(c).toLowerCase()))
    .filter(c => !skipBulk.has(c));

  if (!requestedCollections.length) return resultCounts;

  for (const coll of requestedCollections) {
    const stats = { remoteTotal: 0, upsertedOrUpdated: 0, deletedLocal: 0, conflictsResolved: 0 };
    try {
      const remoteCollection = remoteDb.collection(coll);
      let remoteDocs = await remoteCollection.find({}).toArray();

      if (coll === 'abonos' && remoteDocs.length) {
        const before = remoteDocs.length;
        remoteDocs = remoteDocs.filter(d => !isProbablyVehiculoShaped(d));
        const after = remoteDocs.length;
        if (after !== before) {
          console.warn(`[syncService] abonos: filtrados ${before - after} docs con forma de vehiculo.`);
        }
      }

      stats.remoteTotal = remoteDocs.length;

      const localCollection = local.collection(coll);

      // ¿Esta colección corre en modo espejo?
      const mirrorArraysForThis = !!(mirrorAll || mirrorSet.has(coll));

      for (const raw of remoteDocs) {
        await upsertLocalDocWithConflictResolution(
          localCollection,
          coll,
          raw,
          stats,
          { mirrorArrays: mirrorArraysForThis }  // ← clave: pasar el flag
        );
        stats.upsertedOrUpdated++;
      }

      // Mirror robusto (incluye _id “raros”)
      if (mirrorAll || mirrorSet.has(coll)) {
        const remoteIds = new Set(remoteDocs.map(d => String(d._id)));
        const localIdsDocs = await localCollection.find({}, { projection: { _id: 1 } }).toArray();

        const toDeleteObjIds = [];
        for (const d of localIdsDocs) {
          const idRaw = d._id;
          const idStr = String(idRaw);
          if (!remoteIds.has(idStr)) {
            if (idRaw instanceof ObjectId) {
              toDeleteObjIds.push(idRaw);
            } else if (typeof idRaw === 'string' && is24Hex(idRaw)) {
              toDeleteObjIds.push(new ObjectId(idRaw));
            } else {
              const delOne = await localCollection.deleteOne({ _id: idRaw });
              if (delOne && delOne.deletedCount) {
                stats.deletedLocal += delOne.deletedCount;
              }
            }
          }
        }
        if (toDeleteObjIds.length) {
          const { deletedCount } = await localCollection.deleteMany({ _id: { $in: toDeleteObjIds } });
          stats.deletedLocal += deletedCount || 0;
        }
      }

      resultCounts[coll] = stats;
      console.log(`[syncService] pulled ${coll} (db="${remoteDb.databaseName}"): remote=${stats.remoteTotal}, upserted=${stats.upsertedOrUpdated}, deletedLocal=${stats.deletedLocal}${stats.conflictsResolved ? `, conflictsResolved=${stats.conflictsResolved}` : ''} ${mirrorAll ? '[mirrorAll]' : (mirrorSet.has(coll) ? '[mirror]' : '')}`);
    } catch (err) {
      console.warn(`[syncService] no se pudo pull ${coll}:`, err.message || err);
    }
  }

  try {
    const maxTicket = await Ticket.findOne().sort({ ticket: -1 }).select('ticket').lean();
    const maxNumero = maxTicket && typeof maxTicket.ticket === 'number' ? maxTicket.ticket : 0;
    const seq = await Counter.ensureAtLeast('ticket', maxNumero);
    console.log(`[syncService] counter 'ticket' ajustado post-pull a >= ${maxNumero}. seq=${seq}`);
  } catch (e) {
    console.warn('[syncService] no se pudo ajustar counter post-pull:', e.message);
  }

  return resultCounts;
}

// --------------------- ciclo de sincronización ---------------------

async function syncTick(atlasUri, opts = {}, statusCb = () => {}) {
  if (syncing) return;
  syncing = true;
  status.lastRun = new Date();
  status.lastError = null;
  status.pendingOutbox = 0;
  statusCb(status);

  try {
    const internet = await hasInternet();
    if (!internet) {
      status.online = false;
      status.lastError = 'No hay conexión a Internet, saltando SYNC';
      statusCb(status);
      console.warn('[syncService] No hay conexion, salteando SYNC');
      return;
    }

    let remoteDb = null;
    try {
      SELECTED_REMOTE_DBNAME = opts.remoteDbName || SELECTED_REMOTE_DBNAME || null;
      const existing = getRemoteDbInstance();
      remoteDb = existing || await connectRemote(atlasUri, SELECTED_REMOTE_DBNAME);
    } catch (err) {
      status.online = false;
      status.lastError = `No se pudo conectar a Atlas: ${err.message || err}`;
      statusCb(status);
      console.warn('[syncService] Sin conexión a Atlas. Saltando sync:', err.message || err);
      return;
    }

    status.online = true;
    statusCb(status);

    const pending = await Outbox.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(200);
    status.pendingOutbox = pending.length;
    statusCb(status);

    const bulkDeletedCollections = new Set();

    for (const item of pending) {
      const preColName = getCollectionNameFromItem(item);
      const preIsDelete = item.method === 'DELETE';
      const preHasId = !!extractIdFromItem(item);
      const preIsBulk = preIsDelete && (
        (item.query && (item.query.__bulk === true || item.query.__bulk === 'true')) ||
        (item.query && (item.query.all === true || item.query.all === 'true')) ||
        item.bulk === true || item.bulk === 'true'
      );
      const shouldSkipPullThisTick = preIsDelete && !preHasId && preIsBulk && !!preColName;

      try {
        await Outbox.updateOne({ _id: item._id }, { status: 'processing' });

        const colName = preColName;
        if (!colName && !isCompositeRegistrarAbono(item)) {
          await Outbox.updateOne({ _id: item._id }, { status: 'error', error: 'invalid_collection', retries: 6 });
          continue;
        }

        if (['POST','PUT','PATCH'].includes(item.method) && !looksLikeValidDocument(item.document) && !isCompositeRegistrarAbono(item)) {
          await Outbox.updateOne({ _id: item._id }, { status: 'error', error: 'invalid_document', retries: 6 });
          continue;
        }

        await processOutboxItem(remoteDb, item);

        await Outbox.updateOne({ _id: item._id }, { status: 'synced', syncedAt: new Date(), error: null });
      } catch (err) {
        const errMsg = String(err && err.message ? err.message : err).slice(0, 1000);
        const retries = (item.retries || 0) + 1;

        const nonRetriableCodes = [
          'invalid_collection',
          'invalid_document',
          'sin id en outbox',
          'duplicate key',
          11000,
          'bulk_delete_not_allowed',
          'bulk_delete_requires_filter',
          'DELETE sin id ni bulk flag',
          'composite_registrar_abono: no se encontraron docs locales para sincronizar'
        ];
        const isNonRetriable = nonRetriableCodes.some(code =>
          (typeof code === 'string' && errMsg.includes(code)) ||
          (typeof code === 'number' && err && err.code === code)
        );

        const update = {
          error: errMsg,
          retries,
          status: isNonRetriable || retries >= 6 ? 'error' : 'pending'
        };

        await Outbox.updateOne({ _id: item._id }, update);
        console.error('[syncService] error procesando outbox item', item._id, errMsg);
      } finally {
        if (shouldSkipPullThisTick && preColName) {
          bulkDeletedCollections.add(preColName);
        }
      }
    }

    const pullCollectionsEnv = Array.isArray(opts.pullCollections) ? opts.pullCollections.filter(Boolean) : [];
    const pullOpts = {
      pullAll: !!opts.pullAll,
      mirrorAll: !!opts.mirrorAll,
      mirrorCollections: opts.mirrorCollections || [],
      skipCollections: opts.skipCollections || [],
      skipCollectionsSet: bulkDeletedCollections
    };

    let pullCounts = {};
    if (pullOpts.pullAll || pullCollectionsEnv.length) {
      const requested = pullOpts.pullAll
        ? pullCollectionsEnv // pullCollectionsFromRemote ignora y lista todas cuando pullAll=true
        : pullCollectionsEnv.filter(c => !bulkDeletedCollections.has(c));

      pullCounts = await pullCollectionsFromRemote(remoteDb, requested, pullOpts);
      status.lastPullCounts = pullCounts;
    }

    status.lastError = null;
    statusCb(status);

  } catch (err) {
    status.lastError = String(err).slice(0, 2000);
    status.online = false;
    console.warn('[syncService] tick error:', err.message || err);
    statusCb(status);
  } finally {
    syncing = false;
    statusCb(status);
  }
}

function startPeriodicSync(atlasUri, opts = {}, statusCb = () => {}) {
  const intervalMs = opts.intervalMs || 30_000;
  console.log('[syncService] iniciando sincronizador. Intervalo:', intervalMs, 'ms');
  if (opts.remoteDbName) {
    SELECTED_REMOTE_DBNAME = opts.remoteDbName;
    console.log(`[syncService] DB remota seleccionada: "${SELECTED_REMOTE_DBNAME}"`);
  }

  // primer tick inmediato
  syncTick(atlasUri, opts, statusCb).catch(e => console.error('[syncService] primer tick falló:', e));

  const handle = setInterval(() => syncTick(atlasUri, opts, statusCb), intervalMs);

  return {
    stop: () => clearInterval(handle),
    runOnce: () => syncTick(atlasUri, opts, statusCb),
    getStatus: () => ({ ...status }),
    inspectRemote: async (cols = []) => {
      const db = getRemoteDbInstance() || await connectRemote(atlasUri, SELECTED_REMOTE_DBNAME);
      const collections = cols.length ? cols : (await db.listCollections().toArray()).map(c => c.name);
      const out = {};
      for (const c of collections) {
        try {
          const count = await db.collection(c).countDocuments();
          out[c] = count;
        } catch (e) {
          out[c] = `err: ${e.message}`;
        }
      }
      return { remoteDbName: db.databaseName, counts: out };
    }
  };
}

module.exports = { startPeriodicSync, connectRemote, syncTick };
