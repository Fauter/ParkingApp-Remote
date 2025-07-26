require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');

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
const fotoRoutes = require('./routes/fotoRoutes');
const impresoraRoutes = require('./routes/impresoraRoutes');


const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://admin.garageia.com',
  'https://operador.garageia.com',
  'app://*', // Para Electron
  'file://*' // Para Electron en desarrollo
];

// CORS configurado con credenciales y whitelist de orígenes
// app.use(cors({
//   origin: function(origin, callback) {
//     if (!origin) return callback(null, true); // Postman o sin origen
//     if (allowedOrigins.includes(origin)) return callback(null, true);
//     return callback(new Error('No permitido por CORS'));
//   },
//   credentials: true,
// }));

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      return callback(null, true);
    }
    return callback(new Error('No permitido por CORS'));
  },
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Crear directorios si no existen
const uploadsDir = path.join(__dirname, 'uploads');
const fotosDir = path.join(uploadsDir, 'fotos');
const entradasDir = path.join(fotosDir, 'entradas');
const auditoriasDir = path.join(uploadsDir, 'auditorias');

[uploadsDir, fotosDir, entradasDir, auditoriasDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configurar rutas estáticas
app.use('/uploads', express.static(uploadsDir));
app.use('/uploads/fotos', express.static(fotosDir, {
  setHeaders: (res, filePath) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));
app.use('/uploads/auditorias', express.static(auditoriasDir));

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Conectado a MongoDB Atlas");
    require('./cron/turnoChecker');
  })
  .catch(err => console.error("❌ Error conectando a MongoDB:", err));

// Rutas API
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
app.use('/api/impresoras', impresoraRoutes);


// Servir frontend en producción
console.log('NODE_ENV:', process.env.NODE_ENV);

if (process.env.ELECTRON_MODE) {
  app.use((req, res, next) => {
    if (req.headers.origin && req.headers.origin.startsWith('file://')) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    next();
  });
}
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../admin.garageia.com/public_html');

  if (fs.existsSync(clientPath)) {
    app.use(express.static(clientPath));

    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
      }

      const indexPath = path.join(clientPath, 'index.html');
      if (!fs.existsSync(indexPath)) {
        console.error('❌ No se encontró index.html en:', indexPath);
        return res.status(404).send('Archivo no encontrado');
      }

      res.sendFile(indexPath);
    });
  }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`));