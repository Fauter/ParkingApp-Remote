const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 10000000 } // Empezamos desde 10 millones para tener 8 dígitos
});

module.exports = mongoose.model('Counter', CounterSchema);
