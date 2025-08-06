const express = require('express');
const router = express.Router();
const Counter = require('../models/Counter');

// Obtener todos los counters
router.get('/', async (req, res) => {
  try {
    const counters = await Counter.find();
    res.json(counters);
  } catch (err) {
    console.error('Error al obtener counters:', err.message);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

module.exports = router;
