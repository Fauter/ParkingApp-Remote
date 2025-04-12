const mongoose = require('mongoose');

const TipoVehiculoSchema = new mongoose.Schema({
    nombre: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('TipoVehiculo', TipoVehiculoSchema);