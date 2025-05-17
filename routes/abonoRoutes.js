const express = require('express');
const multer  = require('multer');
const path    = require('path');            
const {
  getAbonos,
  getAbonoPorId,
  registrarAbono,
  eliminarAbonos
} = require('../controllers/abonoControllers');

const router = express.Router();

// Configuración Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Usa path.extname para mantener la extensión original
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Campos de archivos que espera el endpoint
const uploadFields = upload.fields([
  { name: 'fotoSeguro',      maxCount: 1 },
  { name: 'fotoDNI',          maxCount: 1 },
  { name: 'fotoCedulaVerde',  maxCount: 1 },
  { name: 'fotoCedulaAzul',   maxCount: 1 },
]);

// Rutas
router.get('/', getAbonos);
router.get('/:id', getAbonoPorId);
router.post('/registrar-abono', uploadFields, registrarAbono);
router.delete('/', eliminarAbonos);

module.exports = router;
