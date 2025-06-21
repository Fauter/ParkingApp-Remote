const mongoose = require('mongoose');
const Abono = require('../models/Abono');
const Vehiculo = require('../models/Vehiculo');
const Cliente = require('../models/Cliente');

exports.registrarAbono = async (req, res) => {
  try {
    console.log('📥 registrarAbono - req.body:', req.body);
    console.log('📥 registrarAbono - req.files:', req.files);

    const { 
      nombreApellido,
      domicilio,
      localidad,
      telefonoParticular,
      telefonoEmergencia,
      domicilioTrabajo,
      telefonoTrabajo,
      email,
      patente,
      marca,
      modelo,
      color,
      anio,
      companiaSeguro,
      metodoPago,
      factura,
      tipoVehiculo,
      dniCuitCuil,
      cliente: clienteId // Asegurémonos de recibir el ID del cliente
    } = req.body;

    // Validaciones mínimas
    if (
      !nombreApellido?.trim() ||
      !email?.trim() ||
      !patente?.trim() ||
      !tipoVehiculo?.trim() ||
      !dniCuitCuil?.trim() ||
      !clienteId
    ) {
      console.warn('⚠️ registrarAbono - faltan campos obligatorios');
      return res.status(400).json({ message: 'Faltan datos obligatorios para crear el abono.' });
    }

    // Fecha actual y cálculo del último día del mes
    const hoy = new Date();
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    ultimoDiaMes.setHours(23, 59, 59, 999);

    const totalDiasMes = ultimoDiaMes.getDate();
    const diaActual = hoy.getDate();

    // Precio proporcional
    const preciosPorTipoVehiculo = { auto: 100000, camioneta: 160000, moto: 50000 };
    const precioBaseMensual = preciosPorTipoVehiculo[tipoVehiculo.toLowerCase()] || 100000;
    const precioFinal = diaActual === 1
      ? precioBaseMensual
      : Math.round((precioBaseMensual / totalDiasMes) * (totalDiasMes - diaActual + 1));

    // Archivos adjuntos
    const fotoSeguro = req.files?.fotoSeguro?.[0]?.filename ? `/fotos/${req.files.fotoSeguro[0].filename}` : '';
    const fotoDNI = req.files?.fotoDNI?.[0]?.filename ? `/fotos/${req.files.fotoDNI[0].filename}` : '';
    const fotoCedulaVerde = req.files?.fotoCedulaVerde?.[0]?.filename ? `/fotos/${req.files.fotoCedulaVerde[0].filename}` : '';
    const fotoCedulaAzul = req.files?.fotoCedulaAzul?.[0]?.filename ? `/fotos/${req.files.fotoCedulaAzul[0].filename}` : '';

    // Obtener el cliente (debería existir ya que pasamos el ID)
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    // Crear nuevo abono
    const nuevoAbono = new Abono({
      nombreApellido: nombreApellido.trim(),
      domicilio,
      localidad,
      telefonoParticular,
      telefonoEmergencia,
      domicilioTrabajo,
      telefonoTrabajo,
      email,
      dniCuitCuil,
      patente,
      marca,
      modelo,
      color,
      anio: Number(anio),
      companiaSeguro,
      precio: precioFinal,
      metodoPago,
      factura,
      tipoVehiculo,
      tipoAbono: { nombre: 'Mensual', dias: totalDiasMes },
      fechaExpiracion: ultimoDiaMes,
      fotoSeguro,
      fotoDNI,
      fotoCedulaVerde,
      fotoCedulaAzul,
      cliente: clienteId // Asignamos explícitamente el cliente
    });

    const abonoGuardado = await nuevoAbono.save();

    // Actualizar el cliente
    cliente.abonado = true;
    cliente.finAbono = ultimoDiaMes;
    cliente.precioAbono = tipoVehiculo;
    
    // Asegurarnos de que el abono no esté ya en el array
    if (!cliente.abonos.includes(abonoGuardado._id)) {
      cliente.abonos.push(abonoGuardado._id);
    }

    // Buscar o crear vehículo
    let vehiculo = await Vehiculo.findOne({ patente });

    if (vehiculo) {
      vehiculo.abono = abonoGuardado._id;
      vehiculo.abonado = true;
      vehiculo.tipoVehiculo = tipoVehiculo;
      await vehiculo.save();
      
      // Asegurarnos de que el vehículo no esté ya en el array
      if (!cliente.vehiculos.includes(vehiculo._id)) {
        cliente.vehiculos.push(vehiculo._id);
      }
    } else {
      vehiculo = new Vehiculo({
        patente,
        marca,
        modelo,
        color,
        anio: Number(anio),
        tipoVehiculo,
        abono: abonoGuardado._id,
        abonado: true,
        cliente: clienteId
      });
      await vehiculo.save();
      cliente.vehiculos.push(vehiculo._id);
    }

    await cliente.save();

    return res.status(201).json({
      message: 'Abono mensual registrado exitosamente',
      abono: abonoGuardado,
      cliente
    });

  } catch (error) {
    console.error('🔥 Error al registrar abono:', error);
    return res.status(500).json({ message: 'Error al registrar abono', error: error.message });
  }
};

