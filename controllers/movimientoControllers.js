const Movimiento = require('../models/Movimiento');

// operador desde req.user (ignora body.operador)
function getOperadorNombre(req) {
  const u = req.user || {};
  const nombre = (u.nombre || '').trim();
  const apellido = (u.apellido || '').trim();
  const username = (u.username || '').trim();

  if (nombre || apellido) return `${nombre} ${apellido}`.trim();
  if (username) return username;
  return 'Operador Desconocido';
}

exports.registrarMovimiento = async (req, res) => {
  try {
    const { patente, tipoVehiculo, metodoPago, factura, monto, descripcion, tipoTarifa, ticket } = req.body;

    if (!patente || !tipoVehiculo || !metodoPago || !factura || monto == null || !descripcion) {
      return res.status(400).json({ msg: "Faltan datos" });
    }

    const operador = getOperadorNombre(req);

    const nuevoMovimiento = new Movimiento({
      patente,
      operador,
      tipoVehiculo,
      metodoPago,
      factura,
      monto,
      descripcion,
      tipoTarifa,
      ...(ticket ? { ticket } : {})
    });

    await nuevoMovimiento.save();
    res.status(201).json({ msg: "Movimiento registrado", movimiento: nuevoMovimiento });
  } catch (err) {
    console.error("Error al registrar movimiento:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.obtenerMovimientos = async (_req, res) => {
  try {
    const movimientos = await Movimiento.find().sort({ fecha: -1 });
    res.json(movimientos);
  } catch (err) {
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.eliminarTodosLosMovimientos = async (_req, res) => {
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
