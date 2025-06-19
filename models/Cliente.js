const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nombreApellido: { type: String, required: true },
  dniCuitCuil: { type: String, required: true },
  domicilio: String,
  localidad: String,
  telefonoParticular: String,
  telefonoEmergencia: String,
  domicilioTrabajo: String,
  telefonoTrabajo: String,
  email: String,
  vehiculos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo' }],
  abonos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Abono' }],
  movimientos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MovimientoCliente' }],
  balance: { type: Number, default: 0 },
  abonado: { type: Boolean, default: false },
  finAbono: {
    type: Date,
    validate: function(value) {
      return !value || this.abonado;
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Cliente', clienteSchema);
