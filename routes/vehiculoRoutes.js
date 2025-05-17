const express = require('express');
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