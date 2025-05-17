const express = require('express');
const router = express.Router();
const {
    obtenerClientes, 
    obtenerClientePorNombre, 
    crearClienteSiNoExiste, 
    eliminarTodosLosClientes 
} = require('../controllers/clienteControllers');

router.get('/', obtenerClientes);
router.get('/:nombre', obtenerClientePorNombre);
router.post('/', crearClienteSiNoExiste);
router.delete('/', eliminarTodosLosClientes); 

module.exports = router;