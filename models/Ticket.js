// models/Ticket.js
const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  ticket: { type: Number, unique: true, required: true },
  creadoEn: { type: Date, default: Date.now },
  patente: { type: String, default: null },
  tipoVehiculo: { type: String, default: null },
  operadorNombre: { type: String, default: null },
  estado: { 
    type: String, 
    enum: ['pendiente', 'asociado', 'anulado'], 
    default: 'pendiente' 
  },
  fotoUrl: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', TicketSchema);