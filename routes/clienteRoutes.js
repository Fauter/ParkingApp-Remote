const express = require('express');
const router = express.Router();
const {
    obtenerClientes, 
    obtenerClientePorNombre, 
    crearClienteSiNoExiste, 
    marcarClienteComoAbonado,
    eliminarTodosLosClientes 
} = require('../controllers/clienteControllers');

router.get('/', obtenerClientes);
router.get('/:nombre', obtenerClientePorNombre);
router.post('/', crearClienteSiNoExiste);
router.put('/marcar-abonado', marcarClienteComoAbonado);
router.delete('/', eliminarTodosLosClientes); 

module.exports = router;