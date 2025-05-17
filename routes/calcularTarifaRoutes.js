const express = require('express');
const router = express.Router();
const calcularHoraCliente = require('../controllers/calcularHoraCliente');
const calcularAbonoCliente = require('../controllers/calcularAbonoCliente');
const { obtenerTarifas, obtenerPrecios, obtenerParametros } = require('../data/fetchData');

router.post('/', async (req, res) => {
  try {
    const { detalle } = req.body;
    if (!detalle) {
      return res.status(400).json({ error: 'Faltan datos de entrada.' });
    }

    const [tarifas, precios, parametros] = await Promise.all([
      obtenerTarifas(),
      obtenerPrecios(),
      obtenerParametros()
    ]);

    const resultado = calcularHoraCliente({
        ...detalle,
        tarifas,
        precios,
        parametros
    });
    res.json({ detalle: resultado });
    
  } catch (error) {
    console.error('Error al calcular detalle:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.post('/calcular-abono', async (req, res) => {
  try {
    const { detalle } = req.body;
    if (!detalle) {
      return res.status(400).json({ error: 'Faltan datos de entrada.' });
    }

    const [tarifas, precios, parametros] = await Promise.all([
      obtenerTarifas(),
      obtenerPrecios(),
      obtenerParametros()
    ]);

    const resultado = calcularAbonoCliente({
      ...detalle,
      tarifas,
      precios,
      parametros
    });

    res.json({ detalle: resultado });

  } catch (error) {
    console.error('Error al calcular abono:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
