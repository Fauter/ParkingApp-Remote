require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');

// ==== Rutas (idénticas a tu local) ====
const authRoutes = require('./routes/authRoutes.js');
const vehiculoRoutes = require('./routes/vehiculoRoutes');
const abonoRoutes = require('./routes/abonoRoutes');
const tipoVehiculoRoutes = require('./routes/tipoVehiculoRoutes');
const movimientoRoutes = require('./routes/movimientoRoutes');
const movimientoClienteRoutes = require('./routes/movimientoClienteRoutes');
const tarifaRoutes = require('./routes/tarifaRoutes');
const preciosRoutes = require('./routes/precios');
const parametrosRoutes = require('./routes/parametros.js');
const calcularTarifaRoutes = require('./routes/calcularTarifaRoutes.js');
const turnoRoutes = require('./routes/turnoRoutes.js');
const clienteRoutes = require('./routes/clienteRoutes.js');
const promoRoutes = require('./routes/promoRoutes.js');
const cierreDeCajaRoutes = require('./routes/cierreDeCajaRoutes.js');
const incidenteRoutes = require('./routes/incidenteRoutes.js');
const alertaRoutes = require('./routes/alertaRoutes.js');
const auditoriaRoutes = require('./routes/auditoriaRoutes.js');
const camaraRoutes = require('./routes/camaraRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const counterRoutes = require('./routes/counterRoutes');
const fotoRoutes = require('./routes/fotoRoutes');
const impresoraRoutes = require('./routes/impresoraRoutes');
const configRoutes = require('./routes/configRoutes');

const app = express();

// ====== CORS ======
const allowedHttpOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://admin.garageia.com',
  'https://operador.garageia.com',
];
function isAllowedOrigin(origin) {
  if (!origin) return true;                    // Postman, curl, etc.
  if (origin.startsWith('app://')) return true;   // Electron empaquetado
  if (origin.startsWith('file://')) return true;  // Electron dev
  return allowedHttpOrigins.includes(origin);
}
app.use(cors({
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    cb(new Error('No permitido por CORS'));
  },
  credentials: true,
}));

// Electron extra (opcional)
if (process.env.ELECTRON_MODE) {
  app.use((req, res, next) => {
    if (req.headers.origin && req.headers.origin.startsWith('file://')) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    next();
  });
}

// ====== Parsers ======
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ====== Directorios estáticos ======
const uploadsDir = path.join(__dirname, 'uploads');
const fotosDir = path.join(uploadsDir, 'fotos');
const entradasDir = path.join(fotosDir, 'entradas');
const auditoriasDir = path.join(uploadsDir, 'auditorias');

[uploadsDir, fotosDir, entradasDir, auditoriasDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use('/uploads', express.static(uploadsDir));
app.use('/uploads/fotos', express.static(fotosDir, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));
app.use('/uploads/auditorias', express.static(auditoriasDir));

// ====== Conexión Mongo Atlas (solo remoto) ======
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error('❌ Falta MONGO_URI en .env');
  process.exit(1);
}

// Logueo de estado de conexión
mongoose.connection.on('connected', () => console.log('✅ Conectado a MongoDB Atlas'));
mongoose.connection.on('error', (err) => console.error('❌ Error MongoDB:', err));
mongoose.connection.on('disconnected', () => console.warn('⚠️ Desconectado de MongoDB'));

mongoose.connect(mongoUri, {
  serverSelectionTimeoutMS: 8000,
  maxPoolSize: 20,
}).then(() => {
  // Corre solo en el remoto y solo si lo habilitás por env
  if (process.env.CRON_ENABLED === 'true') {
    try {
      require('./cron/turnoChecker');
      console.log('⏰ turnoChecker habilitado');
    } catch (e) {
      console.error('❌ No se pudo cargar turnoChecker:', e.message);
    }
  }
}).catch((err) => {
  console.error('❌ No se pudo conectar a MongoDB Atlas:', err);
  process.exit(1);
});

// ====== Rutas API ======
app.use('/api/auth', authRoutes);
app.use('/api/vehiculos', vehiculoRoutes);
app.use('/api/abonos', abonoRoutes);
app.use('/api/tipos-vehiculo', tipoVehiculoRoutes);
app.use('/api/movimientos', movimientoRoutes);
app.use('/api/movimientosClientes', movimientoClienteRoutes);
app.use('/api/tarifas', tarifaRoutes);
app.use('/api/precios', preciosRoutes);
app.use('/api/parametros', parametrosRoutes);
app.use('/api/calcular-tarifa', calcularTarifaRoutes);
app.use('/api/turnos', turnoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/cierresDeCaja', cierreDeCajaRoutes);
app.use('/api/incidentes', incidenteRoutes);
app.use('/api/alertas', alertaRoutes);
app.use('/api/auditorias', auditoriaRoutes);
app.use('/api/camara', camaraRoutes);
app.use('/camara/sacarfoto', express.static(path.join(__dirname, 'camara', 'sacarfoto')));
app.use('/api/fotos', fotoRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/counters', counterRoutes);
app.use('/api/impresoras', impresoraRoutes);
app.use('/api/config', configRoutes);

// ====== Health ======
app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    mode: 'remoto',
    mongoose: mongoose.connection.readyState, // 1 conectado
    timestamp: new Date(),
    pid: process.pid,
    node_env: process.env.NODE_ENV || 'development',
  });
});
// simple readiness para LB/k8s
app.get('/healthz', (req, res) => {
  if (mongoose.connection.readyState === 1) return res.status(200).send('ok');
  return res.status(503).send('mongo not ready');
});

// ====== Servir frontend (opcional, como tenías) ======
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../admin.garageia.com/public_html');
  if (fs.existsSync(clientPath)) {
    app.use(express.static(clientPath));
    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      const indexPath = path.join(clientPath, 'index.html');
      if (!fs.existsSync(indexPath)) return res.status(404).send('Archivo no encontrado');
      res.sendFile(indexPath);
    });
  }
}

// ====== Error handler global ======
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR]', err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: err.message || 'Error del servidor' });
});

// ====== Start ======
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Remoto escuchando en http://0.0.0.0:${PORT}`);
  console.log('NODE_ENV:', process.env.NODE_ENV);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM -> cerrando...');
  mongoose.connection.close(false).then(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('SIGINT -> cerrando...');
  mongoose.connection.close(false).then(() => process.exit(0));
});
