const mongoose = require('mongoose');

const TarifaSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  tipo: { type: String, enum: ['hora', 'estadia', 'turno', 'abono'], required: true },
  dias: { type: Number, default: 0 },
  horas: { type: Number, default: 0 },
  minutos: { type: Number, default: 0 },
  tolerancia: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Tarifa', TarifaSchema);