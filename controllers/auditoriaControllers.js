// controllers/auditoriaControllers.js
const path = require('path');
const Auditoria = require('../models/Auditoria');
const Vehiculo = require('../models/Vehiculo');
const { createAuditPdf } = require('../services/pdfService');

const generarAuditoria = async (req, res) => {
  try {
    const { vehiculos = [], vehiculosTemporales = [], operador } = req.body;

    if (!operador) {
      return res.status(400).json({ error: 'Se requiere el nombre del operador' });
    }

    // Vehículos en sistema (entrada existe y no hay salida)
    const vehiculosEnSistema = await Vehiculo.find({
      'estadiaActual.entrada': { $exists: true, $ne: null },
      'estadiaActual.salida': { $exists: false }
    })
    .populate('tipoVehiculo'); // por si es ref

    // Chequeados (por ID recibido)
    const vehiculosChequeados = vehiculosEnSistema.filter(v => vehiculos.includes(v._id.toString()));

    // Temporales (del body)
    const vehiculosTemporalesData = (vehiculosTemporales || []).map(v => ({
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

    // No chequeados
    const vehiculosNoChequeados = vehiculosEnSistema.filter(v => !vehiculos.includes(v._id.toString()));

    const hayVehiculosNoVerificados = vehiculosNoChequeados.length > 0;
    const hayVehiculosTemp = vehiculosTemporalesData.length > 0;
    const estadoAuditoria = (hayVehiculosNoVerificados || hayVehiculosTemp) ? 'Conflicto' : 'OK';

    // Normalizamos a un array plano con los flags para el PDF y para persistir
    const vehiculosParaAuditoria = [
      // Verificados
      ...vehiculosChequeados.map(v => ({
        patente: v.patente,
        tipoVehiculo: v.tipoVehiculo?.nombre || v.tipoVehiculo, // para PDF
        tipo: v.tipoVehiculo?.nombre || (typeof v.tipoVehiculo === 'string' ? v.tipoVehiculo : 'N/A'), // para persistir
        esTemporal: false,
        fueVerificado: true,
        entrada: v.estadiaActual?.entrada || undefined,
        estadiaActual: v.estadiaActual
      })),
      // Temporales (verificados por definición)
      ...vehiculosTemporalesData.map(v => ({
        patente: v.patente,
        tipoVehiculo: v.tipoVehiculo,
        tipo: typeof v.tipoVehiculo === 'string' ? v.tipoVehiculo : v.tipoVehiculo?.nombre || 'N/A',
        esTemporal: true,
        fueVerificado: true,
        entrada: v.estadiaActual?.entrada || undefined,
        estadiaActual: v.estadiaActual
      })),
      // No verificados
      ...vehiculosNoChequeados.map(v => ({
        patente: v.patente,
        tipoVehiculo: v.tipoVehiculo?.nombre || v.tipoVehiculo,
        tipo: v.tipoVehiculo?.nombre || (typeof v.tipoVehiculo === 'string' ? v.tipoVehiculo : 'N/A'),
        esTemporal: false,
        fueVerificado: false,
        entrada: v.estadiaActual?.entrada || undefined,
        estadiaActual: v.estadiaActual
      }))
    ];

    if (vehiculosParaAuditoria.length === 0) {
      return res.status(400).json({ error: 'No hay vehículos para auditar' });
    }

    // Generar PDF en memoria
    const pdfBuffer = await createAuditPdf(vehiculosParaAuditoria, operador, estadoAuditoria);
    const fileName = `auditoria-${Date.now()}.pdf`;

    // 1) Guardar la auditoría para obtener _id
    const nueva = await Auditoria.create({
      operador,
      vehiculosAuditados: vehiculosParaAuditoria.map(v => ({
        patente: v.patente,
        tipo: v.tipo,
        esTemporal: v.esTemporal,
        fueVerificado: v.fueVerificado,
        entrada: v.entrada
      })),
      auditoria: {
        nombreArchivo: fileName,
        // el path se setea luego con el _id real
        size: pdfBuffer.length,
        mimeType: 'application/pdf'
      },
      estado: estadoAuditoria,
      fechaHora: new Date()
    });

    // 2) Actualizar el path ahora que tenemos el _id
    const pathDescarga = `/api/auditorias/descargar/${nueva._id}`;
    nueva.auditoria.path = pathDescarga;
    await nueva.save();

    // Responder el PDF para descarga inmediata
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('Error al generar auditoría:', error);
    return res.status(500).json({ error: 'Error interno del servidor al generar auditoría' });
  }
};

const obtenerAuditorias = async (_req, res) => {
  try {
    const auditorias = await Auditoria.find().sort({ fechaHora: -1 }).lean();
    return res.json(auditorias);
  } catch (error) {
    console.error('Error al obtener auditorías:', error);
    return res.status(500).json({ error: 'Error interno del servidor al obtener auditorías' });
  }
};

const descargarAuditoria = async (req, res) => {
  try {
    const { id } = req.params;
    const auditoria = await Auditoria.findById(id).lean();

    if (!auditoria) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    // Reconstruimos el array para el PDF
    const vehiculos = (auditoria.vehiculosAuditados || []).map(v => ({
      patente: v.patente,
      tipoVehiculo: v.tipo,      // el generador de PDF espera 'tipoVehiculo' para dibujar
      esTemporal: v.esTemporal,
      fueVerificado: v.fueVerificado,
      entrada: v.entrada
    }));

    const fileName = auditoria.auditoria?.nombreArchivo || `auditoria-${id}.pdf`;
    const pdfBuffer = await createAuditPdf(vehiculos, auditoria.operador, auditoria.estado);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al descargar auditoría:', error);
    return res.status(500).json({ error: 'Error interno del servidor al descargar auditoría' });
  }
};

const deleteAllAuditorias = async (_req, res) => {
  try {
    const resultado = await Auditoria.deleteMany({});
    return res.json({
      mensaje: 'Todas las auditorías fueron eliminadas correctamente.',
      cantidadEliminada: resultado.deletedCount
    });
  } catch (error) {
    console.error('Error al eliminar todas las auditorías:', error);
    return res.status(500).json({ error: 'Error interno del servidor al eliminar auditorías' });
  }
};

module.exports = {
  generarAuditoria,
  obtenerAuditorias,
  descargarAuditoria,
  deleteAllAuditorias
};
