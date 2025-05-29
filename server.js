require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

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

const app = express();

const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:5173',
  'https://admin.garageia.com',
  'https://operador.garageia.com'
];

// CORS configurado con credenciales y whitelist de orígenes
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // Postman o sin origen
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('No permitido por CORS'));
  },
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Carpeta estática uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
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

// Servir frontend en producción
console.log('NODE_ENV:', process.env.NODE_ENV);
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../admin.garageia.com/public_html');
  console.log('Client Path:', clientPath);  // <--- Acá el log
  app.use(express.static(clientPath));

  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api/')) return next();
    
    // Si está pidiendo un archivo con extensión (js, css, png, etc.), no devolver index.html
    if (path.extname(req.originalUrl)) return res.sendStatus(404);

    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`));
