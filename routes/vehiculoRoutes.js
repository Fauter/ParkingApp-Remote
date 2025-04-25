const express = require('express');
const { 
    createVehiculo, 
    getVehiculos, 
    getVehiculoByPatente, 
    getTiposVehiculo,
    asignarAbono, 
    registrarEntrada,
    registrarSalida,
    eliminarTodosLosVehiculos
} = require('../controllers/vehiculoControllers');
const router = express.Router();

router.post('/', createVehiculo);
router.get('/', getVehiculos);
router.get('/tipos', getTiposVehiculo);
router.get('/:patente', getVehiculoByPatente);
router.put('/:patente/registrarEntrada', registrarEntrada); 
router.put('/:patente/registrarSalida', registrarSalida); 
router.put('/:patente/asignarAbono', asignarAbono);
router.delete("/", eliminarTodosLosVehiculos); 

module.exports = router;