const express = require('express');
const router = express.Router();
const {
    obtenerClientes,
    obtenerClientePorNombre,
    obtenerClientePorId, // 👈 Agregá esto
    crearClienteSiNoExiste,
    marcarClienteComoAbonado,
    eliminarTodosLosClientes,
    actualizarPrecioAbono 
} = require('../controllers/clienteControllers');

router.get('/', obtenerClientes);
router.get('/nombre/:nombreApellido', obtenerClientePorNombre); 
router.get('/id/:id', obtenerClientePorId); 
router.post('/', crearClienteSiNoExiste);
router.put('/marcar-abonado', marcarClienteComoAbonado);
router.put('/:id/actualizar-precio-abono', actualizarPrecioAbono);
router.delete('/', eliminarTodosLosClientes); 

module.exports = router;