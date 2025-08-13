const mongoose = require('mongoose');

const incidenteSchema = new mongoose.Schema({
  fecha: { type: String, required: true },
  hora: { type: String, required: true },
  texto: { type: String, required: true },
  operador: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Incidente', incidenteSchema);
