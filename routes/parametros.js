const express = require('express');
const fs = require('fs');
const router = express.Router();
const path = require('path');

const parametrosPath = path.join(__dirname, '../data/parametrosGlobales.json');

router.get('/', (req, res) => {
    fs.readFile(parametrosPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error al leer parámetros:', err);
        return res.status(500).json({ message: 'Error al leer parámetros' });
      }
  
      const parametros = JSON.parse(data);
      res.json(parametros);  
    });
});

router.post('/', (req, res) => {
  const { fraccionarDesde, toleranciaInicial, permitirCobroAnticipado } = req.body;

  const nuevosParametros = {
    fraccionarDesde,
    toleranciaInicial,
    permitirCobroAnticipado
  };

  fs.writeFile(parametrosPath, JSON.stringify(nuevosParametros, null, 2), (err) => {
    if (err) {
      console.error('Error al guardar parametros:', err);
      return res.status(500).json({ success: false, message: 'Error al guardar parámetros' });
    }
    res.json({ success: true });
  });
});

module.exports = router;