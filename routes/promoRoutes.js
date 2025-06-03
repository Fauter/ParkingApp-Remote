const express = require('express');
const router = express.Router();
const {
    obtenerPromos,
    crearPromo,
    editarPromo,
    eliminarPromo
} = require('../controllers/promoControllers');

router.get('/', obtenerPromos);
router.post('/', crearPromo);
router.put('/:id', editarPromo);
router.delete('/:id', eliminarPromo);

module.exports = router;
