const Vehiculo = require('../models/Vehiculo');
const Movimiento = require('../models/Movimiento'); 
const precioHora = 2400;
const precioAbono = 75000;

// Crear Vehículo
exports.createVehiculo = async (req, res) => {
    try {
        const { patente, tipoVehiculo, abonado } = req.body;

        if (!patente || !tipoVehiculo ) {
            return res.status(400).json({ msg: "Faltan datos"});
        }

        let vehiculoExistente = await Vehiculo.findOne({ patente });
        if (vehiculoExistente) {
            return res.status(400).json({ msg: "Este vehículo ya está registrado"})
        }

        const nuevoVehiculo = new Vehiculo({ patente, tipoVehiculo, abonado });

        if (abonado) {
            nuevoVehiculo.abonoExpira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días
            await nuevoVehiculo.save();

            const nuevoMovimiento = new Movimiento({
                patente,
                operador: "Sistema",
                tipoVehiculo,
                metodoPago: "Efectivo", // Puedes permitir seleccionar el método de pago en el front
                monto: precioAbono, // Monto de abono mensual, cambiar según corresponda
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


exports.updateAbono = async (req, res) => {
    try {
        const { patente, operador, metodoPago, monto } = req.body;
        let vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            return res.status(404).json({ msg: "Vehículo no encontrado" });
        }

        vehiculo.abonado = true;
        vehiculo.abonoExpira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Suma 30 días
        await vehiculo.save();

        //Registrar movimiento en la caja
        const nuevoMovimiento = new Movimiento({
            patente,
            operador,
            tipoVehiculo: vehiculo.tipoVehiculo,
            metodoPago,
            monto,
            descripcion: "Pago de abono mensual"
        });
        await nuevoMovimiento.save();

        res.json({ msg: "Abono activado y pago agregado a caja", vehiculo });
    } catch (err) {
        res.status(500).json({ msg: "Error del servidor" });
    }
};

// Registro de Entrada & Salida
exports.registrarEntrada = async (req, res) => {
    try {
        const { patente } = req.params;
        let vehiculo = await Vehiculo.findOne({ patente });
        if (!vehiculo) {
            return res.status(404).json({ msg:"Vehículo no encontrado"});
        }
        if (!vehiculo.historialEstadias) {
            vehiculo.historialEstadias = [];
        }
        vehiculo.historialEstadias.push({ entrada: new Date() });
        await vehiculo.save();
        res.json({ msg: "Entrada Registrada", vehiculo });
    } catch (err) {
        console.error("Error en registrarEntrada:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
}
exports.registrarSalida = async (req, res) => {
    try {
        const { patente } = req.params;
        const { metodoPago } = req.body;

        let vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            return res.status(404).json({ msg: "Vehículo no encontrado" });
        }

        // Chequeo de historial
        if (!vehiculo.historialEstadias || !Array.isArray(vehiculo.historialEstadias)) {
            console.log("❌ El vehículo no tiene historial de estadías.");
            return res.status(400).json({ msg: "No hay historial de estadías para este vehículo." });
        }

        let ultimaEstadia = vehiculo.historialEstadias.find(e => !e.salida);
        
        if (!ultimaEstadia) {
            console.log("❌ No hay una estadía en curso.");
            return res.status(400).json({ msg: "No hay una entrada registrada para este vehículo." });
        }

        if (!ultimaEstadia.entrada) {
            return res.status(400).json({ msg: "La estadía registrada no tiene una entrada válida." });
        }

        ultimaEstadia.salida = new Date();

        // Calcular tiempo de estadía
        let tiempoEstadiaHoras = Math.ceil((new Date(ultimaEstadia.salida) - new Date(ultimaEstadia.entrada)) / 1000 / 60 / 60); // Redondear hacia arriba
        // Calcular costo
        let costoTotal = tiempoEstadiaHoras * precioHora;
        ultimaEstadia.costoTotal = costoTotal;

        await vehiculo.save();

        // Registrar movimiento en la caja
        const nuevoMovimiento = new Movimiento({
            patente,
            operador: "Carlos",
            tipoVehiculo: vehiculo.tipoVehiculo,
            metodoPago: metodoPago || "Efectivo",
            monto: costoTotal,
            descripcion: "Pago por estadía"
        });

        await nuevoMovimiento.save();
        res.json({ msg: "Salida registrada", vehiculo, costoTotal });

    } catch (err) {
        console.error("💥 Error en registrarSalida:", err);
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