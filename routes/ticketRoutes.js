const express = require('express');
const ticketController = require('../controllers/ticketControllers');
const barcodeController = require('../controllers/barcodeControllers'); 
const { execFile } = require('child_process');
const path = require('path');
const Ticket = require('../models/Ticket');

const router = express.Router();

// Obtener todos los tickets
router.get('/', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ creadoEn: -1 });
    res.json(tickets);
  } catch (err) {
    console.error('Error al obtener tickets:', err.message);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Crear ticket
router.post('/', ticketController.crearTicket);

// Obtener último ticket pendiente
router.get('/pendiente', ticketController.obtenerUltimoTicketPendiente);

// Asociar ticket a vehículo
router.put('/:id/asociar', ticketController.asociarTicketAVehiculo);

// Actualizar foto del ticket
router.put('/:id/foto', ticketController.actualizarFotoTicket);

// Generar código de barras (API)
router.post('/barcode', barcodeController.generateBarcode);

// Imprimir ticket
router.post('/imprimir', (req, res) => {
  // ❌ IMPORTANTE: NO generar Outbox para esta ruta
  res.locals.__skipOutbox = true;

  let { texto, ticketNumero } = req.body;

  // Si viene ticketNumero, usarlo para armar texto solo con número con ceros
  if (ticketNumero !== undefined) {
    const ticketFormateado = String(ticketNumero).padStart(10, '0');
    texto = ticketFormateado;
  } else if (!texto) {
    return res.status(400).send('Falta texto o ticketNumero para imprimir');
  }

  const scriptPath = path.join(__dirname, '..', 'imprimir_ticket.py');
  
  // Convertir saltos de línea para pasar como argumento
  const ticketText = texto.replace(/\n/g, '\\n');
  
  const pythonProcess = execFile('python', [scriptPath, ticketText], { 
    encoding: 'utf8',
    windowsHide: true 
  }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error ejecutando Python:', error);
      return res.status(500).send('❌ Error al imprimir ticket');
    }
    console.log('✅ Salida Python:', stdout);
    if (stderr) {
      console.error('⚠ Advertencia Python:', stderr);
    }
    return res.send('✅ Ticket impreso correctamente');
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python stdout: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });
});

module.exports = router;
