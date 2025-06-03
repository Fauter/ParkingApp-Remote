const mongoose = require('mongoose');

const promoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
  },
  descuento: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
});

module.exports = mongoose.model('Promo', promoSchema);
