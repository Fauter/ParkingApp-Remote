const mongoose = require('mongoose');
const Abono = require('./Abono');

const VehiculoSchema = new mongoose.Schema({
    patente: { type: String, required: true, unique: true },
    tipoVehiculo: { type: String, required: true },
    abonado: { type: Boolean, default: false },
    turno: { type: Boolean, default: false },
    abono: { type: mongoose.Schema.Types.ObjectId, ref: 'Abono' },
    cashback: { type: Number, default: 0 },
    estadiaActual: {
        entrada: { type: Date, required: false, default: null },
        salida: { type: Date },
        costoTotal: { type: Number, default: 0 },
        nombreTarifa: { type: String, default: null },
        tipoTarifa: { type: String },
        operadorNombre: { type: String, default: null },
        ticket: { 
            type: Number, 
            unique: true, 
            sparse: true,
            set: v => parseInt(v, 10)
        },
        fotoUrl: { type: String } // 👈 Nuevo campo para la foto
    },
    historialEstadias: [{
        entrada: { type: Date, required: true },
        salida: { type: Date },
        costoTotal: { type: Number, default: 0 },
        nombreTarifa: { type: String },
        tipoTarifa: { type: String },
        ticket: { type: Number },
        fotoUrl: { type: String } // 👈 También en el historial
    }]
}, { timestamps: true });

module.exports = mongoose.model('Vehiculo', VehiculoSchema);