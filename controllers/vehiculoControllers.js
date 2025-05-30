const fs = require("fs");
const path = require("path");
const axios = require('axios');
const Vehiculo = require('../models/Vehiculo');
const Movimiento = require('../models/Movimiento'); 
const Turno = require('../models/Turno');
const Tarifa = require('../models/Tarifa');
const Abono = require('../models/Abono');

function obtenerPrecios() {
    const filePath = path.join(__dirname, '../data/precios.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
}

async function actualizarEstadoTurnoVehiculo(patente) {
    const turnos = await Turno.find({ patente });
    const ahora = new Date();

    const tieneTurnoActivo = turnos.some(turno =>
        turno.expirado === false && new Date(turno.fin) > ahora
    );

    return tieneTurnoActivo;
}

// Crear Vehículo
exports.createVehiculo = async (req, res) => {
    try {
        const { patente, tipoVehiculo, abonado, turno } = req.body;

        if (!patente || !tipoVehiculo) {
            return res.status(400).json({ msg: "Faltan datos" });
        }

        let vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            // Crear vehículo nuevo
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

            vehiculo.estadiaActual = { entrada: new Date() };
            await vehiculo.save();

            return res.status(201).json({ msg: "Vehículo creado y entrada registrada", vehiculo });
        }

        if (vehiculo.estadiaActual.entrada) {
            return res.status(400).json({ msg: "Este vehículo ya tiene una estadía en curso Create" });
        }

        vehiculo.estadiaActual = { entrada: new Date() };
        await vehiculo.save();

        res.status(200).json({ msg: "Entrada registrada para vehículo existente", vehiculo });
    } catch (err) {
        console.error("💥 Error en createVehiculo:", err);
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
            return res.status(404).json({ msg: "Vehículo no encontrado" });
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
        let vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            return res.status(404).json({ msg: "Vehículo no encontrado" });
        }

        if (vehiculo.estadiaActual?.entrada) {
            return res.status(400).json({ msg: "Este vehículo ya tiene una estadía en curso" });
        }

        vehiculo.estadiaActual = { entrada: new Date() };
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
            return res.status(404).json({ msg: "Vehículo no encontrado" });
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
            return res.status(404).json({ message: "Vehículo no encontrado" });
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
