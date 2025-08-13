const Promo = require('../models/Promo');

// Crear promo
exports.crearPromo = async (req, res) => {
  try {
    const nuevaPromo = new Promo(req.body);
    const guardada = await nuevaPromo.save();
    res.status(201).json(guardada);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Obtener todas las promos
exports.obtenerPromos = async (req, res) => {
  try {
    const promos = await Promo.find();
    res.status(200).json(promos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Editar promo
exports.editarPromo = async (req, res) => {
  try {
    const actualizada = await Promo.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!actualizada) return res.status(404).json({ error: 'Promo no encontrada' });
    res.status(200).json(actualizada);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Eliminar promo
exports.eliminarPromo = async (req, res) => {
  try {
    const eliminada = await Promo.findByIdAndDelete(req.params.id);
    if (!eliminada) return res.status(404).json({ error: 'Promo no encontrada' });
    res.status(200).json({ mensaje: 'Promo eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
