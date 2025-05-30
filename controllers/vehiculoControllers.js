const fs = require("fs");
const path = require("path");
const axios = require('axios');
const Vehiculo = require('../models/Vehiculo');
const Movimiento = require('../models/Movimiento'); 
const Tarifa = require('../models/Tarifa')
const Abono = require('../models/Abono');


function obtenerPrecios() {
    const filePath = path.join(__dirname, '../data/precios.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
}

// Crear Vehículo
exports.createVehiculo = async (req, res) => {
    try {
        const { patente, tipoVehiculo, abonado } = req.body;

        if (!patente || !tipoVehiculo) {
            return res.status(400).json({ msg: "Faltan datos" });
        }

        let vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            // Si no existe, lo creo como siempre
            vehiculo = new Vehiculo({ patente, tipoVehiculo, abonado });

            if (abonado) {
                const precios = obtenerPrecios();
                const precioAbono = precios[tipoVehiculo.toLowerCase()]?.estadia || 0;

                vehiculo.abonoExpira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

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

            // Registrar primera entrada en estadiaActual
            vehiculo.estadiaActual = { entrada: new Date() };
            await vehiculo.save();

            return res.status(201).json({ msg: "Vehículo creado y entrada registrada", vehiculo });
        }

        // Si ya existía, registrar una nueva entrada
        if (vehiculo.estadiaActual.entrada) {
            return res.status(400).json({ msg: "Este vehículo ya tiene una estadía en curso Create" });
        }

        // Registrar una nueva entrada en estadiaActual
        vehiculo.estadiaActual = { entrada: new Date() };
        await vehiculo.save();

        res.status(200).json({ msg: "Entrada registrada para vehículo existente", vehiculo });
    } catch (err) {
        console.error("💥 Error en createVehiculo:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};

// Obtener Vehículos
exports.getVehiculos = async (req, res) => {
    try {
        const vehiculos = await Vehiculo.find();
        res.json(vehiculos);
    } catch (err) {
        res.status(500).json({ msg: "Error del servidor" });
    }
};
// Obtener Vehículos por Patente
exports.getVehiculoByPatente = async (req, res) => {
    try {
        const { patente } = req.params;
        const vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            return res.status(404).json({ msg: "Vehículo no encontrado" });
        }

        res.json(vehiculo);
    } catch (err) {
        res.status(500).json({ msg: "Error del servidor" });
    }
};
exports.getVehiculoById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validar que el id sea un ObjectId válido para evitar errores
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ msg: "ID inválido" });
        }

        const vehiculo = await Vehiculo.findById(id);

        if (!vehiculo) {
            return res.status(404).json({ msg: "Vehículo no encontrado" });
        }

        res.json(vehiculo);
    } catch (err) {
        console.error("Error en getVehiculoById:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};
// Obtener tipos de Vehículo desde Model
exports.getTiposVehiculo = (req, res) => {
    try {
        const tipos = Vehiculo.schema.path('tipoVehiculo').enumValues;
        res.json(tipos);
    } catch (err) {
        console.error("💥 Error al obtener tipos de vehículo:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};

// Registro de Entrada & Salida
exports.registrarEntrada = async (req, res) => {
    try {
        const { patente } = req.params;
        let vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            return res.status(404).json({ msg: "Vehículo no encontrado" });
        }

        // ✅ Verificamos si ya tiene una estadía en curso
        if (vehiculo.estadiaActual?.entrada) {
            return res.status(400).json({ msg: "Este vehículo ya tiene una estadía en curso" });
        }

        // Registrar una nueva entrada
        vehiculo.estadiaActual = { entrada: new Date() };
        await vehiculo.save();

        res.status(200).json({ msg: "Entrada registrada para vehículo", vehiculo });
    } catch (err) {
        console.error("Error en registrarEntrada:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};
exports.registrarSalida = async (req, res) => {
  try {
    const { patente } = req.params;

    const vehiculo = await Vehiculo.findOne({ patente });

    if (!vehiculo) {
      return res.status(404).json({ msg: "Vehículo no encontrado" });
    }

    const estadia = vehiculo.estadiaActual;

    if (!estadia || !estadia.entrada || estadia.salida) {
      return res.status(400).json({ msg: "No hay estadía activa para este vehículo" });
    }

    // Registrar salida actual
    estadia.salida = new Date();

    // Ejemplo: acá podrías calcular costoTotal, nombreTarifa y tipoTarifa si lo necesitás
    // (aunque ya dijiste que eso lo hace el front, igual podés dejar el campo disponible para futuros usos)

    // Mover estadiaActual al historial
    vehiculo.historialEstadias.push({ ...estadia });

    // Limpiar estadiaActual para permitir futuras entradas
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

exports.asignarAbonoAVehiculo = async (req, res) => {
    const { patente } = req.params;
    const { abonoId } = req.body; // Se supone que el ID del abono recién creado se pasa en el cuerpo de la solicitud

    try {
        // 1. Buscar el vehículo por patente
        const vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            return res.status(404).json({ message: "Vehículo no encontrado" });
        }

        // 2. Buscar el abono por su ID
        const abono = await Abono.findById(abonoId);

        if (!abono) {
            return res.status(404).json({ message: "Abono no encontrado" });
        }

        // 3. Actualizar el vehículo asignando el abono y cambiando el estado de abonado
        vehiculo.abonado = true;
        vehiculo.abono = abono._id; // Aquí guardamos solo el ID del abono, no el objeto completo

        await vehiculo.save();

        return res.status(200).json({ message: "Vehículo actualizado con éxito", vehiculo });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Error al actualizar el vehículo" });
    }
};

// ELIMINAR TODOS LOS AUTOS
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