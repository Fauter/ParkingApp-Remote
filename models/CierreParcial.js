const mongoose = require('mongoose');

const cierreParcialSchema = new mongoose.Schema({
  fecha: { type: String, required: true },
  hora: { type: String, required: true },
  monto: { type: Number, required: true },
  operador: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('CierreParcial', cierreParcialSchema);
