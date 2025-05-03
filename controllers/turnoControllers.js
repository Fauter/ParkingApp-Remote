const Turno = require('../models/Turno');
const Vehiculo = require('../models/Vehiculo');
const Tarifa = require('../models/Tarifa');
const Movimiento = require('../models/Movimiento'); // Importamos el modelo Movimiento

const crearTurno = async (req, res) => {
  try {
    const { patente, turnoId, metodoPago, factura, precio, duracionHoras, fechaFin } = req.body;

    // Obtener datos del vehículo
    const vehiculo = await Vehiculo.findOne({ patente });
    if (!vehiculo) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Obtener datos del turno desde la tarifa
    const tarifa = await Tarifa.findById(turnoId);
    if (!tarifa || tarifa.tipo !== 'turno') {
      return res.status(400).json({ error: 'Tarifa inválida' });
    }

    // Crear nuevo turno
    const nuevoTurno = new Turno({
      patente,
      tipoVehiculo: vehiculo.tipoVehiculo,
      duracionHoras,
      precio,
      metodoPago,
      factura,
      fechaFin,
      nombreTarifa: tarifa.nombre // Agregamos el nombre de la tarifa
    });

    await nuevoTurno.save();

    // Crear movimiento asociado al turno
    const movimiento = new Movimiento({
      patente,
      descripcion: `Pago por Turno (${tarifa.nombre})`,
      operador: 'Carlos', // Operador por defecto
      tipoVehiculo: vehiculo.tipoVehiculo,
      metodoPago,
      factura,
      monto: precio,
      tipoTarifa: tarifa.nombre
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

module.exports = {
  crearTurno,
  obtenerTurnos
};
