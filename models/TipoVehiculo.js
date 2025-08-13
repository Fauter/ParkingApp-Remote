const mongoose = require('mongoose');

const TipoVehiculoSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    nombre: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('TipoVehiculo', TipoVehiculoSchema);
