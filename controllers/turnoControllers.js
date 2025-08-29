// controllers/turnoControllers.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Turno = require('../models/Turno');
const Movimiento = require('../models/Movimiento');
const authMiddleware = require('../middlewares/authMiddleware2');

const crearTurno = async (req, res) => {
  try {
    const {
      patente,
      metodoPago,
      factura,
      duracionHoras,
      fin: finBody,
      nombreTarifa,
      tipoVehiculo: tipoVehiculoBody,
      inicio: inicioBody
    } = req.body;

    if (!patente || !metodoPago || !duracionHoras || !nombreTarifa) {
      return res.status(400).json({ error: 'Faltan campos requeridos (patente, metodoPago, duracionHoras, nombreTarifa)' });
    }

    // ❌ Anti-acumulación: si ya hay un turno vigente (no usado/no expirado y fin>ahora), no permitimos otro
    const ahora = new Date();
    const existente = await Turno.findOne({
      patente: String(patente).toUpperCase(),
      usado: false,
      expirado: false,
      fin: { $gt: ahora }
    }).lean();

    if (existente) {
      return res.status(409).json({
        error: 'Ya existe un turno vigente para esta patente. No se pueden acumular.',
        turnoVigente: { _id: existente._id, inicio: existente.inicio, fin: existente.fin }
      });
    }

    // Obtener tipoVehiculo si no vino
    let tipoVehiculo = tipoVehiculoBody;
    if (!tipoVehiculo) {
      try {
        const responseVehiculo = await axios.get(`http://localhost:5000/api/vehiculos/${patente}`);
        const vehiculo = responseVehiculo.data;
        tipoVehiculo = vehiculo?.tipoVehiculo;
      } catch { /* seguimos, validamos abajo */ }
    }
    if (!tipoVehiculo) {
      return res.status(400).json({ error: 'El vehículo no tiene tipoVehiculo definido' });
    }

    // Normalización
    const tipoKey = String(tipoVehiculo || '').toLowerCase().trim();
    const tarifaKey = String(nombreTarifa || '').toLowerCase().trim();

    // Precios
    const { data: precios } = await axios.get('http://localhost:5000/api/precios');
    const preciosPorTipo = precios[tipoKey] || precios[tipoVehiculo] || null;
    const precio = preciosPorTipo ? preciosPorTipo[tarifaKey] : undefined;

    if (precio === undefined) {
      const disponiblesTipo = preciosPorTipo ? Object.keys(preciosPorTipo).join(', ') : '(sin tarifas para ese tipo)';
      return res.status(400).json({
        error: `Precio no encontrado para tipoVehiculo="${tipoVehiculo}" y tarifa="${nombreTarifa}"`,
        detalle: {
          tipoUsadoParaBuscar: tipoKey,
          tarifasDisponiblesParaTipo: disponiblesTipo
        }
      });
    }

    // Inicio/fin defensivo
    const inicio = inicioBody ? new Date(inicioBody) : new Date();
    const fin = finBody ? new Date(finBody) : new Date(inicio.getTime() + (duracionHoras * 60 * 60 * 1000));

    const nuevoTurno = new Turno({
      patente,
      tipoVehiculo: tipoKey,
      duracionHoras,
      precio,
      metodoPago,
      factura: factura || 'CC',
      nombreTarifa,
      inicio,
      fin
    });

    await nuevoTurno.save();
    res.status(201).json(nuevoTurno);

  } catch (error) {
    console.error('Error al crear turno:', error);
    // Manejar violación de índice único parcial (race conditions)
    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'Ya existe un turno vigente (no usado/no expirado) para esta patente' });
    }
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

    const turnos = await Turno.find({ patente: String(patente).toUpperCase() }).sort({ createdAt: -1 });

    if (!turnos || turnos.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontraron turnos para esa patente' });
    }

    res.status(200).json(turnos);
  } catch (error) {
    console.error('Error al obtener turnos por patente:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

/**
 * Marca como expirados todos los turnos con fin <= ahora y expirado=false.
 */
const expirarTurnosAutomaticamente = async () => {
  try {
    const ahora = new Date();
    const r = await Turno.updateMany(
      { expirado: false, fin: { $lte: ahora } },
      { $set: { expirado: true, updatedAt: new Date() } }
    );
    if (r?.modifiedCount) {
      console.log(`[turnos] expirados por cron: ${r.modifiedCount}`);
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
      { patente: String(patente).toUpperCase(), expirado: false },
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
  const ahora = new Date();
  const turnos = await Turno.find({ patente: String(patente).toUpperCase() });
  const tieneTurnoActivo = turnos.some(turno =>
    turno.expirado === false && new Date(turno.fin) > ahora && turno.usado === false
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
  expirarTurnosAutomaticamente,
  desactivarTurno,
  desactivarTurnoPorPatente,
  actualizarEstadoTurnoVehiculo,
  eliminarTodosLosTurnos
};
