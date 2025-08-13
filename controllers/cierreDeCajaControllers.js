const CierreDeCaja = require('../models/CierreDeCaja'); // Asegurate que el modelo esté bien definido

// Obtener todos los cierres
const getAll = async (req, res) => {
  try {
    const cierres = await CierreDeCaja.find();
    res.json(cierres);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener uno por id
const getById = async (req, res) => {
  try {
    const cierre = await CierreDeCaja.findById(req.params.id);
    if (!cierre) return res.status(404).json({ message: 'No encontrado' });
    res.json(cierre);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear nuevo cierre
const create = async (req, res) => {
  try {
    const cierre = new CierreDeCaja(req.body);
    await cierre.save();
    res.status(201).json(cierre);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar cierre por id (aquí incluimos el update para el botón "Retirado")
const updateById = async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body; // puede ser { retirado: true } o cualquier otro campo a actualizar

    const cierreActualizado = await CierreDeCaja.findByIdAndUpdate(id, updateData, { new: true });

    if (!cierreActualizado) return res.status(404).json({ message: 'Cierre de caja no encontrado' });

    res.json(cierreActualizado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar todos los cierres
const deleteAll = async (req, res) => {
  try {
    await CierreDeCaja.deleteMany({});
    res.json({ message: 'Todos los cierres eliminados' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  updateById,
  deleteAll,
};
