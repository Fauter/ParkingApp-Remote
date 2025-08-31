const CierreParcial = require('../models/CierreParcial');
const User = require('../models/User');

// Utils
const isObjectIdString = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
const pickUserName = (u) => u?.nombre || u?.name || u?.username || u?.email || null;
const sanitizeStr = (v, max) => {
  if (v == null) return '';
  const s = String(v).trim();
  return max ? s.slice(0, max) : s;
};
const numFrom = (v, def = null) => {
  if (v === '' || v === null || v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// Extrae operador desde body (soporta objeto, id string, nombre string)
async function extractOperador(body) {
  let operadorId = null;
  let operadorNombre = null;

  const op = body?.operador;

  if (typeof op === 'object' && op !== null) {
    operadorId = op._id?.toString?.() || op.id || null;
    operadorNombre = op.nombre || op.name || op.username || op.email || body.operadorNombre || null;
  } else if (typeof op === 'string') {
    if (op === '[object Object]') {
      operadorNombre = null;
    } else if (isObjectIdString(op)) {
      operadorId = op;
    } else {
      operadorNombre = op;
    }
  } else if (!op) {
    operadorNombre = body?.operadorNombre || null;
    operadorId = body?.operadorId || null;
  }

  if (operadorId && !operadorNombre) {
    try {
      const user = await User.findById(operadorId).select('nombre name username email').lean();
      operadorNombre = pickUserName(user) || operadorId;
    } catch (_) {}
  }

  return { operadorId, operadorNombre };
}

// Normaliza salida: resuelve operador a nombre visible
function normalizeOut(doc, usersById = {}) {
  const d = doc.toObject ? doc.toObject() : doc;

  let nombre = d.operadorNombre || null;

  if (!nombre) {
    const op = d.operador;
    if (typeof op === 'string') {
      if (op === '[object Object]') {
        nombre = null;
      } else if (isObjectIdString(op)) {
        nombre = usersById[op] || op;
      } else {
        nombre = op;
      }
    } else if (op && typeof op === 'object') {
      nombre = pickUserName(op) || op._id || null;
    }
  }

  return { ...d, operador: nombre || '---' };
}

// CREATE
exports.create = async (req, res) => {
  try {
    const payload = {};

    // Campos básicos obligatorios
    payload.fecha = sanitizeStr(req.body?.fecha);
    payload.hora  = sanitizeStr(req.body?.hora);

    // Monto
    const monto = numFrom(req.body?.monto);
    if (monto == null || monto < 0) {
      return res.status(400).json({ error: 'Monto inválido' });
    }
    payload.monto = monto;

    // Nuevos: nombre(<=60) y texto(<=300)
    payload.nombre = sanitizeStr(req.body?.nombre, 60);
    payload.texto  = sanitizeStr(req.body?.texto, 300);

    // Operador
    const { operadorId, operadorNombre } = await extractOperador(req.body);
    if (operadorId) payload.operadorId = operadorId;
    if (operadorNombre) payload.operadorNombre = sanitizeStr(operadorNombre, 120);

    // "operador" (requerido por esquema) = nombre visible
    payload.operador = payload.operadorNombre || '---';

    // Validaciones mínimas de fecha/hora
    if (!payload.fecha || !payload.hora) {
      return res.status(400).json({ error: 'Fecha y hora son obligatorias' });
    }

    const saved = await CierreParcial.create(payload);
    res.status(201).json(normalizeOut(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET ALL
exports.getAll = async (req, res) => {
  try {
    const cierres = await CierreParcial.find().lean();

    const ids = [
      ...new Set(
        cierres
          .map(d => d.operadorId || d.operador)
          .filter(v => typeof v === 'string' && isObjectIdString(v))
      ),
    ];

    let usersById = {};
    if (ids.length) {
      try {
        const users = await User.find({ _id: { $in: ids } })
          .select('nombre name username email')
          .lean();
        usersById = Object.fromEntries(
          users.map(u => [u._id.toString(), pickUserName(u) || u._id.toString()])
        );
      } catch (_) {}
    }

    const out = cierres.map(d => normalizeOut(d, usersById));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET BY ID
exports.getById = async (req, res) => {
  try {
    const cierre = await CierreParcial.findById(req.params.id).lean();
    if (!cierre) return res.status(404).json({ error: 'Cierre no encontrado' });

    let usersById = {};
    const cand = cierre.operadorId || cierre.operador;
    if (typeof cand === 'string' && isObjectIdString(cand)) {
      try {
        const u = await User.findById(cand).select('nombre name username email').lean();
        if (u) usersById[cand] = pickUserName(u) || u._id.toString();
      } catch (_) {}
    }

    res.json(normalizeOut(cierre, usersById));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE BY ID
exports.updateById = async (req, res) => {
  try {
    const payload = {};

    if (req.body?.fecha !== undefined) payload.fecha = sanitizeStr(req.body.fecha);
    if (req.body?.hora  !== undefined) payload.hora  = sanitizeStr(req.body.hora);

    if (req.body?.monto !== undefined) {
      const n = numFrom(req.body.monto);
      if (n == null || n < 0) return res.status(400).json({ error: 'Monto inválido' });
      payload.monto = n;
    }

    if (req.body?.nombre !== undefined) payload.nombre = sanitizeStr(req.body.nombre, 60);
    if (req.body?.texto  !== undefined) payload.texto  = sanitizeStr(req.body.texto, 300);

    if (req.body?.operador !== undefined || req.body?.operadorId !== undefined || req.body?.operadorNombre !== undefined) {
      const { operadorId, operadorNombre } = await extractOperador(req.body);
      if (operadorId !== null) payload.operadorId = operadorId || undefined;
      if (operadorNombre !== null) payload.operadorNombre = sanitizeStr(operadorNombre, 120);
      if (operadorNombre) payload.operador = payload.operadorNombre;
    }

    const actualizado = await CierreParcial.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!actualizado) return res.status(404).json({ error: 'Cierre no encontrado' });

    res.json(normalizeOut(actualizado));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE ALL
exports.deleteAll = async (req, res) => {
  try {
    await CierreParcial.deleteMany();
    res.json({ message: 'Todos los cierres parciales fueron eliminados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
