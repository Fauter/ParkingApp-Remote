const Abono = require('../models/Abono');
const Vehiculo = require('../models/Vehiculo');
const Cliente = require('../models/Cliente');

exports.registrarAbono = async (req, res) => {
  try {
    // En backend con multer para archivos, los datos normales vienen en req.body
    // Los archivos vienen en req.files (objeto con arrays de archivos)

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
      precio,
    } = req.body;

    console.log('req.body completo:', req.body);
    console.log('tipoVehiculo recibido:', tipoVehiculo);
    
    let tarifaSeleccionada = req.body.tarifaSeleccionada;

    // Si viene como string y empieza con '{' o '[', entonces parsear, sino dejarlo como string
    if (typeof tarifaSeleccionada === 'string' && (tarifaSeleccionada.startsWith('{') || tarifaSeleccionada.startsWith('['))) {
      try {
        tarifaSeleccionada = JSON.parse(tarifaSeleccionada);
      } catch (e) {
        console.error('Error al parsear tarifaSeleccionada:', e);
        tarifaSeleccionada = null;
      }
    }

    // Si tarifaSeleccionada es string (id), deberías buscar el objeto tarifa en la base antes de usarlo
    if (typeof tarifaSeleccionada === 'string') {
      // Suponiendo que tienes un modelo Tarifa para buscar
      const Tarifa = require('../models/Tarifa');
      tarifaSeleccionada = await Tarifa.findById(tarifaSeleccionada);
      if (!tarifaSeleccionada) {
        return res.status(400).json({ message: 'Tarifa seleccionada no encontrada' });
      }
    }

    // Validaciones mínimas
    if (
      !nombreApellido?.trim() ||
      !email?.trim() ||
      !patente?.trim() ||
      !marca?.trim() ||
      !modelo?.trim() ||
      !tipoVehiculo?.trim() ||
      !tarifaSeleccionada ||  // Aquí ya es objeto
      precio == null          // aceptamos precio = 0
    ) {
      return res.status(400).json({ message: 'Faltan datos obligatorios para crear el abono.' });
    }

    // Extraer filenames si vienen archivos
    const fotoSeguro = req.files?.fotoSeguro?.[0]?.filename || '';
    const fotoDNI = req.files?.fotoDNI?.[0]?.filename || '';
    const fotoCedulaVerde = req.files?.fotoCedulaVerde?.[0]?.filename || '';
    const fotoCedulaAzul = req.files?.fotoCedulaAzul?.[0]?.filename || '';

    // Buscar cliente por nombreApellido (insensible a mayúsculas)
    let cliente = await Cliente.findOne({ nombreApellido: { $regex: `^${nombreApellido.trim()}$`, $options: 'i' } });
    if (!cliente) {
      cliente = await Cliente.findOne({ email });
    }
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
        abonos: [],
        vehiculos: [],
        balance: 0
      });
      await cliente.save();
    }

    // Calcular fecha expiración sumando días
    const fechaExpiracion = new Date();
    const diasDuracion = parseInt(tarifaSeleccionada.dias, 10);
    if (!isNaN(diasDuracion)) {
      fechaExpiracion.setDate(fechaExpiracion.getDate() + diasDuracion);
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
      patente,
      marca,
      modelo,
      color,
      anio: Number(anio),
      companiaSeguro,
      precio: Number(precio),
      metodoPago,
      factura,
      tipoVehiculo,
      tipoAbono: {
        nombre: tarifaSeleccionada.nombre,
        dias: diasDuracion
      },
      fechaExpiracion,
      fotoSeguro,
      fotoDNI,
      fotoCedulaVerde,
      fotoCedulaAzul
    });

    const abonoGuardado = await nuevoAbono.save();

    // Asociar abono al cliente (guardar solo ID)
    if (!cliente.abonos.includes(abonoGuardado._id)) {
      cliente.abonos.push(abonoGuardado._id);
    }

    // Buscar vehículo por patente
    let vehiculo = await Vehiculo.findOne({ patente });

    if (vehiculo) {
      vehiculo.abono = abonoGuardado._id;
      vehiculo.abonado = true;
      await vehiculo.save();

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
        abono: abonoGuardado._id,
        abonado: true
      });
      await vehiculo.save();
      cliente.vehiculos.push(vehiculo._id);
    }

    await cliente.save();

    return res.status(201).json({
      message: 'Abono registrado exitosamente',
      abono: abonoGuardado
    });

  } catch (error) {
    console.error('Error al registrar abono:', error);
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
