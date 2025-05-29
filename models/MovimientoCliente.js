const mongoose = require('mongoose');

const MovimientoClienteSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  fecha: { type: Date, default: Date.now },
  descripcion: { type: String, required: true },
  monto: { type: Number, required: true },
  tipoVehiculo: { type: String, required: true },
  operador: { type: String, required: true, default: 'Carlos' },
  patente: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('MovimientoCliente', MovimientoClienteSchema);
