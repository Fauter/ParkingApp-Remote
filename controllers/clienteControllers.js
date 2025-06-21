const mongoose = require('mongoose');
const Cliente = require('../models/Cliente');
const Vehiculo = require('../models/Vehiculo');
const Movimiento = require('../models/Movimiento');
const MovimientoCliente = require('../models/MovimientoCliente');

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



exports.desabonarCliente = async (req, res) => {
  const { id } = req.params;

  try {
    // Primero actualizamos el cliente
    const cliente = await Cliente.findByIdAndUpdate(
      id,
      {
        $set: { 
          abonado: false,
          finAbono: null
        }
      },
      { new: true }
    ).populate('vehiculos abonos movimientos');

    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    // Luego actualizamos los vehículos asociados
    if (cliente.vehiculos && cliente.vehiculos.length > 0) {
      await Promise.all(cliente.vehiculos.map(async (vehiculo) => {
        vehiculo.abonado = false;
        vehiculo.abono = undefined;
        await vehiculo.save();
      }));
    }

    // Opcional: marcar el abono como inactivo
    if (cliente.abonos && cliente.abonos.length > 0) {
      await Promise.all(cliente.abonos.map(async (abono) => {
        abono.activo = false;
        await abono.save();
      }));
    }

    res.json({
      message: 'Cliente desabonado correctamente',
      cliente: await Cliente.findById(id).populate('vehiculos abonos movimientos') // Refrescar datos
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error al desabonar cliente', 
      error: err.message 
    });
  }
};

exports.renovarAbono = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { id } = req.params;
        const { precio, metodoPago, factura, operador, patente, tipoVehiculo } = req.body;

        // Validaciones
        if (!precio || isNaN(precio)) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Precio inválido o faltante' });
        }
        if (!metodoPago || !['Efectivo', 'Débito', 'Crédito', 'QR'].includes(metodoPago)) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Método de pago inválido' });
        }
        if (!tipoVehiculo) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Tipo de vehículo requerido' });
        }

        const cliente = await Cliente.findById(id).populate('abonos').session(session);
        if (!cliente) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }

        // Calcular fecha de expiración
        const hoy = new Date();
        const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        ultimoDiaMes.setHours(23, 59, 59, 999);

        // Actualizar todos los abonos del cliente a activo: true
        if (cliente.abonos && cliente.abonos.length > 0) {
            await Promise.all(cliente.abonos.map(async (abono) => {
                abono.activo = true;
                abono.fechaExpiracion = ultimoDiaMes;
                await abono.save({ session });
            }));
        }

        // Actualizar el vehículo asociado para establecer abonado: true
        if (patente) {
            const vehiculo = await Vehiculo.findOne({ patente }).session(session);
            if (vehiculo) {
                vehiculo.abonado = true;
                await vehiculo.save({ session });
            }
        }

        // Actualizar datos del cliente
        cliente.abonado = true;
        cliente.finAbono = ultimoDiaMes;
        cliente.precioAbono = tipoVehiculo;
        cliente.updatedAt = new Date();

        // Crear datos del movimiento
        const movimientoData = {
            cliente: id,
            descripcion: `Renovación abono ${tipoVehiculo}`,
            monto: precio,
            tipoVehiculo,
            operador: operador || 'Sistema',
            patente: patente || 'No especificada',
            metodoPago,
            factura: factura || 'CC',
            tipoTarifa: 'abono'
        };

        // 1. Guardar cliente actualizado
        await cliente.save({ session });
        
        // 2. Crear y guardar movimiento principal
        const movimiento = new Movimiento(movimientoData);
        await movimiento.save({ session });
        
        // 3. Crear y guardar movimiento cliente
        const movimientoCliente = new MovimientoCliente({
            cliente: id,
            descripcion: movimientoData.descripcion,
            monto: movimientoData.monto,
            tipoVehiculo: movimientoData.tipoVehiculo,
            operador: movimientoData.operador,
            patente: movimientoData.patente,
            fecha: new Date()
        });
        await movimientoCliente.save({ session });
        
        // 4. Asociar movimiento al cliente
        cliente.movimientos.push(movimientoCliente._id);
        await cliente.save({ session });
        
        await session.commitTransaction();
        
        // Verificación adicional
        const movimientoCreado = await MovimientoCliente.findById(movimientoCliente._id);
        if (!movimientoCreado) {
            throw new Error('No se pudo verificar la creación del movimiento cliente');
        }

        // Refrescar los datos del cliente para asegurarnos de que todo se guardó correctamente
        const clienteActualizado = await Cliente.findById(id).populate('abonos');

        res.status(200).json({
            message: 'Abono renovado exitosamente. Todos los abonos del cliente han sido activados.',
            cliente: clienteActualizado,
            movimiento,
            movimientoCliente: movimientoCreado
        });
        
    } catch (error) {
        await session.abortTransaction();
        console.error('Error al renovar abono:', error);
        res.status(500).json({ 
            message: 'Error al renovar abono', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        session.endSession();
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
