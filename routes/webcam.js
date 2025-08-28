const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.post('/', (req, res) => {
  const { webcam } = req.body;
  // Guarda el deviceId en un archivo de configuración
  fs.writeFileSync(path.join(__dirname, '../configuracion/webcam.json'), JSON.stringify({ webcam }), 'utf8');
  res.json({ ok: true });
});

module.exports = router;