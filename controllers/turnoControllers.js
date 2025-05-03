const Turno = require('../models/Turno');
const Vehiculo = require('../models/Vehiculo');
const Tarifa = require('../models/Tarifa');
const Movimiento = require('../models/Movimiento');

const crearTurno = async (req, res) => {
  try {
    const { patente, turnoId, metodoPago, factura, precio, duracionHoras, fechaFin } = req.body;

    const vehiculo = await Vehiculo.findOne({ patente });
    if (!vehiculo) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const tarifa = await Tarifa.findById(turnoId);
    if (!tarifa || tarifa.tipo !== 'turno') {
      return res.status(400).json({ error: 'Tarifa inválida' });
    }

    const nuevoTurno = new Turno({
      patente,
      tipoVehiculo: vehiculo.tipoVehiculo,
      duracionHoras,
      precio,
      metodoPago,
      factura,
      fechaFin,
      nombreTarifa: tarifa.nombre
    });

    await nuevoTurno.save();

    const movimiento = new Movimiento({
      patente,
      descripcion: `Pago por Turno (${tarifa.nombre})`,
      operador: 'Carlos',
      tipoVehiculo: vehiculo.tipoVehiculo,
      metodoPago,
      factura,
      monto: precio,
      tipoTarifa: 'turno' // <-- Esto está fijo ahora
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
