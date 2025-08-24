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

  // ✅ NUEVO: castear operador en cierres de caja
  cierresdecajas: ['operador'],
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

  // ✅ NUEVO: evita duplicados en POST sin _id
  cierresdecajas: ['fecha', 'hora', 'operador'],
};

// ✅ NUEVO: alias de colecciones remotas (lecturas legacy / apis que miran otro nombre)
const REMOTE_ALIASES = {
  // canónico -> variantes posibles que alguna app puede estar usando
  cierresdecajas: ['cierresDeCaja', 'cierredecajas', 'cierresdecaja', 'cierredecaja'],
};

function getRemoteNames(colName) {
  const canon = String(colName || '').trim();
  const key = canon.toLowerCase();
  const aliases = REMOTE_ALIASES[key] || [];
  const all = [canon, ...aliases].filter(Boolean);
  // únicos preservando orden
  return all.filter((v, i) => all.indexOf(v) === i);
}

function canonicalizeName(name) {
  const lower = String(name || '').toLowerCase();
  for (const [canon, aliases] of Object.entries(REMOTE_ALIASES)) {
    if (lower === canon) return canon;
    if (aliases.some(a => a.toLowerCase() === lower)) return canon;
  }
  return lower; // si no hay alias, queda como viene en lower
}

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

