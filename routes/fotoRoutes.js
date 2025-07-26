const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Ruta para servir fotos de entradas
router.get('/entradas/:nombreFoto', (req, res) => {
  try {
    const fotoPath = path.join(__dirname, '../uploads/fotos/entradas', req.params.nombreFoto);
    
    // Verificar si el archivo existe
    if (!fs.existsSync(fotoPath)) {
      return res.status(404).send('Foto no encontrada');
    }

    // Enviar la foto con headers para evitar caché
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.sendFile(fotoPath);
  } catch (error) {
    console.error('Error al servir foto:', error);
    res.status(500).send('Error al cargar la foto');
  }
});

module.exports = router;