const mongoose = require('mongoose');
const { Schema } = mongoose;

const clienteSchema = new Schema({
  nombreApellido: { type: String, index: true },
  dniCuitCuil: String,
  domicilio: String,
  localidad: String,
  telefonoParticular: String,
  telefonoEmergencia: String,
  domicilioTrabajo: String,
  telefonoTrabajo: String,
  email: String,

  abonado: { type: Boolean, default: false },
  finAbono: { type: Date, default: null },
  precioAbono: { type: String, default: '' }, // guarda “auto|camioneta|moto”, como estás usando

  // >>>> ARRAYS REFERENCIADOS <<<<
  vehiculos: [{ type: Schema.Types.ObjectId, ref: 'Vehiculo' }],
  abonos:    [{ type: Schema.Types.ObjectId, ref: 'Abono' }],
  movimientos: [{ type: Schema.Types.ObjectId, ref: 'MovimientoCliente' }],

  balance: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Cliente', clienteSchema);
