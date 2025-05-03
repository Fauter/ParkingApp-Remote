const mongoose = require('mongoose');

const TurnoSchema = new mongoose.Schema({
  patente: { type: String, required: true },
  tipoVehiculo: { type: String, required: true }, // auto, moto, etc.
  duracionHoras: { type: Number, required: true },
  precio: { type: Number, required: true },
  metodoPago: { type: String, required: true }, // efectivo, tarjeta, etc.
  factura: { type: String, enum: ['A', 'Final', 'No'], default: 'no' },  
  inicio: { type: Date, default: Date.now },
  fin: { type: Date },
  usado: { type: Boolean, default: false },
  expirado: { type: Boolean, default: false },
}, { timestamps: true });

TurnoSchema.pre('save', function (next) {
  if (!this.fin) {
    const ms = this.duracionHoras * 60 * 60 * 1000;
    this.fin = new Date(this.inicio.getTime() + ms);
  }
  next();
});

module.exports = mongoose.model('Turno', TurnoSchema);
