// models/Auditoria.js
const mongoose = require('mongoose');

const auditoriaSchema = new mongoose.Schema({
  operador: {
    type: String,
    required: true
  },
  vehiculosAuditados: [{
    patente: {
      type: String,
      required: true
    },
    tipo: {
      type: String,
      required: true
    },
    esTemporal: {
      type: Boolean,
      default: false
    },
    fueVerificado: {
      type: Boolean,
      default: false
    }
  }],
  auditoria: {
    nombreArchivo: String,
    path: String,
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