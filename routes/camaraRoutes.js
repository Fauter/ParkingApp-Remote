const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();

router.get('/sacarfoto', (req, res) => {
  const scriptPath = path.join(__dirname, '..', 'camara', 'sacarfoto', 'sacarfoto.py');

  exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error ejecutando el script: ${error.message}`);
      return res.status(500).send('Error al ejecutar el script');
    }
    if (stderr) {
      console.error(`⚠️ STDERR: ${stderr}`);
    }
    console.log(`📸 STDOUT: ${stdout}`);
    res.send('Foto capturada correctamente');
  });
});

module.exports = router;