exports.agregarAbono = async (req, res) => {
  try {
    console.log('📥 agregarAbono - req.body:', req.body);
    console.log('📥 agregarAbono - req.files:', req.files);

    // Extraer datos del body
    const { 
      nombreApellido,
      domicilio,
      localidad,
      telefonoParticular,
      telefonoEmergencia,
      domicilioTrabajo,
      telefonoTrabajo,
      email,
      patente,
      marca,
      modelo,
      color,
      anio,
      companiaSeguro,
      metodoPago = "Efectivo", // Valor por defecto
      factura = "CC", // Valor por defecto
      tipoVehiculo,
      dniCuitCuil,
      clienteId // Cambiado de 'cliente' a 'clienteId' para mayor claridad
    } = req.body;

    // Validaciones mínimas
    if (!patente?.trim() || !tipoVehiculo?.trim() || !clienteId) {
      console.warn('⚠️ agregarAbono - faltan campos obligatorios:', {
        patente: patente?.trim(),
        tipoVehiculo: tipoVehiculo?.trim(),
        clienteId
      });
      return res.status(400).json({ 
        message: 'Faltan datos obligatorios: patente, tipoVehiculo o clienteId' 
      });
    }

    // Obtener el cliente
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    // Usar datos del cliente si no vienen en el body
    const nombreCompleto = nombreApellido?.trim() || cliente.nombreApellido;
    const emailCliente = email?.trim() || cliente.email || '';
    const dni = dniCuitCuil?.trim() || cliente.dniCuitCuil || '';

    // Fecha actual y cálculo del último día del mes
    const hoy = new Date();
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    ultimoDiaMes.setHours(23, 59, 59, 999);

    const totalDiasMes = ultimoDiaMes.getDate();
    const diaActual = hoy.getDate();

    // Precio proporcional
    const preciosPorTipoVehiculo = { auto: 100000, camioneta: 160000, moto: 50000 };
    const precioBaseMensual = preciosPorTipoVehiculo[tipoVehiculo.toLowerCase()] || 100000;
    const precioFinal = diaActual === 1
      ? precioBaseMensual
      : Math.round((precioBaseMensual / totalDiasMes) * (totalDiasMes - diaActual + 1));

    // Archivos adjuntos
    const fotoSeguro = req.files?.fotoSeguro?.[0]?.filename ? `/fotos/${req.files.fotoSeguro[0].filename}` : '';
    const fotoDNI = req.files?.fotoDNI?.[0]?.filename ? `/fotos/${req.files.fotoDNI[0].filename}` : '';
    const fotoCedulaVerde = req.files?.fotoCedulaVerde?.[0]?.filename ? `/fotos/${req.files.fotoCedulaVerde[0].filename}` : '';
    const fotoCedulaAzul = req.files?.fotoCedulaAzul?.[0]?.filename ? `/fotos/${req.files.fotoCedulaAzul[0].filename}` : '';

    // Crear nuevo abono
    const nuevoAbono = new Abono({
      nombreApellido: nombreCompleto,
      domicilio: domicilio || cliente.domicilio || '',
      localidad: localidad || cliente.localidad || '',
      telefonoParticular: telefonoParticular || cliente.telefonoParticular || '',
      telefonoEmergencia: telefonoEmergencia || cliente.telefonoEmergencia || '',
      domicilioTrabajo: domicilioTrabajo || cliente.domicilioTrabajo || '',
      telefonoTrabajo: telefonoTrabajo || cliente.telefonoTrabajo || '',
      email: emailCliente,
      dniCuitCuil: dni,
      patente: patente.trim(),
      marca: marca || '',
      modelo: modelo || '',
      color: color || '',
      anio: anio ? Number(anio) : null,
      companiaSeguro: companiaSeguro || '',
      precio: precioFinal,
      metodoPago,
      factura,
      tipoVehiculo,
      tipoAbono: { nombre: 'Mensual', dias: totalDiasMes },
      fechaExpiracion: ultimoDiaMes,
      fotoSeguro,
      fotoDNI,
      fotoCedulaVerde,
      fotoCedulaAzul,
      cliente: clienteId
    });

    const abonoGuardado = await nuevoAbono.save();

    // Actualizar el cliente
    cliente.abonado = true;
    cliente.finAbono = ultimoDiaMes;
    cliente.precioAbono = tipoVehiculo;
    
    if (!cliente.abonos.includes(abonoGuardado._id)) {
      cliente.abonos.push(abonoGuardado._id);
    }

    // Buscar o crear vehículo
    let vehiculo = await Vehiculo.findOne({ patente: patente.trim() });

    if (vehiculo) {
      vehiculo.abono = abonoGuardado._id;
      vehiculo.abonado = true;
      vehiculo.tipoVehiculo = tipoVehiculo;
      await vehiculo.save();
      
      if (!cliente.vehiculos.includes(vehiculo._id)) {
        cliente.vehiculos.push(vehiculo._id);
      }
    } else {
      vehiculo = new Vehiculo({
        patente: patente.trim(),
        marca: marca || '',
        modelo: modelo || '',
        color: color || '',
        anio: anio ? Number(anio) : null,
        tipoVehiculo,
        abono: abonoGuardado._id,
        abonado: true,
        cliente: clienteId
      });
      await vehiculo.save();
      cliente.vehiculos.push(vehiculo._id);
    }

    await cliente.save();

    return res.status(201).json({
      message: 'Abono mensual registrado exitosamente',
      abono: abonoGuardado,
      cliente
    });

  } catch (error) {
    console.error('🔥 Error al registrar abono:', error);
    return res.status(500).json({ message: 'Error al registrar abono', error: error.message });
  }
};

exports.getAbonos = async (req, res) => {
  try {
    const abonos = await Abono.find().sort({ createdAt: -1 });
    res.status(200).json(abonos);
  } catch (error) {
    console.error('Error al obtener abonos:', error);
    res.status(500).json({ message: 'Error al obtener abonos' });
  }
};

exports.getAbonoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const abono = await Abono.findById(id);

    if (!abono) {
      return res.status(404).json({ message: 'Abono no encontrado' });
    }

    res.status(200).json(abono);

  } catch (error) {
    console.error('Error al obtener abono por ID:', error);
    res.status(500).json({ message: 'Error al obtener abono por ID' });
  }
};

exports.eliminarAbonos = async (req, res) => {
  try {
    await Abono.deleteMany({});
    res.status(200).json({ message: 'Todos los abonos fueron eliminados.' });
  } catch (error) {
    console.error('Error al eliminar abonos:', error);
    res.status(500).json({ message: 'Error al eliminar abonos' });
  }
};
