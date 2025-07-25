const fs = require('fs');
const path = require('path');
const express = require('express');
const Vehiculo = require('../models/Vehiculo');
const { 
    createVehiculo, 
    createVehiculoSinEntrada,
    getVehiculos, 
    getVehiculoByPatente, 
    getVehiculoById,
    getTiposVehiculo,
    asignarAbonoAVehiculo, 
    registrarEntrada,
    registrarSalida,
    eliminarTodosLosVehiculos
} = require('../controllers/vehiculoControllers');

const router = express.Router();

router.put('/:patente/costoTotal', async (req, res) => {
  const { patente } = req.params;
  const { costoTotal } = req.body;

  if (typeof costoTotal !== "number") {
    return res.status(400).json({ msg: "Costo total inválido" });
  }

  try {
    const vehiculo = await Vehiculo.findOne({ patente });
    if (!vehiculo) {
      return res.status(404).json({ msg: "Vehículo no encontrado" });
    }

    if (!vehiculo.estadiaActual) {
      return res.status(400).json({ msg: "No existe estadiaActual para este vehículo" });
    }

    vehiculo.estadiaActual.costoTotal = costoTotal;
    await vehiculo.save();

    res.json({ msg: "Costo total actualizado", vehiculo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

router.post('/', createVehiculo);
router.post('/sin-entrada', createVehiculoSinEntrada);
router.get('/', getVehiculos);
router.get('/tipos', getTiposVehiculo);
router.get('/:patente', getVehiculoByPatente);
router.get('/id/:id', getVehiculoById);
router.put('/:patente/registrarEntrada', registrarEntrada); 
router.put('/:patente/registrarSalida', registrarSalida); 
router.put("/asignar-abono/:patente", asignarAbonoAVehiculo);
router.delete("/", eliminarTodosLosVehiculos); 

// Agregar esta ruta para buscar por ticket (ya existe pero la mejoramos)
router.get('/ticket/:ticket', async (req, res) => {
  const { ticket } = req.params;
  
  // Aceptar tickets con o sin ceros a la izquierda
  const ticketNum = parseInt(ticket, 10);
  
  if (isNaN(ticketNum)) {
    return res.status(400).json({ msg: "Ticket inválido" });
  }

  try {
    const vehiculo = await Vehiculo.findOne({ 
      "estadiaActual.ticket": ticketNum 
    }).select('-historialEstadias -__v');

    if (!vehiculo) {
      return res.status(404).json({ 
        msg: "No se encontró vehículo con ese ticket",
        ticketBuscado: ticketNum,
        ticketFormateado: String(ticketNum).padStart(10, '0')
      });
    }

    // Agregar información del ticket formateado
    const vehiculoConTicket = vehiculo.toObject();
    vehiculoConTicket.estadiaActual.ticketFormateado = 
      String(vehiculo.estadiaActual.ticket).padStart(10, '0');
    
    res.json(vehiculoConTicket);
  } catch (err) {
    console.error("Error al buscar por ticket:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

router.delete('/eliminar-foto-temporal', async (req, res) => {
    try {
        const fotoPath = path.join(__dirname, '../../camara/sacarfoto/captura.jpg');
        console.log('Intentando eliminar foto en:', fotoPath);
        
        if (fs.existsSync(fotoPath)) {
            fs.unlinkSync(fotoPath);
            console.log('Foto eliminada exitosamente');
            return res.json({ msg: "Foto temporal eliminada" });
        }
        
        console.log('No se encontró la foto para eliminar');
        return res.json({ msg: "No se encontró foto temporal" }); // Cambiado a 200 OK
    } catch (err) {
        console.error("Error al eliminar foto temporal:", err);
        return res.status(500).json({ msg: "Error del servidor", error: err.message });
    }
});

createVehiculoSinEntrada

module.exports = router;
