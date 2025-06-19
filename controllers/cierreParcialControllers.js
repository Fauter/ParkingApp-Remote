const CierreParcial = require('../models/CierreParcial');

exports.create = async (req, res) => {
  try {
    const nuevoCierre = new CierreParcial(req.body);
    const saved = await nuevoCierre.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const cierres = await CierreParcial.find();
    res.json(cierres);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const cierre = await CierreParcial.findById(req.params.id);
    if (!cierre) return res.status(404).json({ error: 'Cierre no encontrado' });
    res.json(cierre);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateById = async (req, res) => {
  try {
    const actualizado = await CierreParcial.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!actualizado) return res.status(404).json({ error: 'Cierre no encontrado' });
    res.json(actualizado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    await CierreParcial.deleteMany();
    res.json({ message: 'Todos los cierres parciales fueron eliminados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
