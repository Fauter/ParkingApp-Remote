const Alerta = require('../models/Alerta');

exports.create = async (req, res) => {
  try {
    const nuevaAlerta = new Alerta(req.body);
    const saved = await nuevaAlerta.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const alertas = await Alerta.find();
    res.json(alertas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const alerta = await Alerta.findById(req.params.id);
    if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' });
    res.json(alerta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateById = async (req, res) => {
  try {
    const actualizada = await Alerta.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!actualizada) return res.status(404).json({ error: 'Alerta no encontrada' });
    res.json(actualizada);
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
