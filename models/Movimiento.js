const mongoose = require('mongoose');

const MovimientoSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' }, // ⬅️ nuevo
  patente: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  descripcion: { type: String, required: true },
  operador: { type: String, required: true },
  tipoVehiculo: { type: String, required: true },
  metodoPago: { type: String, enum: ['Efectivo', 'Débito', 'Crédito', 'QR'], required: true },
  factura: { type: String, enum: ['CC', 'A', 'Final'], required: true },
  monto: { type: Number, required: true },
  promo: { type: mongoose.Schema.Types.Mixed, default: 0 },
  tipoTarifa: { type: String },
  ticket: { type: Number }
}, { timestamps: true }); // ⬅️ para createdAt/updatedAt

module.exports = mongoose.model('Movimiento', MovimientoSchema);
