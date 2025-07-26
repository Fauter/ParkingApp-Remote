const express = require('express');
const router = express.Router();
const impresoraController = require('../controllers/impresoraControllers');

router.get('/', impresoraController.getImpresoras);
router.post('/', impresoraController.setImpresora);

module.exports = router;
