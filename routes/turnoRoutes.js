const express = require('express');
const router = express.Router();
const { crearTurno, obtenerTurnos, eliminarTodosLosTurnos } = require('../controllers/turnoControllers');

router.post('/', crearTurno);
router.get('/', obtenerTurnos);
router.delete('/', eliminarTodosLosTurnos)

module.exports = router;
