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
try {
  if (!fs.existsSync(FOTOS_DIR)) {
    fs.mkdirSync(FOTOS_DIR, { recursive: true });
  }
  if (!fs.existsSync(FOTOS_ENTRADAS_DIR)) {
    fs.mkdirSync(FOTOS_ENTRADAS_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Error al crear directorios:', err);
  process.exit(1);
}

async function obtenerProximoTicket() {
  const resultado = await Counter.findOneAndUpdate(
    { name: 'ticket' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return resultado.seq;
}

async function guardarFotoTicket(ticketId, fotoUrl) {
  if (!fotoUrl || !fotoUrl.includes('captura.jpg')) {
    return null;
  }

  try {
    // Descargar la foto desde la URL
    const response = await axios.get(fotoUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    
    // Crear nombre de archivo único
    const nombreArchivo = `ticket_${ticketId}.jpg`;
    const rutaArchivo = path.join(FOTOS_ENTRADAS_DIR, nombreArchivo);
    
    // Guardar el archivo
    fs.writeFileSync(rutaArchivo, buffer);
    
    // Retornar la ruta pública (ajustada al nuevo directorio)
    return `/uploads/fotos/entradas/${nombreArchivo}`;
  } catch (error) {
    console.error('Error al guardar la foto del ticket:', error);
    return null;
  }
}

exports.crearTicket = async (req, res) => {
  try {
    const ticketNumero = await obtenerProximoTicket();
    const ahora = new Date();
    
    const nuevoTicket = new Ticket({
      ticket: ticketNumero,
      creadoEn: ahora,
      estado: 'pendiente'
    });

    await nuevoTicket.save();
    
    res.status(201).json({
      msg: 'Ticket creado',
      ticket: {
        ...nuevoTicket.toObject(),
        ticketFormateado: String(ticketNumero).padStart(10, '0')
      }
    });
  } catch (err) {
    console.error('Error al crear ticket:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

exports.obtenerUltimoTicketPendiente = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ estado: 'pendiente' })
                              .sort({ creadoEn: -1 });
    
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

exports.asociarTicketAVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const { patente, tipoVehiculo, operadorNombre, fotoUrl } = req.body;
    
    // Guardar la foto si existe
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
    
    if (!ticket) {
      return res.status(404).json({ msg: 'Ticket no encontrado' });
    }
    
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

// Buscar vehículo por número de ticket
exports.getVehiculoByTicket = async (req, res) => {
  try {
    const { ticket } = req.params;
    const ticketNum = parseInt(ticket);

    if (isNaN(ticketNum)) {
      return res.status(400).json({ msg: "Número de ticket inválido" });
    }

    const vehiculo = await Vehiculo.findOne({ 
      "estadiaActual.ticket": ticketNum 
    });

    if (!vehiculo) {
      return res.status(404).json({ msg: "Vehículo no encontrado para este ticket" });
    }

    res.json(vehiculo);
  } catch (err) {
    console.error("Error en getVehiculoByTicket:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.actualizarFotoTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { fotoUrl } = req.body;
    
    const ticket = await Ticket.findByIdAndUpdate(
      ticketId,
      { fotoUrl },
      { new: true }
    );
    
    if (!ticket) {
      return res.status(404).json({ msg: 'Ticket no encontrado' });
    }
    
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
