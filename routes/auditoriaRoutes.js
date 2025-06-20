const express = require('express');
const router = express.Router();
const { 
  generarAuditoria, 
  obtenerAuditorias,
  descargarAuditoria,
  deleteAllAuditorias
} = require('../controllers/auditoriaControllers');

router.post('/', generarAuditoria);
router.get('/', obtenerAuditorias);
router.get('/descargar/:id', descargarAuditoria);
router.delete('/', deleteAllAuditorias);

module.exports = router;