const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CONFIG_DIR = path.join(__dirname, '..', 'configuracion');
const CONFIG_FILE = path.join(CONFIG_DIR, 'impresora.json');
const PYTHON_SCRIPT = path.join(__dirname, '..', 'services', 'listar_impresoras.py');

if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

exports.getImpresoras = (req, res) => {
  const python = spawn('python', [PYTHON_SCRIPT]);

  let salida = '';
  python.stdout.on('data', data => salida += data.toString());
  python.stderr.on('data', err => console.error('Error PY:', err.toString()));

  python.on('close', () => {
    try {
      const data = JSON.parse(salida);

      if (data.error) return res.status(500).json({ error: data.error });

      let impresoraPredeterminada = data.default || '';

      // Prioridad: la que está guardada en impresora.json > default del sistema
      if (fs.existsSync(CONFIG_FILE)) {
        try {
          const json = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
          if (json.impresora) impresoraPredeterminada = json.impresora;
        } catch (e) {
          console.error('⚠️ Error leyendo archivo impresora.json:', e);
        }
      }

      // Validar que la impresora predeterminada esté en la lista
      if (!impresoraPredeterminada || !data.impresoras.includes(impresoraPredeterminada)) {
        impresoraPredeterminada = data.impresoras.length > 0 ? data.impresoras[0] : '';
      }

      // Ordenar: predeterminada primero, luego el resto sin repetir
      const impresorasSinRepetir = data.impresoras.filter(i => i !== impresoraPredeterminada);

      res.json({
        default: impresoraPredeterminada,
        impresoras: [impresoraPredeterminada, ...impresorasSinRepetir]
      });
    } catch (e) {
      console.error('❌ Error parseando salida de Python:', e);
      res.status(500).json({ error: 'Error procesando impresoras' });
    }
  });
};

exports.setImpresora = (req, res) => {
  const { impresora } = req.body;
  if (!impresora || typeof impresora !== 'string') {
    return res.status(400).json({ error: 'Nombre de impresora inválido' });
  }

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ impresora }, null, 2));
    res.json({ message: '✅ Impresora guardada correctamente' });
  } catch (e) {
    console.error('❌ Error guardando impresora:', e);
    res.status(500).json({ error: 'No se pudo guardar la impresora' });
  }
};
