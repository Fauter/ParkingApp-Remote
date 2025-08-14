// middlewares/offlineMiddleware.js
const Outbox = require('../models/Outbox');
const routeToCollection = require('../configuracion/routeToCollection');

const WRAPPED = Symbol('offline_mw_wrapped');

// Rutas que no deben guardarse en el outbox
const excludedPaths = [
  '/api/auth/login',
  '/api/tickets/barcode',
  '/api/tickets/imprimir',
  '/api/sync/run-now',       
  '/api/vehiculos/eliminar-foto-temporal'
];

// Busca el mapping por prefijo (match más largo)
function findCollectionForPath(path) {
  const keys = Object.keys(routeToCollection).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (path.startsWith(k)) return routeToCollection[k];
  }
  return null;
}

// Heurística simple para detectar ids en segmentos de URL
function findIdInPath(path) {
  const parts = path.split('/').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (/^[a-fA-F0-9]{24}$/.test(p) || /^[0-9]+$/.test(p)) return p;
  }
  return null;
}

// Determina si la respuesta parece un "envelope" tipo { msg, token } sin documento
function looksLikeEnvelope(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (!keys.length) return true;
  const allowed = new Set(['msg', 'message', 'ok', 'token', 'status', 'error']);
  const hasOnlyEnvelopeKeys = keys.every(k => allowed.has(k));
  const hasDomainKeys = keys.some(k =>
    ['_id','id','user','ticket','vehiculo','cliente','data','result','document','item','payload','username','email'].includes(k)
  );
  return hasOnlyEnvelopeKeys && !hasDomainKeys;
}

// Función mejorada para detectar si un valor parece un documento válido
function looksLikeValidDocument(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (obj._id !== undefined) return true; // típico de Mongo/Mongoose
  const envelopeKeys = new Set(['msg', 'message', 'ok', 'token', 'status', 'error']);
  const keys = Object.keys(obj);
  const hasNonEnvelopeKeys = keys.some(k => !envelopeKeys.has(k));
  return hasNonEnvelopeKeys && keys.length > 0;
}

// Función mejorada para seleccionar documento
function pickDocumentForOutbox(method, collection, reqBody, capturedBody) {
  // Si capturedBody es un string (mensaje o imagen), preferir reqBody en POST
  if (typeof capturedBody === 'string') {
    return method === 'POST' ? reqBody : {};
  }

  let candidate = capturedBody || reqBody || {};

  // Ignorar buffers/binarios
  if (candidate instanceof Buffer || candidate?.type === 'Buffer') {
    return method === 'POST' ? reqBody : {};
  }

  // Si viene wrapper típico, intentar extraer objeto real
  if (candidate && typeof candidate === 'object') {
    const keysToTry = ['user','ticket','vehiculo','data','result','document','cliente','item','payload'];
    for (const k of keysToTry) {
      if (candidate[k] && typeof candidate[k] === 'object') {
        candidate = candidate[k];
        break;
      }
    }
  }

  // Si parece un envelope vacío, preferir reqBody
  if (!looksLikeValidDocument(candidate) && reqBody && typeof reqBody === 'object') {
    candidate = reqBody;
  }

  // Para POST, si no hay _id y reqBody tiene campos útiles, preferir reqBody
  if (
    method === 'POST' &&
    candidate && typeof candidate === 'object' && !candidate._id &&
    reqBody && typeof reqBody === 'object'
  ) {
    const hasUsefulReqBodyFields = ['username','email','ticket','vehiculo','cliente']
      .some(k => reqBody[k] !== undefined);
    const hasUsefulCandidateFields = ['_id','username','email','ticket','vehiculo','cliente']
      .some(k => candidate[k] !== undefined);
    if (hasUsefulReqBodyFields && !hasUsefulCandidateFields) {
      candidate = reqBody;
    }
  }

  // Limpieza final
  if (candidate && typeof candidate === 'object') {
    const { __v, _v, createdAt, updatedAt, ...cleanDoc } = candidate;
    return cleanDoc;
  }

  return {};
}

module.exports = function offlineMiddleware(req, res, next) {
  try {
    // ⬅️ nuevo: si piden explícitamente operación local, NO envolvemos la respuesta
    const q = req.query || {};
    const localOnly = ['1','true','yes'].includes(String(q.localOnly || req.headers['x-local-only'] || '').toLowerCase());
    if (localOnly) return next();
    // Solo mutaciones sobre /api/*
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) || !req.originalUrl.startsWith('/api/')) {
      return next();
    }

    // No procesar rutas excluidas (permitir querystring)
    if (excludedPaths.some(p => req.originalUrl.startsWith(p))) {
      return next();
    }

    const collection = findCollectionForPath(req.originalUrl);
    if (!collection) return next();

    // Evitar doble envoltura
    if (res[WRAPPED]) return next();
    res[WRAPPED] = true;

    let capturedBody = null;
    let alreadySent = false;

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      try { capturedBody = body; } catch (_) {}
      alreadySent = true;
      return originalJson(body);
    };

    const originalSend = res.send.bind(res);
    res.send = function (body) {
      try {
        if (!alreadySent) {
          if (typeof body === 'string') {
            try { capturedBody = JSON.parse(body); } catch (_) { capturedBody = body; }
          } else {
            capturedBody = body;
          }
        }
      } catch (_) {}
      alreadySent = true;
      return originalSend(body);
    };

    // Cuando la respuesta termine, procesar offline
    res.on('finish', () => {
      Promise.resolve()
        .then(async () => {
          if (res.locals && res.locals.__skipOutbox) return;
          if (!res.statusCode || res.statusCode >= 400) return;

          const method = req.method;
          const docCandidate = pickDocumentForOutbox(method, collection, req.body, capturedBody) || {};

          // Extraer id de doc o de la URL
          let idFromDoc = (docCandidate && (docCandidate._id || docCandidate.id)) || null;
          if (!idFromDoc) idFromDoc = findIdInPath(req.originalUrl);

          // Construir params
          const params = { ...req.params };
          if (idFromDoc) {
            params._id = idFromDoc;
            params.id = idFromDoc;
          }

          // Construir query base desde req.query
          const query = { ...req.query };

          // === MARCA BULK DELETE CUANDO NO HAY ID ===
          if (method === 'DELETE' && !idFromDoc) {
            // Flag que el sincronizador interpretará para deleteMany()
            query.__bulk = true; // o query.all = true;

            // Si vino un filtro explícito en body/candidato, lo pasamos (opcional)
            const candidateFilter =
              (req.body && typeof req.body === 'object' && req.body.filter) ||
              (docCandidate && typeof docCandidate === 'object' && docCandidate.filter);

            if (candidateFilter && typeof candidateFilter === 'object') {
              query.filter = candidateFilter;
            }
          }

          await Outbox.create({
            method,
            route: req.originalUrl,
            collection,
            document: docCandidate,
            params,
            query,
            status: 'pending',
            createdAt: new Date()
          });

          const extra = (method === 'DELETE' && !idFromDoc) ? ' (bulk=true)' : '';
          console.log(`[offlineMiddleware] Outbox creado: ${method} ${req.originalUrl} -> ${collection} id=${idFromDoc || '(sin id)'}${extra}`);
        })
        .catch(err => {
          console.error('[offlineMiddleware] error creando outbox post-response:', err?.message || err);
        });
    });

    return next();
  } catch (err) {
    console.error('[offlineMiddleware] fallo inicial:', err?.message || err);
    return next(err);
  }
};
