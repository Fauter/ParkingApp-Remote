const fs = require("fs");
const path = require("path");
const axios = require('axios');
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
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
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
  if (!fotoUrl || !fotoUrl.includes('captura.jpg')) {
    // No hay foto para guardar
    return null;
  }

  try {
    // Descargar la foto desde la URL
    const response = await axios.get(fotoUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    
    // Crear nombre de archivo único
    const timestamp = Date.now();
    const nombreArchivo = `${patente}_${timestamp}.jpg`;
    const rutaArchivo = path.join(FOTOS_ENTRADAS_DIR, nombreArchivo);
    
    // Guardar el archivo
    fs.writeFileSync(rutaArchivo, buffer);

    // Borrar la foto temporal captura.jpg luego de copiarla
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
    
    // Retornar la ruta pública
    return `/uploads/fotos/entradas/${nombreArchivo}`;
  } catch (error) {
    console.error('Error al guardar la foto:', error);
    return null;
  }
}

// Crear Vehículo
exports.createVehiculo = async (req, res) => {
  try {
    const { patente, tipoVehiculo, abonado = false, turno = false, operador, metodoPago, monto, ticket, entrada, fotoUrl } = req.body;
    const usuarioLogueado = req.user;

    if (!patente || !tipoVehiculo) {
      return res.status(400).json({ msg: "Faltan datos" });
    }

    const operadorNombre = operador || usuarioLogueado?.nombre || "Desconocido";

    // Guardar la foto si existe
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
          operador: "Sistema",
          tipoVehiculo,
          metodoPago: "Efectivo",
          factura: "CC",
          monto: precioAbono,
          descripcion: "Pago de abono"
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
                    operador: "Sistema",
                    tipoVehiculo,
                    metodoPago: "Efectivo",
                    factura: "CC",
                    monto: precioAbono,
                    descripcion: "Pago de abono abono"
                });

                await nuevoMovimiento.save();
            }

            // NO se registra entrada acá
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
exports.getVehiculos = async (req, res) => {
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
exports.getTiposVehiculo = (req, res) => {
    try {
        const tipos = Vehiculo.schema.path('tipoVehiculo').enumValues;
        res.json(tipos);
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

    // Guardar la foto si existe
    const rutaFotoGuardada = await guardarFotoVehiculo(patente, fotoUrl);

    let vehiculo = await Vehiculo.findOne({ patente });

    if (!vehiculo) {
      return res.status(404).json({ msg: "Vehículo no encontrado." });
    }

    if (vehiculo.estadiaActual?.entrada) {
      return res.status(400).json({ msg: "Este vehículo ya tiene una estadía en curso" });
    }

    const ticketNum = ticket || await obtenerProximoTicket();
    const fechaEntrada = entrada ? new Date(entrada) : new Date();

    vehiculo.estadiaActual = {
      entrada: fechaEntrada,
      operadorNombre: operador || "Desconocido",
      metodoPago: metodoPago || null,
      monto: monto || null,
      ticket: ticketNum,
      fotoUrl: rutaFotoGuardada // Usamos la ruta guardada
    };

    await vehiculo.save();

    res.status(200).json({ msg: "Entrada registrada para vehículo", vehiculo });
  } catch (err) {
    console.error("Error en registrarEntrada:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};
// Registrar salida
exports.registrarSalida = async (req, res) => {
    try {
        const { patente } = req.params;

        const vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            return res.status(404).json({ msg: "Vehículo no encontrado." });
        }

        const estadia = vehiculo.estadiaActual;

        if (!estadia || !estadia.entrada || estadia.salida) {
            return res.status(400).json({ msg: "No hay estadía activa para este vehículo" });
        }

        estadia.salida = new Date();
        vehiculo.historialEstadias.push({ ...estadia });

        vehiculo.estadiaActual = {
            entrada: null,
            salida: null,
            costoTotal: null,
            nombreTarifa: null,
            tipoTarifa: null
        };

        await vehiculo.save();

        res.status(200).json({ msg: "Salida registrada y estadía archivada", vehiculo });
    } catch (err) {
        console.error("💥 Error en registrarSalida:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};

// Asignar abono
exports.asignarAbonoAVehiculo = async (req, res) => {
    const { patente } = req.params;
    const { abonoId } = req.body;

    try {
        const vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            return res.status(404).json({ message: "Vehículo no encontrado." });
        }

        const abono = await Abono.findById(abonoId);

        if (!abono) {
            return res.status(404).json({ message: "Abono no encontrado" });
        }

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
exports.getVehiculoByTicketAdmin = async (req, res) => {
  try {
    const { ticket } = req.params;
    const ticketNum = parseInt(ticket, 10);

    if (isNaN(ticketNum)) {
      return res.status(400).json({ msg: "Número de ticket inválido" });
    }

    // Buscar vehículo con estadiaActual.ticket igual al ticket
    let vehiculo = await Vehiculo.findOne({ "estadiaActual.ticket": ticketNum }).select('-__v');

    if (vehiculo) {
      // Encontró en estadiaActual
      const estadia = vehiculo.estadiaActual;

      // Agregar ticket formateado para comodidad
      estadia.ticketFormateado = String(estadia.ticket).padStart(10, '0');

      return res.json({ vehiculo, estadia });
    }

    // Si no encontró, buscar en historialEstadias
    vehiculo = await Vehiculo.findOne({ "historialEstadias.ticket": ticketNum }).select('-__v');

    if (!vehiculo) {
      return res.status(404).json({ msg: "Vehículo no encontrado para este ticket" });
    }

    // Buscar la estadía en historialEstadias con el ticket buscado
    const estadia = vehiculo.historialEstadias.find(e => String(e.ticket) === String(ticketNum));

    if (!estadia) {
      return res.status(404).json({ msg: "Estadía no encontrada para este ticket en el historial" });
    }

    estadia.ticketFormateado = String(estadia.ticket).padStart(10, '0');

    return res.json({ vehiculo, estadia });
  } catch (err) {
    console.error("Error en getVehiculoByTicketAdmin:", err);
    return res.status(500).json({ msg: "Error del servidor" });
  }
};

// Eliminar todos los vehículos
exports.eliminarTodosLosVehiculos = async (req, res) => {
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

