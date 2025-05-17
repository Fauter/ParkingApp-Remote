require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes.js');
const vehiculoRoutes = require('./routes/vehiculoRoutes'); 
const abonoRoutes = require('./routes/abonoRoutes');
const tipoVehiculoRoutes = require('./routes/tipoVehiculoRoutes');
const movimientoRoutes = require('./routes/movimientoRoutes');
const movimientoClienteRoutes = require('./routes/movimientoClienteRoutes');
const tarifaRoutes = require('./routes/tarifaRoutes'); 
const preciosRoutes = require('./routes/precios');
const parametrosRoutes = require('./routes/parametros.js')
const calcularTarifaRoutes = require('./routes/calcularTarifaRoutes.js')
const turnoRoutes = require('./routes/turnoRoutes.js')
const clienteRoutes = require('./routes/clienteRoutes.js')

const app = express();

app.use(cors());
app.use(express.json());
// Necesario para parsear datos de formularios (formData con archivos)
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch(err => console.error("❌ Error conectando a MongoDB:", err));

// Rutas de tu app
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


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));
