const express = require('express');
const router = express.Router();
const {
    obtenerClientes,
    obtenerClientePorNombre,
    obtenerClientePorId,
    crearClienteSiNoExiste,
    marcarClienteComoAbonado,
    eliminarTodosLosClientes,
    actualizarPrecioAbono,
    desabonarCliente,
    renovarAbono
} = require('../controllers/clienteControllers');

router.get('/', obtenerClientes);
router.get('/nombre/:nombreApellido', obtenerClientePorNombre); 
router.get('/id/:id', obtenerClientePorId); 
router.post('/', crearClienteSiNoExiste);
router.put('/marcar-abonado', marcarClienteComoAbonado);
router.put('/:id/actualizar-precio-abono', actualizarPrecioAbono);
router.put('/:id/desabonar', desabonarCliente);
router.post('/:id/renovar-abono', renovarAbono);
router.delete('/', eliminarTodosLosClientes);

module.exports = router;