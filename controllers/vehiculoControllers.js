const fs = require("fs");
const path = require("path");
const Vehiculo = require('../models/Vehiculo');
const Movimiento = require('../models/Movimiento'); 

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

        let vehiculoExistente = await Vehiculo.findOne({ patente });
        if (vehiculoExistente) {
            return res.status(400).json({ msg: "Este vehículo ya está registrado" });
        }

        const nuevoVehiculo = new Vehiculo({ patente, tipoVehiculo, abonado });

        if (abonado) {
            const precios = obtenerPrecios();
            const precioAbono = precios[tipoVehiculo.toLowerCase()]?.estadia || 0;

            nuevoVehiculo.abonoExpira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días
            await nuevoVehiculo.save();

            const nuevoMovimiento = new Movimiento({
                patente,
                operador: "Sistema",
                tipoVehiculo,
                metodoPago: "Efectivo",
                factura: "No",
                monto: precioAbono,
                descripcion: "Pago de abono mensual"
            });

            await nuevoMovimiento.save();
        } else {
            await nuevoVehiculo.save();
        }

        res.status(201).json({ msg: "Vehículo registrado correctamente", vehiculo: nuevoVehiculo });
    } catch (err) {
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

        if (!vehiculo.historialEstadias) vehiculo.historialEstadias = [];

        vehiculo.historialEstadias.push({ entrada: new Date() });
        await vehiculo.save();
        res.json({ msg: "Entrada registrada", vehiculo });
    } catch (err) {
        console.error("Error en registrarEntrada:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};
exports.registrarSalida = async (req, res) => {
    try {
        const { patente } = req.params;
        const { metodoPago, factura } = req.body;

        let vehiculo = await Vehiculo.findOne({ patente });
        if (!vehiculo) return res.status(404).json({ msg: "Vehículo no encontrado" });

        if (!vehiculo.historialEstadias || !Array.isArray(vehiculo.historialEstadias)) {
            return res.status(400).json({ msg: "No hay historial de estadías para este vehículo." });
        }

        let ultimaEstadia = vehiculo.historialEstadias.find(e => !e.salida);
        if (!ultimaEstadia || !ultimaEstadia.entrada) {
            return res.status(400).json({ msg: "No hay una estadía en curso." });
        }

        ultimaEstadia.salida = new Date();

        let tiempoEstadiaHoras = Math.ceil((new Date(ultimaEstadia.salida) - new Date(ultimaEstadia.entrada)) / 1000 / 60 / 60);
        const precios = obtenerPrecios();
        const precioHora = precios[vehiculo.tipoVehiculo.toLowerCase()]?.hora || 0;
        let costoTotal = tiempoEstadiaHoras * precioHora;
        ultimaEstadia.costoTotal = costoTotal;

        await vehiculo.save();
        res.json({ msg: "Salida registrada", vehiculo, costoTotal });
    } catch (err) {
        console.error("💥 Error en registrarSalida:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};

// Estadias
exports.registrarEstadia = async (req, res) => {
    try {
        const { patente, metodoPago, factura, operador } = req.body;
        let vehiculo = await Vehiculo.findOne({ patente });
        if (!vehiculo) return res.status(404).json({ msg: "Vehículo no encontrado" });

        const precios = obtenerPrecios();
        const monto = precios[vehiculo.tipoVehiculo.toLowerCase()]?.estadia || 0;

        vehiculo.historialEstadias.push({
            entrada: new Date(),
            salida: new Date(),
            costoTotal: monto
        });

        await vehiculo.save();

        const nuevoMovimiento = new Movimiento({
            patente,
            operador,
            tipoVehiculo: vehiculo.tipoVehiculo,
            metodoPago,
            factura,
            monto,
            descripcion: "Estadía 24hs"
        });

        await nuevoMovimiento.save();
        res.json({ msg: "Estadía registrada", vehiculo, monto });
    } catch (err) {
        console.error("💥 Error en registrarEstadia:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};
// Registrar Media Estadía
exports.registrarMediaEstadia = async (req, res) => {
    try {
        const { patente, metodoPago, factura, operador } = req.body;
        let vehiculo = await Vehiculo.findOne({ patente });
        if (!vehiculo) return res.status(404).json({ msg: "Vehículo no encontrado" });

        const precios = obtenerPrecios();
        const monto = precios[vehiculo.tipoVehiculo.toLowerCase()]?.media || 0;

        vehiculo.historialEstadias.push({
            entrada: new Date(),
            salida: new Date(),
            costoTotal: monto
        });

        await vehiculo.save();

        const nuevoMovimiento = new Movimiento({
            patente,
            operador,
            tipoVehiculo: vehiculo.tipoVehiculo,
            metodoPago,
            factura,
            monto,
            descripcion: "Media Estadía"
        });

        await nuevoMovimiento.save();
        res.json({ msg: "Media estadía registrada", vehiculo, monto });
    } catch (err) {
        console.error("💥 Error en registrarMediaEstadia:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};

exports.updateAbono = async (req, res) => {
    try {
        const { patente } = req.params;
        const vehiculo = await Vehiculo.findOne({ patente });
        if (!vehiculo) return res.status(404).json({ msg: "Vehículo no encontrado" });

        const precios = obtenerPrecios();
        const precioAbono = precios[vehiculo.tipoVehiculo.toLowerCase()]?.estadia || 0;

        vehiculo.abonado = true;
        vehiculo.abonoExpira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días desde hoy
        await vehiculo.save();

        const nuevoMovimiento = new Movimiento({
            patente,
            operador: "Sistema",
            tipoVehiculo: vehiculo.tipoVehiculo,
            metodoPago: "Efectivo",
            factura: "No",
            monto: precioAbono,
            descripcion: "Renovación de abono"
        });

        await nuevoMovimiento.save();

        res.json({ msg: "Abono actualizado", vehiculo });
    } catch (err) {
        console.error("💥 Error en updateAbono:", err);
        res.status(500).json({ msg: "Error del servidor" });
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