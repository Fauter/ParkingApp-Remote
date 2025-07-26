const mongoose = require('mongoose');

const MovimientoSchema = new mongoose.Schema({
  patente: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  descripcion: { type: String, required: true },
  operador: { type: String, required: true, default: 'Carlos' }, // Default operador "Carlos"
  tipoVehiculo: { type: String, required: true },
  metodoPago: { type: String, enum: ['Efectivo', 'Débito', 'Crédito', 'QR'], required: true },
  factura: { type: String, enum: ['CC', 'A', 'Final'], required: true },
  monto: { type: Number, required: true },
  promo: { type: mongoose.Schema.Types.Mixed, default: 0 },
  tipoTarifa: { type: String },
  ticket: { type: Number }
});

module.exports = mongoose.model('Movimiento', MovimientoSchema);
