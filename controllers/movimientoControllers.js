const Movimiento = require('../models/Movimiento')


exports.registrarMovimiento = async (req, res) => {
    try {
        const { patente, operador, tipoVehiculo, metodoPago, factura, monto, descripcion } = req.body;

        if (!patente || !operador || !tipoVehiculo || !metodoPago || !factura || !monto || !descripcion) {
            return res.status(400).json({ msg: "Faltan datos" });
        }

        const nuevoMovimiento = new Movimiento({ patente, operador, tipoVehiculo, metodoPago, factura, monto, descripcion });
        await nuevoMovimiento.save();

        res.status(201).json({ msg: "Movimiento registrado", movimiento: nuevoMovimiento });
    } catch (err) {
        res.status(500).json({ msg: "Error del servidor" });
    }
};


exports.obtenerMovimientos = async (req, res) => {
    try {
        const movimientos = await Movimiento.find().sort({ fecha: -1 });
        res.json(movimientos);
    } catch (err) {
        res.status(500).json({ msg: "Error del servidor" });
    }
};


exports.eliminarTodosLosMovimientos = async (req, res) => {
    try {
        console.log("⚠️ Eliminando todos los movimientos...");
        await Movimiento.deleteMany({});
        console.log("✅ Todos los movimientos fueron eliminados.");
        res.json({ msg: "Todos los movimientos fueron eliminados correctamente." });
    } catch (err) {
        console.error("💥 Error al eliminar los movimientos:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};