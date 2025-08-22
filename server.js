// server.js
require('dotenv').config({
  path: require('path').join(__dirname, '.env')
});
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');

const app = express();
app.disable('x-powered-by');

// Helper: normaliza módulos de rutas que exportan {router}, default, etc.
const normalizeRouter = (m) => {
  if (typeof m === 'function') return m;               // ya es un Router
  if (m && typeof m === 'object') {
    return m.router || m.default || m.routes || m.route || m;
  }
  return m;
};

// =====================
// 🛡️ CORS robusto
// =====================
const DEFAULT_ALLOWED = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://admin.garageia.com',
  'https://operador.garageia.com',
  // esquemas
  'app://',
  'file://',
  'capacitor://',
  'tauri://'
];
const ENV_ALLOWED = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...DEFAULT_ALLOWED, ...ENV_ALLOWED])];

// Compila cada item a RegExp (soporta '*')
function compileOriginPatterns(list) {
  return list.map(item => {
    const s = item.replace(/\/+$/, '');
    if (s === 'null') return { type: 'null' };
    if (s.endsWith('://')) return { type: 'scheme', value: s };
    const rx = new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, m => '\\' + m).replace(/\\\*/g, '.*') + '$');
    return { type: 'regex', value: rx };
  });
}
const originPatterns = compileOriginPatterns(allowedOrigins);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === 'null') return true;
  for (const rule of originPatterns) {
    if (rule.type === 'null' && origin === 'null') return true;
    if (rule.type === 'scheme' && origin.startsWith(rule.value)) return true;
    if (rule.type === 'regex' && rule.value.test(origin)) return true;
  }
  return false;
}

