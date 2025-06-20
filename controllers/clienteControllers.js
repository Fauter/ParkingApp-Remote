const Cliente = require('../models/Cliente');

// Controlador con validaciones
exports.crearClienteSiNoExiste = async (req, res) => {
  const datos = req.body;
  const { nombreApellido, dniCuitCuil, precioAbono } = datos;

  if (!nombreApellido || typeof nombreApellido !== 'string' || nombreApellido.trim() === '') {
    return res.status(400).json({ message: 'El campo "nombreApellido" es obligatorio.' });
  }
  if (!dniCuitCuil || typeof dniCuitCuil !== 'string' || dniCuitCuil.trim() === '') {
    return res.status(400).json({ message: 'El campo "dniCuitCuil" es obligatorio.' });
  }

  try {
    let cliente = await Cliente.findOne({ nombreApellido: nombreApellido.trim() });

    if (!cliente) {
      cliente = new Cliente({
        nombreApellido: nombreApellido.trim(),
        dniCuitCuil: dniCuitCuil.trim(),
        domicilio: datos.domicilio || '',
        localidad: datos.localidad || '',
        telefonoParticular: datos.telefonoParticular || '',
        telefonoEmergencia: datos.telefonoEmergencia || '',
        domicilioTrabajo: datos.domicilioTrabajo || '',
        telefonoTrabajo: datos.telefonoTrabajo || '',
        email: datos.email || '',
        precioAbono: precioAbono || '',  // Guarda precioAbono si llega en el body
      });

      await cliente.save();
    }

    res.status(201).json(cliente);
  } catch (err) {
    res.status(500).json({ message: 'Error al crear cliente', error: err.message });
  }
};

exports.obtenerClientes = async (req, res) => {
  try {
    const clientes = await Cliente.find()
      .populate('vehiculos', '_id patente')
      .populate('movimientos')   // Trae todos los movimientos completos
      .populate('abonos');       // <-- Agregá esto para poblar los abonos completos

    res.status(200).json(clientes);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener clientes', error: err.message });
  }
};

exports.obtenerClientePorNombre = async (req, res) => {
  const { nombreApellido } = req.params;
  try {
    const cliente = await Cliente.findOne({ nombreApellido }).populate('vehiculos', '_id patente');
    if (!cliente) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ message: 'Error al buscar cliente', error: err.message });
  }
};
exports.obtenerClientePorId = async (req, res) => {
  const { id } = req.params;
  try {
    const cliente = await Cliente.findById(id)
      .populate('vehiculos')
      .populate('movimientos')
      .populate('abonos');

    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json(cliente);
  } catch (err) {
    res.status(500).json({ message: 'Error al buscar cliente por ID', error: err.message });
  }
};

exports.marcarClienteComoAbonado = async (req, res) => {
  const { nombreApellido } = req.body;

  if (!nombreApellido || typeof nombreApellido !== 'string' || nombreApellido.trim() === '') {
    return res.status(400).json({ message: 'El campo "nombreApellido" es obligatorio.' });
  }

  try {
    const cliente = await Cliente.findOneAndUpdate(
      { nombreApellido: nombreApellido.trim() },
      { abonado: true },
      { new: true }
    );

    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }

    res.status(200).json({ message: 'Cliente marcado como abonado.', cliente });
  } catch (err) {
    res.status(500).json({ message: 'Error al actualizar cliente', error: err.message });
  }
};

exports.actualizarPrecioAbono = async (req, res) => {
  const { id } = req.params;
  const { tipoVehiculo, precioMensual } = req.body;

  try {
    const cliente = await Cliente.findById(id);
    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    // Siempre actualizamos el precioAbono si se proporciona un tipoVehiculo
    if (tipoVehiculo) {
      cliente.precioAbono = tipoVehiculo;
      await cliente.save();
      return res.json({ 
        message: 'Precio de abono actualizado correctamente',
        cliente 
      });
    }

    res.json(cliente);
  } catch (err) {
    console.error('Error al actualizar precio de abono:', err);
    res.status(500).json({ 
      message: 'Error al actualizar precio de abono', 
      error: err.message 
    });
  }
};

exports.eliminarTodosLosClientes = async (req, res) => {
  try {
    await Cliente.deleteMany({});
    res.status(200).json({ message: 'Todos los clientes fueron eliminados.' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar clientes', error: err.message });
  }
};
