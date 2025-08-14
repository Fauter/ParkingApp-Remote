const mongoose = require('mongoose');
const { Schema } = mongoose;

const abonoSchema = new Schema({
  nombreApellido: String,
  domicilio: String,
  localidad: String,
  telefonoParticular: String,
  telefonoEmergencia: String,
  domicilioTrabajo: String,
  telefonoTrabajo: String,
  email: String,
  dniCuitCuil: String,

  patente: String,
  marca: String,
  modelo: String,
  color: String,
  anio: Number,
  companiaSeguro: String,

  precio: Number,

  tipoTarifa: {
    type: String,
    default: 'abono'
  },
  tipoAbono: {
    nombre: String,
    dias: Number,
  },

  metodoPago: String,
  factura: String,
  tipoVehiculo: String,

  fechaCreacion: {
    type: Date,
    default: Date.now,
  },
  fechaExpiracion: Date,

  fotoSeguro: String,
  fotoDNI: String,
  fotoCedulaVerde: String,
  fotoCedulaAzul: String,

  activo: {
    type: Boolean,
    default: true
  },

  // >>>> IMPRESCINDIBLE PARA VINCULAR <<<<
  cliente: { type: Schema.Types.ObjectId, ref: 'Cliente' },
  vehiculo: { type: Schema.Types.ObjectId, ref: 'Vehiculo' },
}, { strict: true, timestamps: true });

module.exports = mongoose.model('Abono', abonoSchema);