app.use(cors({
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('No permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsers
const BODY_LIMIT = process.env.BODY_LIMIT || '50mb';
app.use(cookieParser());
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

// =====================
// 📂 UPLOADS (estáticos)
// =====================
const baseUploads = process.env.UPLOADS_BASE || path.join(process.cwd(), 'uploads');
const uploadsDir = path.resolve(baseUploads);
const fotosDir = path.join(uploadsDir, 'fotos');
const entradasDir = path.join(fotosDir, 'entradas');
const auditoriasDir = path.join(uploadsDir, 'auditorias');

// Cámara (sacarfoto) fuera del asar:
const camaraBaseDir = process.env.CAMARA_DIR || path.join(uploadsDir, 'camara');
const sacarfotoDir = path.join(camaraBaseDir, 'sacarfoto');

[uploadsDir, fotosDir, entradasDir, auditoriasDir, camaraBaseDir, sacarfotoDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use('/uploads', express.static(uploadsDir, {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

app.use('/uploads/fotos', express.static(fotosDir, {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Credentials', 'false');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

app.use('/uploads/auditorias', express.static(auditoriasDir, {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

app.use('/camara/sacarfoto', express.static(sacarfotoDir, {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

// =====================
// 🟢 Status básico
// =====================
app.get('/api/status', (_req, res) => {
  res.json({
    online: true,
    mode: process.env.NODE_ENV || 'development',
    timestamp: new Date(),
    dbName: mongoose?.connection?.name || null,
  });
});

/**
 * ⛑️ Handler ESPECIAL para borrar la foto temporal de la cámara.
 */
app.delete('/api/vehiculos/eliminar-foto-temporal', (_req, res) => {
  try {
    const fotoPath = path.join(sacarfotoDir, 'captura.jpg');
    if (fs.existsSync(fotoPath)) {
      fs.unlinkSync(fotoPath);
      return res.json({ msg: "Foto temporal eliminada" });
    }
    return res.json({ msg: "No se encontró foto temporal" });
  } catch (err) {
    console.error("Error al eliminar foto temporal:", err);
    return res.status(500).json({ msg: "Error del servidor", error: err.message });
  }
});

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DBNAME || 'parking',
      retryWrites: true,
      w: 'majority'
    });

    console.log('✅ Conectado a Mongo remoto:', process.env.MONGO_URI);

    // ---- Rutas ----
    const authRoutes               = require('./routes/authRoutes.js');
    const vehiculoRoutes           = require('./routes/vehiculoRoutes');
    const abonoRoutes              = require('./routes/abonoRoutes');
    const tipoVehiculoRoutes       = require('./routes/tipoVehiculoRoutes');
    const movimientoRoutes         = require('./routes/movimientoRoutes');
    const movimientoClienteRoutes  = require('./routes/movimientoClienteRoutes');
    const tarifaRoutes             = require('./routes/tarifaRoutes');
    const preciosRoutes            = require('./routes/precios');
    const parametrosRoutes         = require('./routes/parametros.js');
    const calcularTarifaRoutes     = require('./routes/calcularTarifaRoutes.js');
    const turnoRoutes              = require('./routes/turnoRoutes.js');
    const clienteRoutes            = require('./routes/clienteRoutes');
    const promoRoutes              = require('./routes/promoRoutes');
    const cierreDeCajaRoutes       = require('./routes/cierreDeCajaRoutes');
    const incidenteRoutes          = require('./routes/incidenteRoutes');
    const alertaRoutes             = require('./routes/alertaRoutes');
    const auditoriaRoutes          = require('./routes/auditoriaRoutes');
    const camaraRoutes             = require('./routes/camaraRoutes');
    const ticketRoutes             = require('./routes/ticketRoutes');
    const counterRoutes            = require('./routes/counterRoutes');
    const fotoRoutes               = require('./routes/fotoRoutes');
    const impresoraRoutes          = require('./routes/impresoraRoutes');
    const configRoutes             = require('./routes/configRoutes');

    // Montaje con normalización defensiva
    app.use('/api/auth',               normalizeRouter(authRoutes));
    app.use('/api/vehiculos',          normalizeRouter(vehiculoRoutes));
    app.use('/api/abonos',             normalizeRouter(abonoRoutes));
    app.use('/api/tipos-vehiculo',     normalizeRouter(tipoVehiculoRoutes));
    app.use('/api/movimientos',        normalizeRouter(movimientoRoutes));
    app.use('/api/movimientosClientes',normalizeRouter(movimientoClienteRoutes));
    app.use('/api/tarifas',            normalizeRouter(tarifaRoutes));
    app.use('/api/precios',            normalizeRouter(preciosRoutes));
    app.use('/api/parametros',         normalizeRouter(parametrosRoutes));
    app.use('/api/calcular-tarifa',    normalizeRouter(calcularTarifaRoutes));
    app.use('/api/turnos',             normalizeRouter(turnoRoutes));
    app.use('/api/clientes',           normalizeRouter(clienteRoutes));
    app.use('/api/promos',             normalizeRouter(promoRoutes));
    app.use('/api/cierresDeCaja',      normalizeRouter(cierreDeCajaRoutes));
    app.use('/api/incidentes',         normalizeRouter(incidenteRoutes));
    app.use('/api/alertas',            normalizeRouter(alertaRoutes));
    app.use('/api/auditorias',         normalizeRouter(auditoriaRoutes));
    app.use('/api/camara',             normalizeRouter(camaraRoutes));
    app.use('/api/fotos',              normalizeRouter(fotoRoutes));
    app.use('/api/tickets',            normalizeRouter(ticketRoutes));
    app.use('/api/ticket',             normalizeRouter(ticketRoutes));
    app.use('/api/counters',           normalizeRouter(counterRoutes));
    app.use('/api/impresoras',         normalizeRouter(impresoraRoutes));
    app.use('/api/config',             normalizeRouter(configRoutes));

    // =====================
    // Front estático (producción para Electron)
    // =====================
    if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
      const clientPath = path.join(__dirname, '..', 'front-end', 'dist');
      const indexPath = path.join(clientPath, 'index.html');

      if (fs.existsSync(indexPath)) {
        console.log(`[server] Sirviendo front desde: ${clientPath}`);
        app.use(express.static(clientPath, { index: false }));
        app.get('*', (req, res) => {
          if (req.originalUrl.startsWith('/api/')) {
            return res.status(404).json({ error: 'API route not found' });
          }
          res.sendFile(indexPath);
        });
      } else {
        console.warn('[server] front-end/dist no encontrado. Solo API disponible.');
      }
    }

    // Handler de errores global de Express
    app.use((err, req, res, next) => {
      console.error('[GLOBAL ERROR]', err);
      if (res.headersSent) return;
      res.status(err.status || 500).json({ error: err.message || 'Error del servidor' });
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`));

  } catch (err) {
    console.error('Error arrancando server:', err);
    process.exit(1);
  }
}

main();
