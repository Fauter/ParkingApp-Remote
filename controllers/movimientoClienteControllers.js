const MovimientoCliente = require('../models/MovimientoCliente');
const Cliente = require('../models/Cliente');

exports.registrarMovimientoCliente = async (req, res) => {
  try {
    const {
      nombreApellido,
      email,
      descripcion,
      monto,
      tipo,
      operador = 'Carlos',
      patente
    } = req.body;

    if (
      !nombreApellido?.trim() ||
      !email?.trim() ||
      !descripcion?.trim() ||
      !monto ||
      !tipo?.trim()
    ) {
      return res.status(400).json({ message: 'Faltan datos obligatorios para registrar el movimiento.' });
    }

    let cliente = await Cliente.findOne({ nombreApellido: { $regex: `^${nombreApellido.trim()}$`, $options: 'i' } });

    if (!cliente) {
      cliente = await Cliente.findOne({ email });
    }

    if (!cliente) {
      cliente = new Cliente({
        nombreApellido: nombreApellido.trim(),
        email,
        abonos: [],
        vehiculos: [],
        balance: 0,
        movimientos: []  // asegurate que esto exista en el modelo
      });
      await cliente.save();
    }

    const nuevoMovimiento = new MovimientoCliente({
      cliente: cliente._id,
      descripcion: descripcion.trim(),
      monto: Number(monto),
      tipo: tipo.trim(),
      operador,
      patente: patente?.trim() || null
    });

    const movimientoGuardado = await nuevoMovimiento.save();

    // Ahora sí, agregamos el movimiento al cliente
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
    return res.status(500).json({ message: 'Error al registrar movimiento cliente' });
  }
};

// Obtener todos los movimientos de cliente
exports.getMovimientosCliente = async (req, res) => {
  try {
    const movimientos = await MovimientoCliente.find().populate('cliente', 'nombreApellido');
    res.status(200).json(movimientos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener los movimientos de cliente', details: err.message });
  }
};

// Borrar todos los movimientos de cliente
exports.borrarTodosMovimientosCliente = async (req, res) => {
  try {
    await MovimientoCliente.deleteMany({});
    await Cliente.updateMany({}, { $set: { movimientos: [] } });
    res.status(200).json({ message: 'Todos los movimientos de cliente eliminados correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al borrar los movimientos', details: err.message });
  }
};