function normalizeIds(inputDoc, colName) {
  const clone = deepClone(inputDoc || {});
  if (clone._id != null) clone._id = safeObjectId(clone._id);

  const commonKeys = new Set([
    'cliente', 'vehiculo', 'abono', 'user', 'ticket', 'operador',
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
  const names = getRemoteNames(colName);
  const doc = deepClone(rawDoc);
  coerceRefIds(doc, colName);
  const cleaned = removeNulls(doc);
  const _id = safeObjectId(cleaned._id);
  const rest = deepClone(cleaned);
  delete rest._id;

  let pushed = 0;

  for (const name of names) {
    const collection = remoteDb.collection(name);
    if (_id instanceof ObjectId) {
      await collection.updateOne({ _id }, { $set: rest }, { upsert: true });
    } else {
      // si no hay _id, usar claves naturales si existen
      const nk = buildNaturalKeyFilter(colName, cleaned);
      if (nk) {
        await collection.updateOne(nk, { $set: rest }, { upsert: true });
      } else {
        await collection.insertOne(cleaned);
      }
    }
    pushed++;
  }

  return pushed;
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

async function processOutboxItem(remoteDb, item) {
  if (isCompositeRegistrarAbono(item)) {
    await ensureCompositeRegistrarAbonoSynced(remoteDb, item);
    return;
  }

  const colName = getCollectionNameFromItem(item);
  if (!colName) throw new Error('invalid_collection');

  // sanity: algunos endpoints devuelven sobre ->document wrappers, validamos acá igual
  if (item.method !== 'DELETE' && !looksLikeValidDocument(item.document)) {
    throw new Error('invalid_document');
  }

  const remoteNames = getRemoteNames(colName);
  if (!remoteNames.length) throw new Error(`Colección remota no encontrada (aliases vacíos): ${colName}`);

  // --- POST ---
  if (item.method === 'POST') {
    const doc = deepClone(item.document || {});
    coerceRefIds(doc, colName);
    const cleaned = removeNulls(doc);

    // Preferimos upsert por _id -> sino por claves naturales -> sino insert
    const _id = safeObjectId(cleaned._id);
    const nk = buildNaturalKeyFilter(colName, cleaned);
    const rest = deepClone(cleaned); delete rest._id;

    for (const name of remoteNames) {
      const collection = remoteDb.collection(name);
      if (_id instanceof ObjectId) {
        await collection.updateOne({ _id }, { $set: rest }, { upsert: true });
      } else if (nk) {
        await collection.updateOne(nk, { $set: rest }, { upsert: true });
      } else {
        await collection.insertOne(cleaned);
      }
    }
    return;
  }

  // --- PUT / PATCH ---
  if (item.method === 'PUT' || item.method === 'PATCH') {
    const doc = deepClone(item.document || {});
    coerceRefIds(doc, colName);

    const id = doc._id || extractIdFromItem(item);
    if (!id) throw new Error('sin id en outbox');

    const filter = { _id: safeObjectId(id) };

    const setBody = deepClone(doc); delete setBody._id;
    const $set = removeNulls(setBody);

    const $unset = {};
    Object.keys(setBody || {}).forEach(k => {
      if (setBody[k] === null) { $unset[k] = ""; delete $set[k]; }
    });

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
        if ($set && Object.prototype.hasOwnProperty.call($set, 'estadiaActual')) {
          delete $set.estadiaActual;
        }
      }
    }

    const updateOps = Object.keys($unset).length ? { $set, $unset } : { $set };

    for (const name of remoteNames) {
      const collection = remoteDb.collection(name);
      await collection.updateOne(filter, updateOps, { upsert: true });
    }
    return;
  }

  // --- DELETE ---
  if (item.method === 'DELETE') {
    const id =
      (item.document && (item.document._id || item.document.id)) ||
      extractIdFromItem(item);

    const isBulk =
      (item.query && (item.query.__bulk === true || item.query.__bulk === 'true')) ||
      (item.query && (item.query.all === true || item.query.all === 'true')) ||
      item.bulk === true || item.bulk === 'true';

    const bulkFilter = (item.query && item.query.filter) ||
                       (item.document && item.document.filter) || {};

    for (const name of remoteNames) {
      const collection = remoteDb.collection(name);

      if (id) {
        await collection.deleteOne({ _id: safeObjectId(id) });
        continue;
      }

      if (isBulk) {
        const effectiveFilter = (bulkFilter && typeof bulkFilter === 'object' && Object.keys(bulkFilter).length)
          ? bulkFilter
          : {};
        await collection.deleteMany(effectiveFilter);
        continue;
      }

      const doc = item.document || {};
      const nk = buildNaturalKeyFilter(colName, doc);
      if (nk) { await collection.deleteOne(nk); continue; }
      if (doc.ticket !== undefined) { await collection.deleteOne({ ticket: doc.ticket }); continue; }
      if (doc.username) { await collection.deleteOne({ username: doc.username }); continue; }
      if (doc.email) { await collection.deleteOne({ email: doc.email }); continue; }

      throw new Error('DELETE sin id ni bulk flag');
    }
    return;
  }

  throw new Error('Método no soportado en outbox: ' + item.method);
}

// --------------------- PULL (desde remoto a local) ---------------------

function buildDedupKey(collName, doc) {
  const keys = NATURAL_KEYS[collName?.toLowerCase()] || [];
  if (keys.length) {
    return keys.map(k => String(doc[k])).join('||');
  }
  return String(doc._id);
}

async function upsertLocalDocWithConflictResolution(localCollection, collName, remoteDoc, stats, options = {}) {
  const { mirrorArrays = false } = options;
  const cleaned = normalizeIds(remoteDoc, collName);
  cleaned._id = safeObjectId(cleaned._id);
  const _id = cleaned._id;

  const REL_ARRAYS_BY_COLL = {
    clientes: ['abonos','vehiculos','movimientos'],
  };
  const relArrays = new Set(REL_ARRAYS_BY_COLL[collName?.toLowerCase()] || []);

  const rest = deepClone(cleaned);
  delete rest._id;

  const addToSet = {};
  const pullOps  = {};
  const setOps   = {};
  const unsetOps = {};

  for (const field of Object.keys(rest)) {
    if (!relArrays.has(field)) continue;
    const val = rest[field];

    if (val == null) { delete rest[field]; continue; }

    if (!Array.isArray(val)) { delete rest[field]; continue; }
    const arr = val.map(safeObjectId).filter(Boolean);

    if (mirrorArrays) {
      if (arr.length > 0) {
        setOps[field] = arr;
        pullOps[field] = { $nin: arr };
      }
    } else {
      if (arr.length > 0) {
        addToSet[field] = { $each: arr };
      }
    }
    delete rest[field];
  }

  Object.assign(setOps, removeNulls(rest));

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
        delete setOps.estadiaActual;
      }
    }
  }

  const updateOps = {};
  if (Object.keys(setOps).length)     updateOps.$set     = setOps;
  if (Object.keys(addToSet).length)   updateOps.$addToSet = addToSet;
  if (Object.keys(unsetOps).length)   updateOps.$unset   = unsetOps;
  if (mirrorArrays) {
    for (const k of Object.keys(pullOps)) {
      if (updateOps.$set && Object.prototype.hasOwnProperty.call(updateOps.$set, k)) {
        updateOps.$pull = Object.assign(updateOps.$pull || {}, { [k]: pullOps[k] });
      }
    }
  }

  try {
    await localCollection.updateOne({ _id }, Object.keys(updateOps).length ? updateOps : { $set: {} }, { upsert: true });
    return true;
  } catch (err) {
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
 * ✅ NUEVO: consolida alias remotos en el canónico local.
 */
async function pullCollectionsFromRemote(remoteDb, requestedCollections = [], opts = {}) {
  const local = mongoose.connection;
  const resultCounts = {};
  const mirrorAll = !!opts.mirrorAll;
  const mirrorSet = new Set((opts.mirrorCollections || []).map(s => s.trim()).filter(Boolean));

  // Si pullAll: listamos remoto, canonicalizamos nombres y hacemos únicos
  if (opts.pullAll) {
    const cols = await remoteDb.listCollections().toArray();
    const namesRaw = cols.map(c => c.name).filter(n => !n.startsWith('system.') && n !== 'outbox');
    const canonicalized = namesRaw.map(canonicalizeName);
    const uniq = Array.from(new Set(canonicalized));
    requestedCollections = uniq;
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
      // ✅ leer de todas las variantes remotas y consolidar
      const remoteNames = getRemoteNames(coll);
      const union = [];
      const seen = new Set();

      for (const name of remoteNames) {
        try {
          const remoteCollection = remoteDb.collection(name);
          const docs = await remoteCollection.find({}).toArray();
          for (const d of docs) {
            const key = buildDedupKey(coll, d) + '##' + String(d._id);
            if (seen.has(key)) continue;
            seen.add(key);
            union.push(d);
          }
        } catch (e) {
          // si alguna variante no existe, seguimos
        }
      }

      stats.remoteTotal = union.length;

      const localCollection = local.collection(coll);

      const mirrorArraysForThis = !!(mirrorAll || mirrorSet.has(coll));

      for (const raw of union) {
        await upsertLocalDocWithConflictResolution(
          localCollection,
          coll,
          raw,
          stats,
          { mirrorArrays: mirrorArraysForThis }
        );
        stats.upsertedOrUpdated++;
      }

      if (mirrorAll || mirrorSet.has(coll)) {
        const remoteIds = new Set(union.map(d => String(d._id)));
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
      const aliasNote = remoteNames.length > 1 ? ` (aliases: ${remoteNames.join(', ')})` : '';
      console.log(`[syncService] pulled ${coll}${aliasNote} (db="${remoteDb.databaseName}"): remote=${stats.remoteTotal}, upserted=${stats.upsertedOrUpdated}, deletedLocal=${stats.deletedLocal}${stats.conflictsResolved ? `, conflictsResolved=${stats.conflictsResolved}` : ''} ${mirrorAll ? '[mirrorAll]' : (mirrorSet.has(coll) ? '[mirror]' : '')}`);
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
        ? pullCollectionsEnv
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
      // si no pidieron cols, devolvemos todas las canónicas detectadas (canonicalizando)
      let collections = cols.length ? cols : (await db.listCollections().toArray()).map(c => canonicalizeName(c.name));
      collections = Array.from(new Set(collections));
      const out = {};
      for (const c of collections) {
        try {
          let total = 0;
          for (const name of getRemoteNames(c)) {
            try {
              total += await db.collection(name).countDocuments();
            } catch (_) {}
          }
          out[c] = total;
        } catch (e) {
          out[c] = `err: ${e.message}`;
        }
      }
      return { remoteDbName: db.databaseName, counts: out };
    }
  };
}

module.exports = { startPeriodicSync, connectRemote, syncTick };
