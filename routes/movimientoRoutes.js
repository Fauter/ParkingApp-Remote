const express = require('express');
const router = express.Router();
const {
  registrarMovimiento,
  obtenerMovimientos,
  eliminarTodosLosMovimientos
} = require('../controllers/movimientoControllers');

router.post('/registrar', registrarMovimiento);
router.get('/', obtenerMovimientos);
router.delete('/', eliminarTodosLosMovimientos);

module.exports = router;
