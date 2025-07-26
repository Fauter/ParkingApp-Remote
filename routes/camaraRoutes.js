const fs = require('fs');
const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();

const configPath = path.join(__dirname, '..', 'camara', 'config.txt');

// POST /set-ip -> guarda IP en config.txt con formato RTSP_URL=...
router.post('/set-ip', (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).send('Falta la IP');

  const rtspUrl = `RTSP_URL=rtsp://admin:admin@${ip}:554/streaming/channels/1\n`;
  fs.writeFile(configPath, rtspUrl, 'utf8', (err) => {
    if (err) {
      console.error('❌ Error al escribir el archivo:', err);
      return res.status(500).send('Error al guardar la IP');
    }
    console.log('✅ IP de cámara actualizada');
    res.send('IP actualizada correctamente');
  });
});

// GET /get-ip -> lee config.txt y devuelve la IP (solo la parte dentro del RTSP_URL)
router.get('/get-ip', (req, res) => {
  if (!fs.existsSync(configPath)) return res.status(404).send('No hay config');

  const data = fs.readFileSync(configPath, 'utf8');
  const line = data.split('\n').find(l => l.startsWith('RTSP_URL='));
  if (!line) return res.status(404).send('No se encontró RTSP_URL');

  // Extraemos la IP del RTSP_URL
  // Formato: RTSP_URL=rtsp://admin:admin@192.168.100.54:554/streaming/channels/1
  const match = line.match(/rtsp:\/\/admin:admin@(.+?):554/);
  if (!match) return res.status(500).send('Formato de RTSP_URL incorrecto');

  const ip = match[1];
  res.json({ ip });
});

// GET /captura.jpg -> envía captura.jpg si existe
router.get('/captura.jpg', (req, res) => {
  const fotoPath = path.join(__dirname, '..', 'camara', 'sacarfoto', 'captura.jpg');
  if (!fs.existsSync(fotoPath)) return res.status(404).send('No hay foto');
  res.sendFile(fotoPath);
});

// GET /capturaTest.jpg -> envía capturaTest.jpg si existe
router.get('/capturaTest.jpg', (req, res) => {
  const fotoTestPath = path.join(__dirname, '..', 'camara', 'sacarfoto', 'capturaTest.jpg');
  if (!fs.existsSync(fotoTestPath)) return res.status(404).send('No hay foto test');
  res.sendFile(fotoTestPath);
});

// GET /sacarfoto -> ejecuta sacarfoto.py que genera captura.jpg
router.get('/sacarfoto', (req, res) => {
  const scriptPath = path.join(__dirname, '..', 'camara', 'sacarfoto', 'sacarfoto.py');

  exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
    const salida = stdout.trim();
    console.log(`📸 STDOUT: ${salida}`);
    if (error || !salida.includes("OK")) {
      console.error(`❌ Error en captura: ${error?.message || 'Salida inesperada'}`);
      return res.json({ exito: false, mensaje: "No se pudo capturar la foto." });
    }
    return res.json({ exito: true, mensaje: "Foto capturada correctamente." });
  });
});

// GET /sacarfoto-test -> ejecuta sacarfoto.py con argumento para que guarde capturaTest.jpg
router.get('/sacarfoto-test', (req, res) => {
  const scriptPath = path.join(__dirname, '..', 'camara', 'sacarfoto', 'sacarfoto.py');

  exec(`python "${scriptPath}" test`, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error ejecutando el script: ${error.message}`);
      return res.status(500).send('Error al ejecutar el script test');
    }
    if (stderr) console.error(`⚠️ STDERR: ${stderr}`);
    console.log(`📸 STDOUT: ${stdout}`);
    res.send('Foto test capturada correctamente');
  });
});

module.exports = router;
