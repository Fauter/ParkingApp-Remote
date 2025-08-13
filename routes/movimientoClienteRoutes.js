const express = require('express');
const router = express.Router();
const {
    registrarMovimientoCliente,
    getMovimientosCliente,
    borrarTodosMovimientosCliente
} = require('../controllers/movimientoClienteControllers');

router.post('/', registrarMovimientoCliente);
router.get('/', getMovimientosCliente);
router.delete('/', borrarTodosMovimientosCliente);

module.exports = router;
