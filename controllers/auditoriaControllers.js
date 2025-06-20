const Vehiculo = require('../models/Vehiculo');
const Auditoria = require('../models/Auditoria');
const { createAuditPdf } = require('../services/pdfService');
const path = require('path');

const generarAuditoria = async (req, res) => {
  try {
    const { vehiculos = [], vehiculosTemporales = [], operador } = req.body;
    
    if (!operador) {
      return res.status(400).json({ error: 'Se requiere el nombre del operador' });
    }

    // Obtener SOLO vehículos que están actualmente en el sistema (con entrada y sin salida)
    const vehiculosEnSistema = await Vehiculo.find({
      'estadiaActual.entrada': { $exists: true, $ne: null },
      'estadiaActual.salida': { $exists: false }
    })
    .populate('tipoVehiculo')
    .populate('estadiaActual');

    // Obtener los datos de los vehículos chequeados (solo los que están en sistema)
    const vehiculosChequeadosData = vehiculosEnSistema.filter(v => 
      vehiculos.includes(v._id.toString())
    );

    // Formatear vehículos temporales
    const vehiculosTemporalesData = vehiculosTemporales.map(v => ({
      patente: v.patente,
      marca: v.marca,
      modelo: v.modelo,
      color: v.color,
      esTemporal: true,
      tipoVehiculo: v.tipoVehiculo,
      estadiaActual: {
        entrada: v.estadiaActual?.entrada || new Date().toISOString(),
        salida: null
      }
    }));

    // Determinar si hay conflicto
    const vehiculosNoChequeados = vehiculosEnSistema.filter(v => 
      !vehiculos.includes(v._id.toString())
    );
    
    const hayVehiculosNoVerificados = vehiculosNoChequeados.length > 0;
    const hayVehiculosTemporales = vehiculosTemporales.length > 0;
    const estadoAuditoria = (hayVehiculosNoVerificados || hayVehiculosTemporales) ? 'Conflicto' : 'OK';

    // Preparar los vehículos para la auditoría
    const vehiculosParaAuditoria = [
      // Vehículos chequeados (verificados)
      ...vehiculosChequeadosData.map(v => ({
        patente: v.patente,
        tipo: v.tipoVehiculo?.nombre || v.tipoVehiculo,
        esTemporal: false,
        fueVerificado: true,
        estadiaActual: v.estadiaActual
      })),
      // Vehículos temporales (siempre son verificados)
      ...vehiculosTemporalesData.map(v => ({
        patente: v.patente,
        tipo: v.tipoVehiculo?.nombre || v.tipoVehiculo,
        esTemporal: true,
        fueVerificado: true,
        estadiaActual: v.estadiaActual
      })),
      // Vehículos no chequeados (no verificados)
      ...vehiculosNoChequeados.map(v => ({
        patente: v.patente,
        tipo: v.tipoVehiculo?.nombre || v.tipoVehiculo,
        esTemporal: false,
        fueVerificado: false,
        estadiaActual: v.estadiaActual
      }))
    ];

    if (vehiculosParaAuditoria.length === 0) {
      return res.status(400).json({ error: 'No hay vehículos para auditar' });
    }

    // Generar el PDF
    const pdfBuffer = await createAuditPdf(vehiculosParaAuditoria, operador, estadoAuditoria);
    const fileName = `auditoria-${Date.now()}.pdf`;

    // Crear registro en la base de datos
    const nuevaAuditoria = new Auditoria({
      operador,
      vehiculosAuditados: vehiculosParaAuditoria.map(v => ({
        patente: v.patente,
        tipo: v.tipo,
        esTemporal: v.esTemporal,
        fueVerificado: v.fueVerificado
      })),
      auditoria: {
        nombreArchivo: fileName,
        path: `/api/auditorias/descargar/${fileName.replace('.pdf', '')}`,
        size: pdfBuffer.length,
        mimeType: 'application/pdf'
      },
      estado: estadoAuditoria,
      fechaHora: new Date()
    });

    await nuevaAuditoria.save();

    // Enviar el PDF como respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error al generar auditoría:', error);
    res.status(500).json({ error: 'Error interno del servidor al generar auditoría' });
  }
};

const obtenerAuditorias = async (req, res) => {
  try {
    const auditorias = await Auditoria.find().sort({ fechaHora: -1 });
    res.json(auditorias);
  } catch (error) {
    console.error('Error al obtener auditorías:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener auditorías' });
  }
};

const descargarAuditoria = async (req, res) => {
  try {
    const { id } = req.params;
    const auditoria = await Auditoria.findById(id);
    
    if (!auditoria) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    // Preparar los vehículos para regenerar el PDF
    const vehiculos = auditoria.vehiculosAuditados.map(v => ({
      patente: v.patente,
      tipoVehiculo: v.tipo,
      esTemporal: v.esTemporal,
      fueVerificado: v.fueVerificado,
      estadiaActual: { entrada: v.entrada }
    }));
    
    const pdfBuffer = await createAuditPdf(vehiculos, auditoria.operador, auditoria.estado);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${auditoria.auditoria.nombreArchivo}`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al descargar auditoría:', error);
    res.status(500).json({ error: 'Error interno del servidor al descargar auditoría' });
  }
};

const deleteAllAuditorias = async (req, res) => {
  try {
    const resultado = await Auditoria.deleteMany({});
    res.json({
      mensaje: 'Todas las auditorías fueron eliminadas correctamente.',
      cantidadEliminada: resultado.deletedCount
    });
  } catch (error) {
    console.error('Error al eliminar todas las auditorías:', error);
    res.status(500).json({ error: 'Error interno del servidor al eliminar auditorías' });
  }
};

module.exports = {
  generarAuditoria,
  obtenerAuditorias,
  descargarAuditoria,
  deleteAllAuditorias
};