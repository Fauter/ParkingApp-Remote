// controllers/incidenteControllers.js
const Incidente = require('../models/Incidente');
const mongoose = require('mongoose');

// 💡 Ajustá este require si tu modelo de usuario se llama distinto:
const User = require('../models/User'); // Cambiar a ../models/Usuario si corresponde

const isObjectIdString = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
const pickUserName = (u) => u?.nombre || u?.name || u?.username || u?.email || null;

async function extractOperador(body) {
  // Acepta: string nombre, string ObjectId, objeto usuario, o campos operadorNombre/operadorId
  let operadorId = null;
  let operadorNombre = null;

  const op = body?.operador;

  if (typeof op === 'object' && op !== null) {
    operadorId = op._id?.toString?.() || op.id || null;
    operadorNombre = op.nombre || op.name || op.username || op.email || body.operadorNombre || null;
  } else if (typeof op === 'string') {
    if (op === '[object Object]') {
      // basura serializada
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

function normalizeOut(doc, usersById = {}) {
  const d = doc.toObject ? doc.toObject() : doc;

  let nombre = d.operadorNombre || null;

  if (!nombre) {
    const op = d.operador;
    if (typeof op === 'string') {
      if (op === '[object Object]') {
        nombre = null;
      } else if (isObjectIdString(op)) {
        nombre = usersById[op] || op; // fallback al id si no hay nombre
      } else {
        nombre = op;
      }
    } else if (op && typeof op === 'object') {
      nombre = pickUserName(op) || op._id || null;
    }
  }

  return { ...d, operador: nombre || '---' };
}

exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    const { operadorId, operadorNombre } = await extractOperador(req.body);

    // Persistimos denormalizado para futuras lecturas
    if (operadorId) payload.operadorId = operadorId;
    if (operadorNombre) {
      payload.operadorNombre = operadorNombre;
      payload.operador = operadorNombre; // compatibilidad con FE actual
    }

    const saved = await Incidente.create(payload);
    // Normalizamos salida por si el modelo no tiene esos campos
    res.status(201).json(normalizeOut(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const incidentes = await Incidente.find().lean();

    // Resolver nombres para los que guardaron ObjectId en 'operador'
    const ids = [
      ...new Set(
        incidentes
          .map(d => d.operador)
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

    const out = incidentes.map(d => normalizeOut(d, usersById));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const incidente = await Incidente.findById(req.params.id).lean();
    if (!incidente) return res.status(404).json({ error: 'Incidente no encontrado' });

    let usersById = {};
    if (typeof incidente.operador === 'string' && isObjectIdString(incidente.operador)) {
      try {
        const u = await User.findById(incidente.operador).select('nombre name username email').lean();
        if (u) usersById[incidente.operador] = pickUserName(u) || u._id.toString();
      } catch (_) {}
    }

    res.json(normalizeOut(incidente, usersById));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateById = async (req, res) => {
  try {
    const payload = { ...req.body };
    const { operadorId, operadorNombre } = await extractOperador(req.body);

    if (operadorId) payload.operadorId = operadorId;
    if (operadorNombre) {
      payload.operadorNombre = operadorNombre;
      payload.operador = operadorNombre;
    }

    const actualizado = await Incidente.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!actualizado) return res.status(404).json({ error: 'Incidente no encontrado' });

    res.json(normalizeOut(actualizado));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    await Incidente.deleteMany();
    res.json({ message: 'Todos los incidentes fueron eliminados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
