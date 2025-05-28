const axios = require('axios');
const Turno = require('../models/Turno');
const Movimiento = require('../models/Movimiento');

const crearTurno = async (req, res) => {
  try {

    const { patente, metodoPago, factura, duracionHoras, fechaFin, nombreTarifa } = req.body;

    if (!patente) console.log('Falta patente');
    if (!metodoPago) console.log('Falta metodoPago');
    if (!fechaFin) console.log('Falta fechaFin');
    if (!duracionHoras) console.log('Falta duracionHoras');
    if (!nombreTarifa) console.log('Falta nombreTarifa');
    if (!patente || !metodoPago || !fechaFin || !duracionHoras || !nombreTarifa) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Obtener vehículo desde API externa
    if (!patente || !metodoPago || !fechaFin || !duracionHoras || !nombreTarifa) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const responseVehiculo = await axios.get(`http://localhost:5000/api/vehiculos/${patente}`);
    const vehiculo = responseVehiculo.data;
    const tipoVehiculo = vehiculo.tipoVehiculo;

    if (!tipoVehiculo) {
      return res.status(400).json({ error: 'El vehículo no tiene tipoVehiculo definido' });
    }

    // Obtener precios desde API externa
    const { data: precios } = await axios.get('http://localhost:5000/api/precios');

    // Buscar el precio según tipoVehiculo y nombreTarifa (minúsculas)
    const tarifaKey = nombreTarifa.toLowerCase().trim();

    const precio = precios[tipoVehiculo]?.[tarifaKey];
    if (precio === undefined) {
      return res.status(400).json({ error: `Precio no encontrado para tipoVehiculo="${tipoVehiculo}" y tarifa="${nombreTarifa}"` });
    }

    // Crear y guardar el turno
    const nuevoTurno = new Turno({
      patente,
      tipoVehiculo,
      duracionHoras,
      precio,
      metodoPago,
      factura,
      fechaFin,
      nombreTarifa
    });

    await nuevoTurno.save();

    // Crear y guardar el movimiento
    const movimiento = new Movimiento({
      patente,
      descripcion: `Pago por Turno (${nombreTarifa})`,
      operador: 'Carlos', // Podrías reemplazar por usuario autenticado si tienes
      tipoVehiculo,
      metodoPago,
      factura,
      monto: precio,
      tipoTarifa: 'turno'
    });

    await movimiento.save();

    res.status(201).json(nuevoTurno);

  } catch (error) {
    console.error('Error al crear turno:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const obtenerTurnos = async (req, res) => {
  try {
    const turnos = await Turno.find().sort({ createdAt: -1 });
    res.json(turnos);
  } catch (error) {
    console.error('Error al obtener turnos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const eliminarTodosLosTurnos = async (req, res) => {
    try {
      const resultado = await Turno.deleteMany({});
      res.json({ mensaje: 'Todos los turnos han sido eliminados.', resultado });
    } catch (error) {
      console.error('Error al eliminar turnos:', error);
      res.status(500).json({ error: 'Error del servidor' });
    }
};

module.exports = {
  crearTurno,
  obtenerTurnos,
  eliminarTodosLosTurnos
};
