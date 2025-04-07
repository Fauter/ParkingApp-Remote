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

    // Validar tipo de vehículo
    if (!tiposValidos.includes(vehiculo)) {
        return res.status(400).json({ error: 'Tipo de vehículo inválido' });
    }

    // Validar que vengan los tres campos numéricos
    const { hora, media, estadia } = nuevosPrecios;
    if (
        typeof hora !== 'number' ||
        typeof media !== 'number' ||
        typeof estadia !== 'number'
    ) {
        return res.status(400).json({
            error: 'Los campos hora, media y estadia son requeridos y deben ser números'
        });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data[vehiculo] = { hora, media, estadia };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ message: 'Precios actualizados correctamente' });
});

module.exports = router;