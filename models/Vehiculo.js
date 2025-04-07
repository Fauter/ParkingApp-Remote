const mongoose = require('mongoose');

const VehiculoSchema = new mongoose.Schema({
    patente: { type: String, required: true, unique: true }, 
    tipoVehiculo: { type: String, enum: ['auto', 'camioneta', 'moto'], required: true }, 
    abonado: { type: Boolean, default: false },
    abonoExpira: { type: Date, default: null },
    cashback: { type: Number, default: 0 }, 
    historialEstadias: [{
        entrada: { type: Date, required: true }, 
        salida: { type: Date }, 
        costoTotal: { type: Number, default: 0 } 
    }]
}, { timestamps: true });

module.exports = mongoose.model('Vehiculo', VehiculoSchema);