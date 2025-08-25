const CierreDeCaja = require('../models/CierreDeCaja');

// Obtener todos los cierres
const getAll = async (req, res) => {
  try {
    const cierres = await CierreDeCaja.find()
      .populate("operador", "nombre apellido username"); // 👈 siempre populamos
    res.json(cierres);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener uno por id
const getById = async (req, res) => {
  try {
    const cierre = await CierreDeCaja.findById(req.params.id)
      .populate("operador", "nombre apellido username"); // 👈 populamos también
    if (!cierre) return res.status(404).json({ message: 'No encontrado' });
    res.json(cierre);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear nuevo cierre
const create = async (req, res) => {
  try {
    const { fecha, hora, totalRecaudado, dejoEnCaja, totalRendido, operador } = req.body;

    if (!operador) {
      return res.status(400).json({ message: "El campo 'operador' es obligatorio" });
    }

    // 👇 Nos aseguramos de guardar solo el ID
    const operadorId = typeof operador === "object" ? operador._id : operador;

    const cierre = new CierreDeCaja({
      fecha,
      hora,
      totalRecaudado,
      dejoEnCaja,
      totalRendido,
      operador: operadorId,
      retirado: false
    });

    await cierre.save();

    // 👇 Devolvemos con populate para que frontend reciba el user completo
    const cierrePopulado = await cierre.populate("operador", "nombre apellido username");

    res.status(201).json(cierrePopulado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar cierre por id
const updateById = async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;

    // 👇 aseguramos que operador quede como ObjectId
    if (updateData.operador && typeof updateData.operador === "object") {
      updateData.operador = updateData.operador._id;
    }

    const cierreActualizado = await CierreDeCaja.findByIdAndUpdate(id, updateData, { new: true })
      .populate("operador", "nombre apellido username");

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
