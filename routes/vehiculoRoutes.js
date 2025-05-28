const express = require('express');
const Vehiculo = require('../models/Vehiculo');
const { 
    createVehiculo, 
    getVehiculos, 
    getVehiculoByPatente, 
    getVehiculoById,
    getTiposVehiculo,
    asignarAbonoAVehiculo, 
    registrarEntrada,
    registrarSalida,
    eliminarTodosLosVehiculos
} = require('../controllers/vehiculoControllers');

const router = express.Router();

router.put('/:patente/costoTotal', async (req, res) => {
  const { patente } = req.params;
  const { costoTotal } = req.body;

  if (typeof costoTotal !== "number") {
    return res.status(400).json({ msg: "Costo total inválido" });
  }

  try {
    const vehiculo = await Vehiculo.findOne({ patente });
    if (!vehiculo) {
      return res.status(404).json({ msg: "Vehículo no encontrado" });
    }

    if (!vehiculo.estadiaActual) {
      return res.status(400).json({ msg: "No existe estadiaActual para este vehículo" });
    }

    vehiculo.estadiaActual.costoTotal = costoTotal;
    await vehiculo.save();

    res.json({ msg: "Costo total actualizado", vehiculo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

router.post('/', createVehiculo);
router.get('/', getVehiculos);
router.get('/tipos', getTiposVehiculo);
router.get('/:patente', getVehiculoByPatente);
router.get('/id/:id', getVehiculoById);
router.put('/:patente/registrarEntrada', registrarEntrada); 
router.put('/:patente/registrarSalida', registrarSalida); 
router.put("/asignar-abono/:patente", asignarAbonoAVehiculo);
router.delete("/", eliminarTodosLosVehiculos); 

module.exports = router;
