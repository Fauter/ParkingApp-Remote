// controllers/movimientoControllers.js
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

// ⚙️ Util: timestamp de creación real (createdAt || fecha)
function movCreatedTs(m) {
  const src = m.createdAt || m.fecha;
  return src ? new Date(src).getTime() : -Infinity;
}

exports.registrarMovimiento = async (req, res) => {
  try {
    const { patente, tipoVehiculo, metodoPago, factura, monto, descripcion, tipoTarifa, ticket, cliente } = req.body;

    if (!patente || !tipoVehiculo || !metodoPago || !factura || monto == null || !descripcion) {
      return res.status(400).json({ msg: "Faltan datos" });
    }

    const operador = getOperadorNombre(req);

    const nuevoMovimiento = new Movimiento({
      ...(cliente ? { cliente } : {}),
      patente,
      operador,
      tipoVehiculo,
      metodoPago,
      factura,
      monto,
      descripcion,
      tipoTarifa,
      ...(ticket ? { ticket } : {})
      // ❗ NO aceptamos createdAt/updatedAt desde el body
      // `timestamps: true` lo setea solo Mongoose
    });

    await nuevoMovimiento.save();

    // Normalizo respuesta: createdAt siempre presente (o igual a fecha)
    const createdAt = nuevoMovimiento.createdAt || nuevoMovimiento.fecha;
    if (!nuevoMovimiento.createdAt && nuevoMovimiento.fecha) {
      // (no persisto nada extra acá; ya guardado)
    }

    res.status(201).json({
      msg: "Movimiento registrado",
      movimiento: {
        ...nuevoMovimiento.toObject(),
        createdAt
      }
    });
  } catch (err) {
    console.error("Error al registrar movimiento:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// 🧠 Devolvé siempre ordenado por creación real: createdAt || fecha (DESC)
exports.obtenerMovimientos = async (_req, res) => {
  try {
    // Uso aggregation para construir una clave de orden
    const movimientos = await Movimiento.aggregate([
      {
        $addFields: {
          _createdSort: { $ifNull: ['$createdAt', '$fecha'] }
        }
      },
      { $sort: { _createdSort: -1, _id: -1 } }
    ]);

    // Por compatibilidad, en cada doc garanto `createdAt` (si no venía)
    const normalizados = movimientos.map(m => ({
      ...m,
      createdAt: m.createdAt || m.fecha
    }));

    res.json(normalizados);
  } catch (err) {
    console.error('obtenerMovimientos error:', err);
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
