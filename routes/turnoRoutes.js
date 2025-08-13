const express = require('express');
const router = express.Router();
const { 
    crearTurno,
    obtenerTurnos, 
    obtenerTurnosPorPatente,
    eliminarTodosLosTurnos, 
    desactivarTurnoPorPatente,
    desactivarTurno, }
= require('../controllers/turnoControllers');

router.post('/', crearTurno);
router.get('/', obtenerTurnos);
router.get('/:patente', obtenerTurnosPorPatente);
router.delete('/', eliminarTodosLosTurnos)
router.patch('/desactivar/:id', desactivarTurno);
router.patch('/desactivar-por-patente/:patente', desactivarTurnoPorPatente);


module.exports = router;
