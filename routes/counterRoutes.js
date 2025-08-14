const express = require('express');
const router = express.Router();
const Counter = require('../models/Counter');

// Obtener todos los counters (solo válidos)
router.get('/', async (req, res) => {
  try {
    const counters = await Counter.find().sort({ name: 1 });
    res.json(counters);
  } catch (err) {
    console.error('Error al obtener counters:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Resetear TODOS los counters (sin restricción de entorno)
router.post('/resetAll', async (req, res) => {
  try {
    await Counter.deleteMany({});
    // No crear counters por defecto
    res.json({ message: 'Counters reseteados correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resetear counter específico
router.post('/:name/reset', async (req, res) => {
  try {
    const { name } = req.params;
    const { value = 0 } = req.body;
    
    const counter = await Counter.safeReset(name, value);
    res.json(counter);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar counter
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await Counter.deleteOne({ name });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Counter no encontrado' });
    }
    
    res.json({ message: 'Counter eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
