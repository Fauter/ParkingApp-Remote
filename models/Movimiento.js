const mongoose = require('mongoose');

const MovimientoSchema = new mongoose.Schema({
    patente: { type: String, required: true },
    fecha: { type: Date, default: Date.now },
    descripcion: { type: String, required: true }, 
    operador: { type: String, required: true },
    tipoVehiculo: { type: String, required: true },
    metodoPago: { type: String, enum: ['Efectivo', 'Débito', 'Crédito', 'QR'], required: true },
    factura: { type: String, enum: ['No', 'A', 'Final'], required: true },
    monto: { type: Number, required: true },
    tipoTarifa: { type: String } 
});

module.exports = mongoose.model('Movimiento', MovimientoSchema);
