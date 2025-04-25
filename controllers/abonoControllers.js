const Abono = require('../models/Abono');
const path = require('path');

exports.getAbonos = async (req, res) => {
  const abonos = await Abono.find();
  res.json(abonos);
};
  
exports.registrarAbono = async (req, res) => {
  try {
    const { body, files } = req;

    const fechaCreacion = new Date();
    const fechaExpiracion = new Date(fechaCreacion);
    fechaExpiracion.setMonth(fechaExpiracion.getMonth() + 1);

    const nuevoAbono = new Abono({
      ...body,
      fechaExpiracion,
      fotoSeguro: files.fotoSeguro?.[0]?.filename || '',
      fotoDNI: files.fotoDNI?.[0]?.filename || '',
      fotoCedulaVerde: files.fotoCedulaVerde?.[0]?.filename || '',
      fotoCedulaAzul: files.fotoCedulaAzul?.[0]?.filename || '',
    });

    await nuevoAbono.save();
    res.status(201).json({ message: 'Abono registrado exitosamente', abono: nuevoAbono });

  } catch (error) {
    console.error('Error al registrar abono:', error);
    res.status(500).json({ message: 'Error al registrar abono' });
  }
};

exports.eliminarAbonos = async (req, res) => {
  try {
    await Abono.deleteMany(); // Elimina todos los registros
    res.status(200).json({ message: 'Todos los abonos han sido eliminados exitosamente' });
  } catch (error) {
    console.error('Error al eliminar abonos:', error);
    res.status(500).json({ message: 'Error al eliminar abonos' });
  }
};

