const mongoose = require('mongoose');

const cierreDeCajaSchema = new mongoose.Schema({
  fecha: { type: String, required: true }, // formato: "YYYY-MM-DD"
  hora: { type: String, required: true },  // formato: "HH:mm"
  totalRecaudado: { type: Number, required: true },
  dejoEnCaja: { type: Number, required: true },
  totalRendido: { type: Number, required: true },
  operador: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",   // 👈 nombre exacto del modelo de usuarios
    required: true 
  },
  retirado: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('CierreDeCaja', cierreDeCajaSchema);
