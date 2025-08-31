const mongoose = require('mongoose');

const cierreParcialSchema = new mongoose.Schema({
  fecha: { type: String, required: true, trim: true },
  hora:  { type: String, required: true, trim: true },

  // $ Monto numérico, no negativo
  monto: { type: Number, required: true, min: 0 },

  // $ Campos nuevos (opcionales)
  nombre: { type: String, default: '', trim: true, maxlength: 60 },
  texto:  { type: String, default: '', trim: true, maxlength: 300 },

  // $ Operador: seguimos guardando el campo "operador" como string (nombre visible)
  //   y opcionalmente operadorId + operadorNombre para trazabilidad.
  operador:        { type: String, required: true, trim: true },
  operadorId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  operadorNombre:  { type: String, required: false, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('CierreParcial', cierreParcialSchema);
