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
      dniCuitCuil    // <-- lo desestructuramos aquí
    } = req.body;

    // Validaciones mínimas
    if (
      !nombreApellido?.trim() ||
      !email?.trim() ||
      !patente?.trim() ||
      !marca?.trim() ||
      !modelo?.trim() ||
      !tipoVehiculo?.trim() ||
      !dniCuitCuil?.trim()    // <-- validamos también este campo
    ) {
      console.warn('⚠️ registrarAbono - faltan campos obligatorios');
      return res.status(400).json({ message: 'Faltan datos obligatorios para crear el abono.' });
    }

    // Fecha actual y cálculo del último día del mes
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    const ultimoDiaMes = new Date(anioActual, mesActual + 1, 0);
    ultimoDiaMes.setHours(23, 59, 59, 999);

    const totalDiasMes = ultimoDiaMes.getDate();
    const diaActual = hoy.getDate();

    // Precio proporcional
    const preciosPorTipoVehiculo = { auto: 100000, camioneta: 160000, moto: 50000 };
    const precioBaseMensual = preciosPorTipoVehiculo[tipoVehiculo.toLowerCase()] || 100000;
    const precioFinal = diaActual === 1
      ? precioBaseMensual
      : Math.round((precioBaseMensual / totalDiasMes) * (totalDiasMes - diaActual + 1));
    console.log('ℹ️ registrarAbono - precioFinal:', precioFinal);

    // Archivos adjuntos
    const fotoSeguro = req.files?.fotoSeguro?.[0]?.filename ? `/fotos/${req.files.fotoSeguro[0].filename}` : '';
    const fotoDNI = req.files?.fotoDNI?.[0]?.filename ? `/fotos/${req.files.fotoDNI[0].filename}` : '';
    const fotoCedulaVerde = req.files?.fotoCedulaVerde?.[0]?.filename ? `/fotos/${req.files.fotoCedulaVerde[0].filename}` : '';
    const fotoCedulaAzul = req.files?.fotoCedulaAzul?.[0]?.filename ? `/fotos/${req.files.fotoCedulaAzul[0].filename}` : '';

    // Buscar o crear cliente
    let cliente = await Cliente.findOne({
      $or: [
        { nombreApellido: { $regex: `^${nombreApellido.trim()}$`, $options: 'i' } },
        { email }
      ]
    });
    console.log('🔍 registrarAbono - cliente encontrado:', cliente);

    if (!cliente) {
      cliente = new Cliente({
        nombreApellido: nombreApellido.trim(),
        domicilio,
        localidad,
        telefonoParticular,
        telefonoEmergencia,
        domicilioTrabajo,
        telefonoTrabajo,
        email,
        dniCuitCuil,           // <-- lo guardamos en el cliente
        abonos: [],
        vehiculos: [],
        balance: 0
      });
      await cliente.save();
      console.log('✅ registrarAbono - cliente creado:', cliente);
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
      dniCuitCuil,            // <-- y también en el abono si el schema lo requiere
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
      fotoCedulaAzul
    });
    const abonoGuardado = await nuevoAbono.save();
    console.log('✅ registrarAbono - abono guardado:', abonoGuardado);

    // Asociar abono al cliente
    if (!cliente.abonos.includes(abonoGuardado._id)) {
      cliente.abonos.push(abonoGuardado._id);
    }

    // Buscar o crear vehículo
    let vehiculo = await Vehiculo.findOne({ patente });
    console.log('🔍 registrarAbono - vehiculo encontrado:', vehiculo);

    if (vehiculo) {
      vehiculo.abono = abonoGuardado._id;
      vehiculo.abonado = true;
      await vehiculo.save();
      if (!cliente.vehiculos.includes(vehiculo._id)) {
        cliente.vehiculos.push(vehiculo._id);
      }
      console.log('✅ registrarAbono - vehiculo actualizado:', vehiculo);
    } else {
      vehiculo = new Vehiculo({
        patente,
        marca,
        modelo,
        color,
        anio: Number(anio),
        abono: abonoGuardado._id,
        abonado: true
      });
      await vehiculo.save();
      cliente.vehiculos.push(vehiculo._id);
      console.log('✅ registrarAbono - vehiculo creado:', vehiculo);
    }

    cliente.abonado = true;
    if (!cliente.finAbono || ultimoDiaMes > cliente.finAbono) {
      cliente.finAbono = ultimoDiaMes;
    }
    await cliente.save();
    console.log('✅ registrarAbono - cliente actualizado:', cliente);

    return res.status(201).json({
      message: 'Abono mensual registrado exitosamente',
      abono: abonoGuardado
    });

  } catch (error) {
    console.error('🔥 Error al registrar abono:', error);
    return res.status(500).json({ message: 'Error al registrar abono' });
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
