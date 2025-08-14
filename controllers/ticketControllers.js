const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuración de directorios
const FOTOS_DIR = path.join(__dirname, '../uploads/fotos');
const FOTOS_ENTRADAS_DIR = path.join(FOTOS_DIR, 'entradas');
const FOTOS_TICKETS_DIR = path.join(FOTOS_DIR, 'tickets');

// Crear directorios si no existen
[FOTOS_DIR, FOTOS_ENTRADAS_DIR, FOTOS_TICKETS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Función para guardar foto
async function guardarFotoTicket(ticketId, fotoUrl) {
  if (!fotoUrl || !fotoUrl.includes('captura.jpg')) return null;

  try {
    const headResponse = await axios.head(fotoUrl);
    if (headResponse.status !== 200) return null;

    const response = await axios.get(fotoUrl, { 
      responseType: 'arraybuffer',
      validateStatus: status => status === 200
    });

    const buffer = Buffer.from(response.data, 'binary');
    const nombreArchivo = `ticket_${ticketId}.jpg`;
    const rutaArchivo = path.join(FOTOS_ENTRADAS_DIR, nombreArchivo);
    
    fs.writeFileSync(rutaArchivo, buffer);
    return `/uploads/fotos/entradas/${nombreArchivo}`;
  } catch (error) {
    if (error.response && error.response.status === 404) return null;
    console.error('Error al guardar la foto del ticket:', error.message);
    return null;
  }
}

// Crear ticket
exports.crearTicket = async (req, res) => {
  try {
    // 🔹 Obtener un número de ticket único usando Counter
    let nuevoNumero = await Counter.increment('ticket');

    // 🔒 Verificación extra por si existiera duplicado (muy improbable)
    while (await Ticket.exists({ ticket: nuevoNumero })) {
      console.warn(`⚠️ Ticket ${nuevoNumero} ya existe, avanzando al siguiente`);
      nuevoNumero = await Counter.increment('ticket');
    }

    const nuevoTicket = new Ticket({
      ticket: nuevoNumero,
      estado: 'pendiente'
    });

    await nuevoTicket.save();

    res.status(201).json({
      msg: 'Ticket creado',
      ticket: {
        ...nuevoTicket.toObject(),
        ticketFormateado: String(nuevoTicket.ticket).padStart(10, '0')
      }
    });

  } catch (err) {
    console.error('❌ Error al crear ticket:', err);
    res.status(500).json({ 
      msg: 'Error del servidor', 
      error: err.message 
    });
  }
};

// Obtener último ticket pendiente
exports.obtenerUltimoTicketPendiente = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ estado: 'pendiente' }).sort({ creadoEn: -1 });

    if (!ticket) {
      return res.status(404).json({ msg: 'No hay tickets pendientes' });
    }

    res.json({
      ...ticket.toObject(),
      ticketFormateado: String(ticket.ticket).padStart(6, '0')
    });
  } catch (err) {
    console.error('Error al obtener ticket pendiente:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Asociar ticket a vehículo
exports.asociarTicketAVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const { patente, tipoVehiculo, operadorNombre, fotoUrl } = req.body;

    const rutaFotoGuardada = await guardarFotoTicket(id, fotoUrl);

    const ticket = await Ticket.findByIdAndUpdate(
      id,
      {
        patente,
        tipoVehiculo,
        operadorNombre,
        estado: 'asociado',
        fotoUrl: rutaFotoGuardada || fotoUrl
      },
      { new: true }
    );

    if (!ticket) return res.status(404).json({ msg: 'Ticket no encontrado' });

    res.json({ 
      msg: 'Ticket asociado correctamente',
      ticket: {
        ...ticket.toObject(),
        ticketFormateado: String(ticket.ticket).padStart(6, '0')
      }
    });
  } catch (err) {
    console.error('Error al asociar ticket:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Actualizar foto del ticket
exports.actualizarFotoTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { fotoUrl } = req.body;

    const ticket = await Ticket.findByIdAndUpdate(
      ticketId,
      { fotoUrl },
      { new: true }
    );

    if (!ticket) return res.status(404).json({ msg: 'Ticket no encontrado' });

    res.json({
      msg: 'Foto actualizada correctamente',
      ticket: {
        ...ticket.toObject(),
        ticketFormateado: String(ticket.ticket).padStart(6, '0')
      }
    });
  } catch (err) {
    console.error('Error al actualizar foto del ticket:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};
