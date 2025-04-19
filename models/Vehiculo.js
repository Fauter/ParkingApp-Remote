const mongoose = require('mongoose');

const VehiculoSchema = new mongoose.Schema({
    patente: { type: String, required: true, unique: true },
    tipoVehiculo: { type: String, required: true },
    abonado: { type: Boolean, default: false },
    abonoExpira: { type: Date, default: null },
    cashback: { type: Number, default: 0 },
    estadiaActual: {
        entrada: { type: Date },
        salida: { type: Date },
        costoTotal: { type: Number, default: 0 },
        nombreTarifa: { type: String, default: null }
    },
    historialEstadias: [{
        entrada: { type: Date, required: true },
        salida: { type: Date },
        costoTotal: { type: Number, default: 0 },
        nombreTarifa: { type: String }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Vehiculo', VehiculoSchema);
