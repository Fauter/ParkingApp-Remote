const MovimientoCliente = require('../models/MovimientoCliente');
const Cliente = require('../models/Cliente');

// Registrar un nuevo movimiento
exports.registrarMovimientoCliente = async (req, res) => {
  console.log('req.body:', req.body);
  try {
    const {
      nombreApellido,
      email,
      descripcion,
      monto,
      tipoVehiculo, // 🛠️ Usa el nombre correcto según el schema
      operador = 'Carlos',
      patente,
      foto
    } = req.body;

    // Validaciones básicas
    if (
      !nombreApellido?.trim() ||
      !email?.trim() ||
      !descripcion?.trim() ||
      monto === undefined ||
      !tipoVehiculo?.trim()
    ) {
      return res.status(400).json({
        message: 'Faltan datos obligatorios para registrar el movimiento.'
      });
    }

    // Buscar cliente por nombre o email
    let cliente = await Cliente.findOne({
      nombreApellido: { $regex: `^${nombreApellido.trim()}$`, $options: 'i' }
    });

    if (!cliente) {
      cliente = await Cliente.findOne({ email });
    }

    // Si no existe, se crea
    if (!cliente) {
      cliente = new Cliente({
        nombreApellido: nombreApellido.trim(),
        email,
        abonos: [],
        vehiculos: [],
        balance: 0,
        movimientos: []
      });
      await cliente.save();
    }

    // Crear movimiento
    const nuevoMovimiento = new MovimientoCliente({
      cliente: cliente._id,
      descripcion: descripcion.trim(),
      monto: Number(monto),
      tipoVehiculo: tipoVehiculo.trim(),
      operador: operador.trim(),
      patente: patente?.trim() || null,
      foto: foto || null
    });

    const movimientoGuardado = await nuevoMovimiento.save();

    // Asociar el movimiento al cliente si no está ya incluido
    if (!cliente.movimientos.includes(movimientoGuardado._id)) {
      cliente.movimientos.push(movimientoGuardado._id);
      await cliente.save();
    }

    return res.status(201).json({
      message: 'Movimiento cliente registrado exitosamente',
      movimiento: movimientoGuardado
    });

  } catch (error) {
    console.error('Error al registrar movimiento cliente:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Obtener todos los movimientos
exports.getMovimientosCliente = async (req, res) => {
  try {
    const movimientos = await MovimientoCliente.find()
      .populate('cliente', 'nombreApellido email')
      .sort({ createdAt: -1 });

    res.status(200).json(movimientos);
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener los movimientos de cliente',
      details: error.message
    });
  }
};

// Borrar todos los movimientos
exports.borrarTodosMovimientosCliente = async (req, res) => {
  try {
    await MovimientoCliente.deleteMany({});
    await Cliente.updateMany({}, { $set: { movimientos: [] } });

    res.status(200).json({ message: 'Todos los movimientos fueron eliminados correctamente' });
  } catch (error) {
    res.status(500).json({
      message: 'Error al borrar los movimientos de cliente',
      details: error.message
    });
  }
};
