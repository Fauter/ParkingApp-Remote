const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Helper interno para borrar un archivo de forma segura
async function deleteFileSafe(filePath) {
  if (!filePath) throw new Error('deleteFileSafe: falta filePath');
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  try {
    if (!fs.existsSync(abs)) {
      throw new Error('No se encontró la foto para eliminar: ' + abs);
    }
    await fs.promises.unlink(abs);
    return true;
  } catch (err) {
    throw err;
  }
}

// Ruta para servir fotos de entradas
router.get('/entradas/:nombreFoto', (req, res) => {
  try {
    const fotoPath = path.join(__dirname, '../uploads/fotos/entradas', req.params.nombreFoto);

    if (!fs.existsSync(fotoPath)) {
      return res.status(404).send('Foto no encontrada');
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.sendFile(fotoPath);
  } catch (error) {
    console.error('Error al servir foto:', error);
    res.status(500).send('Error al cargar la foto');
  }
});

// Ruta para borrar fotos de entradas
router.delete('/entradas/:nombreFoto', async (req, res) => {
  const fotoPath = path.join(__dirname, '../uploads/fotos/entradas', req.params.nombreFoto);
  try {
    await deleteFileSafe(fotoPath);
    res.status(200).send('Foto eliminada');
  } catch (err) {
    console.warn('[fotoRoutes] al borrar foto:', err.message);
    if (err.message.startsWith('No se encontró')) {
      return res.status(404).send('Foto no encontrada');
    }
    res.status(500).send('Error al eliminar la foto');
  }
});

module.exports = router;
