const express = require('express');
const router = express.Router();
const axios = require('axios');
const Turno = require('../models/Turno');
const Movimiento = require('../models/Movimiento');
const authMiddleware = require('../middlewares/authMiddleware2');

const crearTurno = async (req, res) => {
  try {

    const { patente, metodoPago, factura, duracionHoras, fin, nombreTarifa } = req.body;

    if (!patente) console.log('Falta patente');
    if (!metodoPago) console.log('Falta metodoPago');
    if (!fin) console.log('Falta fin');
    if (!duracionHoras) console.log('Falta duracionHoras');
    if (!nombreTarifa) console.log('Falta nombreTarifa');
    if (!patente || !metodoPago || !fin || !duracionHoras || !nombreTarifa) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Obtener vehículo desde API externa
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
      fin,
      nombreTarifa
    });

    await nuevoTurno.save();

    // NO CREAR MOVIMIENTO

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

const obtenerTurnosPorPatente = async (req, res) => {
  try {
    const { patente } = req.params;

    if (!patente) {
      return res.status(400).json({ error: 'Debe proporcionar una patente' });
    }

    const turnos = await Turno.find({ patente }).sort({ createdAt: -1 });

    if (!turnos || turnos.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontraron turnos para esa patente' });
    }

    res.status(200).json(turnos);
  } catch (error) {
    console.error('Error al obtener turnos por patente:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const expirarTurnosAutomáticamente = async () => {
  try {
    const ahora = new Date();
    const turnosActivos = await Turno.find({ expirado: false, fin: { $lte: ahora } });

    for (const turno of turnosActivos) {
      turno.expirado = true;
      await turno.save();
      console.log(`Turno ${turno._id} marcado como expirado.`);
    }
  } catch (error) {
    console.error('Error al expirar turnos automáticamente:', error);
  }
};

const desactivarTurno = async (req, res) => {
  try {
    const { id } = req.params;

    const turno = await Turno.findByIdAndUpdate(
      id,
      { expirado: true },
      { new: true }
    );

    if (!turno) {
      return res.status(404).json({ mensaje: 'Turno no encontrado' });
    }

    res.status(200).json(turno);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al desactivar el turno' });
  }
};

const desactivarTurnoPorPatente = async (req, res) => {
  try {
    const { patente } = req.params;

    const turno = await Turno.findOneAndUpdate(
      { patente, expirado: false },
      { expirado: true },
      { new: true }
    );

    if (!turno) {
      return res.status(404).json({ mensaje: 'Turno no encontrado o ya expirado' });
    }

    res.status(200).json(turno);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al desactivar el turno por patente' });
  }
};

async function actualizarEstadoTurnoVehiculo(patente) {
    const turnos = await Turno.find({ patente });
    const ahora = new Date();

    const tieneTurnoActivo = turnos.some(turno =>
        turno.expirado === false && new Date(turno.fin) > ahora
    );

    return tieneTurnoActivo;
}

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
  obtenerTurnosPorPatente,
  expirarTurnosAutomáticamente,
  desactivarTurno,
  desactivarTurnoPorPatente,
  actualizarEstadoTurnoVehiculo,
  eliminarTodosLosTurnos
};
