// controllers/vehiculoControllers.js
const fs = require("fs");
const path = require("path");
const axios = require('axios');
const mongoose = require('mongoose');
const Vehiculo = require('../models/Vehiculo');
const Movimiento = require('../models/Movimiento');
const Turno = require('../models/Turno');
const Tarifa = require('../models/Tarifa');
const Abono = require('../models/Abono');
const Cliente = require('../models/Cliente');
const Counter = require('../models/Counter');

// Configuración de directorios
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const FOTOS_DIR = path.join(UPLOADS_DIR, 'fotos');
const FOTOS_ENTRADAS_DIR = path.join(FOTOS_DIR, 'entradas');

// Ruta absoluta de la foto temporal captura.jpg
const RUTA_FOTO_TEMPORAL = path.join(__dirname, '../camara/sacarfoto/captura.jpg');

// Crear directorios si no existen
[UPLOADS_DIR, FOTOS_DIR, FOTOS_ENTRADAS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function obtenerPrecios() {
  const filePath = path.join(__dirname, '../data/precios.json');
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

async function obtenerProximoTicket() {
  const resultado = await Counter.findOneAndUpdate(
    { name: 'ticket' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return resultado.seq;
}

async function actualizarEstadoTurnoVehiculo(patente) {
  const turnos = await Turno.find({ patente });
  const ahora = new Date();
  const tieneTurnoActivo = turnos.some(turno =>
    turno.expirado === false && new Date(turno.fin) > ahora
  );
  return tieneTurnoActivo;
}

async function guardarFotoVehiculo(patente, fotoUrl) {
  if (!fotoUrl) return null;

  try {
    const response = await axios.get(fotoUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    const timestamp = Date.now();
    const nombreArchivo = `${patente}_${timestamp}.jpg`;
    const rutaArchivo = path.join(FOTOS_ENTRADAS_DIR, nombreArchivo);

    fs.writeFileSync(rutaArchivo, buffer);

    if (fs.existsSync(RUTA_FOTO_TEMPORAL)) {
      try {
        fs.unlinkSync(RUTA_FOTO_TEMPORAL);
        console.log('Foto temporal captura.jpg eliminada después de guardarla.');
      } catch (unlinkErr) {
        console.error('Error al eliminar foto temporal captura.jpg:', unlinkErr);
      }
    } else {
      console.log('Foto temporal captura.jpg no encontrada para eliminar.');
    }

    return `/uploads/fotos/entradas/${nombreArchivo}`;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.warn(`No se encontró la foto para ${patente} en ${fotoUrl}`);
      return null;
    }
    throw err;
  }
}

// ---------------- utils operador desde req.user ----------------
// IMPORTANTE: si no hay datos válidos, devolver NULL (no string)
function getOperadorNombre(req) {
  const u = (req && req.user) ? req.user : {};
  const nombre = (u.nombre || '').trim();
  const apellido = (u.apellido || '').trim();
  const username = (u.username || '').trim();
  if (nombre || apellido) return `${nombre} ${apellido}`.trim();
  if (username) return username;
  return null; // <-- clave: no devolvemos "Operador Desconocido" aquí
}

// ---------------- Handlers ----------------

// Crear Vehículo (con entrada)
exports.createVehiculo = async (req, res) => {
  try {
    const { patente, tipoVehiculo, abonado = false, turno = false, operador, metodoPago, monto, ticket, entrada, fotoUrl } = req.body;

    if (!patente || !tipoVehiculo) {
      return res.status(400).json({ msg: "Faltan datos" });
    }

    // Prioridad: operador (body) -> req.user -> fallback final
    const operadorNombre =
      (typeof operador === 'string' && operador.trim()) ||
      getOperadorNombre(req) ||
      'Operador Desconocido';

    const rutaFotoGuardada = await guardarFotoVehiculo(patente, fotoUrl);

    let vehiculo = await Vehiculo.findOne({ patente });

    if (!vehiculo) {
      vehiculo = new Vehiculo({
        patente,
        tipoVehiculo,
        abonado: !!abonado,
        turno: !!turno
      });

      if (abonado) {
        const precios = obtenerPrecios();
        const precioAbono = precios[tipoVehiculo.toLowerCase()]?.estadia || 0;

        vehiculo.abonoExpira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const nuevoMovimiento = new Movimiento({
          patente,
          operador: 'Sistema',
          tipoVehiculo,
          metodoPago: 'Efectivo',
          factura: 'CC',
          monto: precioAbono,
          descripcion: 'Pago por Abono'
        });

        await nuevoMovimiento.save();
      }

      const ticketNum = ticket || await obtenerProximoTicket();
      const fechaEntrada = entrada ? new Date(entrada) : new Date();

      vehiculo.estadiaActual = {
        entrada: fechaEntrada,
        operadorNombre,
        metodoPago: metodoPago || null,
        monto: monto || null,
        ticket: ticketNum,
        fotoUrl: rutaFotoGuardada
      };

      await vehiculo.save();
      return res.status(201).json({ msg: "Vehículo creado y entrada registrada", vehiculo });
    }

    if (vehiculo.estadiaActual?.entrada) {
      return res.status(400).json({ msg: "Este vehículo ya tiene una estadía en curso" });
    }

    const ticketNum = ticket || await obtenerProximoTicket();
    const fechaEntrada = entrada ? new Date(entrada) : new Date();

    vehiculo.estadiaActual = {
      entrada: fechaEntrada,
      operadorNombre,
      metodoPago: metodoPago || null,
      monto: monto || null,
      ticket: ticketNum,
      fotoUrl: rutaFotoGuardada
    };

    await vehiculo.save();
    return res.status(200).json({ msg: "Entrada registrada para vehículo existente", vehiculo });
  } catch (err) {
    console.error("💥 Error en createVehiculo:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.createVehiculoSinEntrada = async (req, res) => {
  try {
    const { patente, tipoVehiculo, abonado, turno } = req.body;

    if (!patente || !tipoVehiculo) {
      return res.status(400).json({ msg: "Faltan datos" });
    }

    let vehiculo = await Vehiculo.findOne({ patente });

    if (!vehiculo) {
      vehiculo = new Vehiculo({
        patente,
        tipoVehiculo,
        abonado: !!abonado,
        turno: !!turno
      });

      if (abonado) {
        const precios = obtenerPrecios();
        const precioAbono = precios[tipoVehiculo.toLowerCase()]?.estadia || 0;

        vehiculo.abonoExpira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const nuevoMovimiento = new Movimiento({
          patente,
          operador: 'Sistema',
          tipoVehiculo,
          metodoPago: 'Efectivo',
          factura: 'CC',
          monto: precioAbono,
          descripcion: 'Pago de Abono'
        });

        await nuevoMovimiento.save();
      }

      await vehiculo.save();
      return res.status(201).json({ msg: "Vehículo creado sin entrada registrada", vehiculo });
    }

    return res.status(200).json({ msg: "Vehículo ya existe", vehiculo });

  } catch (err) {
    console.error("💥 Error en createVehiculoSinEntrada:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// Obtener todos los vehículos
exports.getVehiculos = async (_req, res) => {
  try {
    const vehiculos = await Vehiculo.find();
    res.json(vehiculos);
  } catch (err) {
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// Obtener por patente
exports.getVehiculoByPatente = async (req, res) => {
  try {
    const { patente } = req.params;
    const vehiculo = await Vehiculo.findOne({ patente });

    if (!vehiculo) {
      return res.status(404).json({ msg: "Vehículo no encontrado" });
    }

    const tieneTurnoActivo = await actualizarEstadoTurnoVehiculo(patente);

    if (vehiculo.turno !== tieneTurnoActivo) {
      vehiculo.turno = tieneTurnoActivo;
      await vehiculo.save();
    }

    res.json(vehiculo);
  } catch (err) {
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// Obtener por ID
exports.getVehiculoById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ msg: "ID inválido" });
    }

    const vehiculo = await Vehiculo.findById(id);

    if (!vehiculo) {
      return res.status(404).json({ msg: "Vehículo no encontrado." });
    }

    res.json(vehiculo);
  } catch (err) {
    console.error("Error en getVehiculoById:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// Tipos de vehículo
exports.getTiposVehiculo = (_req, res) => {
  try {
    const precios = obtenerPrecios();
    const tipos = Object.keys(precios || {}).map(nombre => ({ nombre }));
    const out = tipos.length ? tipos : [{ nombre: 'auto' }, { nombre: 'camioneta' }, { nombre: 'moto' }];
    res.json(out);
  } catch (err) {
    console.error("💥 Error al obtener tipos de vehículo:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// Registrar entrada
exports.registrarEntrada = async (req, res) => {
  try {
    const { patente } = req.params;
    const { operador, metodoPago, monto, ticket, entrada, fotoUrl } = req.body;

    const rutaFotoGuardada = await guardarFotoVehiculo(patente, fotoUrl);
    const vehiculo = await Vehiculo.findOne({ patente });

    if (!vehiculo) {
      return res.status(404).json({ msg: "Vehículo no encontrado." });
    }

    if (vehiculo.estadiaActual?.entrada) {
      return res.status(400).json({ msg: "Este vehículo ya tiene una estadía en curso" });
    }

    const ticketNum = ticket || await obtenerProximoTicket();
    const fechaEntrada = entrada ? new Date(entrada) : new Date();

    // Prioridad: operador (body) -> req.user -> fallback
    const operadorNombre =
      (typeof operador === 'string' && operador.trim()) ||
      getOperadorNombre(req) ||
      'Operador Desconocido';

    vehiculo.estadiaActual = {
      entrada: fechaEntrada,
      operadorNombre,
      metodoPago: metodoPago || null,
      monto: monto || null,
      ticket: ticketNum,
      fotoUrl: rutaFotoGuardada
    };

    await vehiculo.save();

    res.status(200).json({ msg: "Entrada registrada para vehículo", vehiculo });
  } catch (err) {
    console.error("Error en registrarEntrada:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// Registrar salida (ATÓMICO con Movimiento)
exports.registrarSalida = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { patente } = req.params;
    const {
      salida: salidaBody,
      costo: costoBody,
      metodoPago: mpBody,
      factura: facturaBody,
      tipoTarifa: tipoTarifaBody,
      descripcion: descripcionBody,
      operador: operadorBody // permitir override explícito si se envía
    } = req.body || {};

    // Tomo el doc con session (solo para snapshot coherente)
    const vehiculo = await Vehiculo.findOne({ patente }).session(session);
    if (!vehiculo) throw new Error("Vehículo no encontrado");
    if (!vehiculo.estadiaActual || !vehiculo.estadiaActual.entrada || vehiculo.estadiaActual.salida) {
      throw new Error("No hay estadía activa para este vehículo");
    }

    // Snapshot de la estadía actual + salida y costo final
    const salida = salidaBody ? new Date(salidaBody) : new Date();
    const estadiaSnapshot = JSON.parse(JSON.stringify(vehiculo.estadiaActual));
    estadiaSnapshot.salida = salida;

    const costoFinal = (typeof costoBody === 'number' && !Number.isNaN(costoBody))
      ? costoBody
      : (typeof estadiaSnapshot.costoTotal === 'number' ? estadiaSnapshot.costoTotal : 0);

    estadiaSnapshot.costoTotal = Number(costoFinal) || 0;

    // ATÓMICO: push al historial y UNSET de estadiaActual en la MISMA operación
    await Vehiculo.updateOne(
      { _id: vehiculo._id },
      {
        $push: { historialEstadias: estadiaSnapshot },
        $unset: { estadiaActual: "" },
        $set: { updatedAt: new Date() }
      },
      { session }
    );

    // Movimiento consistente con el snapshot
    // Prioridad: operador (body) -> req.user -> fallback
    const operadorNombre =
      (typeof operadorBody === 'string' && operadorBody.trim()) ||
      getOperadorNombre(req) ||
      'Operador Desconocido';

    const metodoPago = mpBody || estadiaSnapshot.metodoPago || 'Efectivo';
    const factura = facturaBody || 'Final';
    const tipoTarifa = tipoTarifaBody || estadiaSnapshot.tipoTarifa || 'estadia';
    const descripcion = descripcionBody || `Salida ${patente} — ${tipoTarifa}`;

    const movimientoDoc = {
      patente,
      operador: operadorNombre,
      tipoVehiculo: vehiculo.tipoVehiculo || 'auto',
      metodoPago,
      factura,
      monto: Number(costoFinal) || 0,
      descripcion,
      tipoTarifa,
      ticket: estadiaSnapshot.ticket
    };
    await Movimiento.create([movimientoDoc], { session });

    await session.commitTransaction();

    // devolver el vehículo ya limpio
    const vehiculoActualizado = await Vehiculo.findOne({ _id: vehiculo._id }).lean();
    return res.json({
      msg: "Salida registrada",
      estadia: estadiaSnapshot,
      movimiento: movimientoDoc,
      vehiculo: vehiculoActualizado
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("💥 Error en registrarSalida:", err);
    res.status(500).json({ msg: err.message || "Error del servidor" });
  } finally {
    session.endSession();
  }
};

// Asignar abono
exports.asignarAbonoAVehiculo = async (req, res) => {
  const { patente } = req.params;
  const { abonoId } = req.body;

  try {
    const vehiculo = await Vehiculo.findOne({ patente });
    if (!vehiculo) return res.status(404).json({ message: "Vehículo no encontrado." });

    const abono = await Abono.findById(abonoId);
    if (!abono) return res.status(404).json({ message: "Abono no encontrado" });

    vehiculo.abonado = true;
    vehiculo.abono = abono._id;
    await vehiculo.save();

    return res.status(200).json({ message: "Vehículo actualizado con éxito", vehiculo });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al actualizar el vehículo" });
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

    const vehiculo = await Vehiculo.findOne({ "estadiaActual.ticket": ticketNum });
    if (!vehiculo) {
      return res.status(404).json({ msg: "Vehículo no encontrado para este ticket" });
    }

    res.json(vehiculo);
  } catch (err) {
    console.error("Error en getVehiculoByTicket:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.getVehiculoByTicketAdmin = async (req, res) => {
  try {
    const { ticket } = req.params;
    const ticketNum = parseInt(ticket, 10);

    if (isNaN(ticketNum)) {
      return res.status(400).json({ msg: "Número de ticket inválido" });
    }

    let vehiculo = await Vehiculo.findOne({ "estadiaActual.ticket": ticketNum }).select('-__v');

    if (vehiculo) {
      const estadia = vehiculo.estadiaActual;
      estadia.ticketFormateado = String(estadia.ticket).padStart(10, '0');
      return res.json({ vehiculo, estadia });
    }

    vehiculo = await Vehiculo.findOne({ "historialEstadias.ticket": ticketNum }).select('-__v');
    if (!vehiculo) return res.status(404).json({ msg: "Vehículo no encontrado para este ticket" });

    const estadia = vehiculo.historialEstadias.find(e => String(e.ticket) === String(ticketNum));
    if (!estadia) return res.status(404).json({ msg: "Estadía no encontrada para este ticket en el historial" });

    estadia.ticketFormateado = String(estadia.ticket).padStart(10, '0');

    return res.json({ vehiculo, estadia });
  } catch (err) {
    console.error("Error en getVehiculoByTicketAdmin:", err);
    return res.status(500).json({ msg: "Error del servidor" });
  }
};

// Eliminar todos los vehículos
exports.eliminarTodosLosVehiculos = async (_req, res) => {
  try {
    console.log("Eliminando todos los vehículos...");
    await Vehiculo.deleteMany({});
    console.log("Todos los vehículos fueron eliminados.");
    res.json({ msg: "Todos los vehículos fueron eliminados correctamente." });
  } catch (err) {
    console.error("💥 Error al eliminar los vehículos:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};
