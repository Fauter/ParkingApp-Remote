// controllers/abonoControllers.js
const Abono    = require('../models/Abono');
const Vehiculo = require('../models/Vehiculo');
const path     = require('path');

// Nota: Multer ya se configura en las rutas, así que aquí solo usamos req.files y req.body

exports.getAbonos = async (req, res) => {
  try {
    const abonos = await Abono.find();
    res.json(abonos);
  } catch (error) {
    console.error('Error al obtener los abonos:', error);
    res.status(500).json({ message: 'Error al obtener los abonos' });
  }
};

exports.getAbonoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const abono = await Abono.findById(id);
    if (!abono) return res.status(404).json({ message: 'Abono no encontrado' });
    res.json(abono);
  } catch (error) {
    console.error('Error al obtener el abono:', error);
    res.status(500).json({ message: 'Error al obtener el abono' });
  }
};

exports.registrarMensual = async (req, res) => {
  try {
    const { body, files } = req;

    // Extraer de req.body todos los campos que envía el front
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
      fechaExpiracion, // viene como string "YYYY-MM-DD"
      precio,          // viene del frontend
      tipoTarifa       // "mensual"
    } = body;

    // Obtener nombres de archivo subidos
    const fotoSeguro      = files.fotoSeguro?.[0]?.filename      || '';
    const fotoDNI         = files.fotoDNI?.[0]?.filename         || '';
    const fotoCedulaVerde = files.fotoCedulaVerde?.[0]?.filename || '';
    const fotoCedulaAzul  = files.fotoCedulaAzul?.[0]?.filename  || '';

    // Construir el documento Abono
    const nuevoAbono = new Abono({
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
      // Convertir fechaExpiracion a Date si viene
      fechaExpiracion: fechaExpiracion ? new Date(fechaExpiracion) : undefined,
      precio: Number(precio),   // asegurar que sea número
      tipoTarifa,               // "mensual"
      fotoSeguro,
      fotoDNI,
      fotoCedulaVerde,
      fotoCedulaAzul
    });

    // Guardar el Abono
    const abonoGuardado = await nuevoAbono.save();

    // Vincular al Vehículo si existe
    const vehiculo = await Vehiculo.findOne({ patente });
    if (vehiculo) {
      vehiculo.abono   = abonoGuardado._id;
      vehiculo.abonado = true;
      await vehiculo.save();
    }

    return res.status(201).json({
      message: 'Abono mensual registrado exitosamente',
      abono: abonoGuardado
    });
  } catch (error) {
    console.error('Error al registrar abono mensual:', error);
    return res.status(500).json({ message: 'Error al registrar abono mensual' });
  }
};

exports.eliminarAbonos = async (req, res) => {
  try {
    await Abono.deleteMany();
    res.status(200).json({ message: 'Todos los abonos han sido eliminados exitosamente' });
  } catch (error) {
    console.error('Error al eliminar abonos:', error);
    res.status(500).json({ message: 'Error al eliminar abonos' });
  }
};
