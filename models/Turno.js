// models/Turno.js
const mongoose = require('mongoose');

const TurnoSchema = new mongoose.Schema({
  patente:         { type: String, required: true },               // se normaliza a UPPER
  tipoVehiculo:    { type: String, required: true },               // auto, moto, etc. (minúscula)
  duracionHoras:   { type: Number, required: true, min: 0.25 },    // mínimo 15'
  precio:          { type: Number, required: true, min: 0 },
  metodoPago:      { type: String, required: true },
  factura:         { type: String, enum: ['CC', 'Final', 'A'], default: 'CC' },
  nombreTarifa:    { type: String, required: true },
  inicio:          { type: Date, default: Date.now },
  fin:             { type: Date },                                  // se calcula si no viene
  usado:           { type: Boolean, default: false },
  expirado:        { type: Boolean, default: false },
}, { timestamps: true });

// Normalización y cálculo defensivo
TurnoSchema.pre('save', function (next) {
  if (this.patente) this.patente = this.patente.trim().toUpperCase();
  if (this.tipoVehiculo) this.tipoVehiculo = String(this.tipoVehiculo).toLowerCase().trim();

  // Si no hay fin, calcularlo con duracionHoras
  if (!this.fin && this.inicio && this.duracionHoras) {
    const ms = this.duracionHoras * 60 * 60 * 1000;
    this.fin = new Date(this.inicio.getTime() + ms);
  }
  next();
});

// Índices para búsquedas del cron
TurnoSchema.index({ patente: 1, expirado: 1, fin: 1 });
TurnoSchema.index({ expirado: 1, fin: 1 });

// 🚫 Anti-acumulación: un solo turno vigente por patente (usado=false y expirado=false)
TurnoSchema.index(
  { patente: 1 },
  { unique: true, partialFilterExpression: { usado: false, expirado: false } }
);

module.exports = mongoose.model('Turno', TurnoSchema);
