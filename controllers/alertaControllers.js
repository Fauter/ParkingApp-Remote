// controllers/alertaControllers.js
const Alerta = require('../models/Alerta');
const mongoose = require('mongoose');

// 💡 Ajustá si tu modelo se llama distinto
const User = require('../models/User');

const isObjectIdString = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
const pickUserName = (u) => u?.nombre || u?.name || u?.username || u?.email || null;

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

exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    const { operadorId, operadorNombre } = await extractOperador(req.body);

    if (operadorId) payload.operadorId = operadorId;
    if (operadorNombre) {
      payload.operadorNombre = operadorNombre;
      payload.operador = operadorNombre;
    }

    const saved = await Alerta.create(payload);
    res.status(201).json(normalizeOut(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const alertas = await Alerta.find().lean();

    const ids = [
      ...new Set(
        alertas
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

    const out = alertas.map(d => normalizeOut(d, usersById));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const alerta = await Alerta.findById(req.params.id).lean();
    if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' });

    let usersById = {};
    if (typeof alerta.operador === 'string' && isObjectIdString(alerta.operador)) {
      try {
        const u = await User.findById(alerta.operador).select('nombre name username email').lean();
        if (u) usersById[alerta.operador] = pickUserName(u) || u._id.toString();
      } catch (_) {}
    }

    res.json(normalizeOut(alerta, usersById));
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

    const actualizada = await Alerta.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!actualizada) return res.status(404).json({ error: 'Alerta no encontrada' });

    res.json(normalizeOut(actualizada));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    await Alerta.deleteMany();
    res.json({ message: 'Todas las alertas fueron eliminadas' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
