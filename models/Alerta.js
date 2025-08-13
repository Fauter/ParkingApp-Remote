const mongoose = require('mongoose');

const alertaSchema = new mongoose.Schema({
  fecha: { type: String, required: true },
  hora: { type: String, required: true },
  tipoDeAlerta: { type: String, required: true },
  operador: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Alerta', alertaSchema);
