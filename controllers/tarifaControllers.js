const Tarifa = require('../models/Tarifa');

// GET todas las tarifas
exports.getTarifas = async (req, res) => {
  try {
    const tarifas = await Tarifa.find();
    res.status(200).json(tarifas);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tarifas' });
  }
};

// POST nueva tarifa
exports.createTarifa = async (req, res) => {
  try {
    const nuevaTarifa = new Tarifa(req.body);
    await nuevaTarifa.save();
    res.status(201).json(nuevaTarifa);
  } catch (err) {
    res.status(400).json({ error: 'Error al crear tarifa' });
  }
};

// PUT actualizar tarifa
exports.updateTarifa = async (req, res) => {
  try {
    const { id } = req.params;
    const tarifaActualizada = await Tarifa.findByIdAndUpdate(id, req.body, { new: true });
    res.status(200).json(tarifaActualizada);
  } catch (err) {
    res.status(400).json({ error: 'Error al actualizar tarifa' });
  }
};

// DELETE eliminar tarifa
exports.deleteTarifa = async (req, res) => {
  try {
    const { id } = req.params;
    await Tarifa.findByIdAndDelete(id);
    res.status(200).json({ mensaje: 'Tarifa eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar tarifa' });
  }
};
