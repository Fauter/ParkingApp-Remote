const TipoVehiculo = require('../models/TipoVehiculo');

// Obtener todos los tipos de vehículo
exports.getTiposVehiculo = async (req, res) => {
    try {
        const tipos = await TipoVehiculo.find({}, 'nombre');
        res.json(tipos.map(t => ({ nombre: t.nombre })));
    } catch (err) {
        console.error('💥 Error al obtener tipos de vehículo:', err);
        res.status(500).json({ msg: 'Error del servidor' });
    }
};

// Crear un nuevo tipo de vehículo
exports.crearTipoVehiculo = async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) return res.status(400).json({ msg: 'Nombre es requerido' });

  try {
    const existente = await TipoVehiculo.findOne({ nombre });
    if (existente) return res.status(409).json({ msg: 'Ya existe ese tipo' });

    const nuevo = new TipoVehiculo({ nombre });
    await nuevo.save();
    res.status(201).json({ msg: 'Tipo creado correctamente', tipo: nombre });
  } catch (err) {
    console.error('💥 Error al crear tipo:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Eliminar un tipo de vehículo
exports.eliminarTipoVehiculo = async (req, res) => {
  const { nombre } = req.params;

  try {
    const eliminado = await TipoVehiculo.findOneAndDelete({ nombre });
    if (!eliminado) return res.status(404).json({ msg: 'Tipo no encontrado' });

    res.json({ msg: 'Tipo eliminado correctamente', tipo: nombre });
  } catch (err) {
    console.error('💥 Error al eliminar tipo:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

exports.actualizarTipoVehiculo = async (req, res) => {
  const { nombre } = req.params; // nombre actual
  const { nuevoNombre } = req.body; // nuevo nombre

  if (!nuevoNombre) return res.status(400).json({ msg: 'Nuevo nombre requerido' });

  try {
    const existente = await TipoVehiculo.findOne({ nombre: nuevoNombre });
    if (existente) return res.status(409).json({ msg: 'Ya existe ese tipo con el nuevo nombre' });

    const actualizado = await TipoVehiculo.findOneAndUpdate(
      { nombre },
      { nombre: nuevoNombre },
      { new: true }
    );

    if (!actualizado) return res.status(404).json({ msg: 'Tipo no encontrado' });

    res.json({ msg: 'Tipo actualizado correctamente', tipo: actualizado.nombre });
  } catch (err) {
    console.error('💥 Error al actualizar tipo:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Poblar con los tipos básicos
exports.poblarTiposBasicos = async (req, res) => {
    try {
        const tiposBasicos = ['auto', 'camioneta', 'moto'];

        for (const nombre of tiposBasicos) {
            await TipoVehiculo.updateOne(
                { nombre },
                { nombre },
                { upsert: true }
            );
        }

        res.json({ msg: 'Tipos de vehículo básicos poblados correctamente' });
    } catch (err) {
        console.error('💥 Error al poblar tipos de vehículo:', err);
        res.status(500).json({ msg: 'Error del servidor' });
    }
};
