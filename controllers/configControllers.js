const fs = require('fs');
const path = require('path');

exports.getConfig = (req, res) => {
  const config = {};

  try {
    const impresoraPath = path.join(__dirname, '..', 'configuracion', 'impresora.json');
    const camaraPath = path.join(__dirname, '..', 'camara', 'config.txt');

    if (fs.existsSync(impresoraPath)) {
      config.impresora = JSON.parse(fs.readFileSync(impresoraPath, 'utf-8'));
    }

    if (fs.existsSync(camaraPath)) {
      const raw = fs.readFileSync(camaraPath, 'utf-8');
      const match = raw.match(/rtsp:\/\/admin:admin@(.+?):554/);
      if (match) config.camara = { ip: match[1] };
    }

    res.json(config);
  } catch (e) {
    console.error('❌ Error leyendo config:', e.message);
    res.status(500).json({ error: 'Error leyendo configuración' });
  }
};
