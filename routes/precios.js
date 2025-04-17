const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const filePath = path.join(__dirname, '../data/precios.json');
const tiposValidos = ['auto', 'camioneta', 'moto'];

router.get('/', (req, res) => {
    const data = fs.readFileSync(filePath, 'utf8');
    res.json(JSON.parse(data));
});

router.put('/:vehiculo', (req, res) => {
    const { vehiculo } = req.params;
    const nuevosPrecios = req.body;

    if (!nuevosPrecios || typeof nuevosPrecios !== 'object') {
        return res.status(400).json({ error: 'Debes enviar un objeto con los precios' });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data[vehiculo] = nuevosPrecios;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ message: 'Precios actualizados correctamente' });
});

module.exports = router;