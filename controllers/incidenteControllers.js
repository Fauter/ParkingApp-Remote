const Incidente = require('../models/Incidente');

exports.create = async (req, res) => {
  try {
    const nuevoIncidente = new Incidente(req.body);
    const saved = await nuevoIncidente.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const incidentes = await Incidente.find();
    res.json(incidentes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const incidente = await Incidente.findById(req.params.id);
    if (!incidente) return res.status(404).json({ error: 'Incidente no encontrado' });
    res.json(incidente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateById = async (req, res) => {
  try {
    const actualizado = await Incidente.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!actualizado) return res.status(404).json({ error: 'Incidente no encontrado' });
    res.json(actualizado);
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
