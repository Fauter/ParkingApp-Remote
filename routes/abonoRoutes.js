const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { registrarAbono, getAbonos, eliminarAbonos } = require('../controllers/abonoControllers');

// Configuración Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Asegurate de que esta carpeta exista
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({ storage });

// Usamos fields para múltiples archivos
const uploadFields = upload.fields([
  { name: 'fotoSeguro', maxCount: 1 },
  { name: 'fotoDNI', maxCount: 1 },
  { name: 'fotoCedulaVerde', maxCount: 1 },
  { name: 'fotoCedulaAzul', maxCount: 1 },
]);

router.get('/', getAbonos);
router.post('/', uploadFields, registrarAbono);
router.delete('/', eliminarAbonos); 

module.exports = router;
