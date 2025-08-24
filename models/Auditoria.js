// models/Auditoria.js
const mongoose = require('mongoose');

const vehiculoAuditadoSchema = new mongoose.Schema({
  patente: { type: String, required: true },
  tipo:    { type: String, required: true },
  esTemporal: { type: Boolean, default: false },
  fueVerificado: { type: Boolean, default: false },
  // opcional: guardamos la hora de entrada si la teníamos al momento de auditar
  entrada: { type: Date }
}, { _id: false });

const auditoriaSchema = new mongoose.Schema({
  operador: { type: String, required: true },
  vehiculosAuditados: [vehiculoAuditadoSchema],
  auditoria: {
    nombreArchivo: String,
    path: String,            // /api/auditorias/descargar/:id
    size: Number,
    mimeType: String
  },
  estado: {
    type: String,
    enum: ['OK', 'Conflicto'],
    default: 'OK'
  },
  fechaHora: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Auditoria', auditoriaSchema);
