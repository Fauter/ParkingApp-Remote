// services/pdfService.js
const PDFDocument = require('pdfkit');

async function createAuditPdf(vehiculos, operador, estadoAuditoria) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // Encabezado del documento
    doc.fontSize(20).text('Reporte de Auditoría de Vehículos', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Fecha de generación: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.text(`Operador: ${operador}`, { align: 'center' });
    
    // Mostrar estado de la auditoría
    doc.moveDown();
    doc.fontSize(14).text(`Estado: ${estadoAuditoria}`, { 
      align: 'center',
      color: estadoAuditoria === 'Conflicto' ? 'red' : 'green'
    });
    doc.moveDown(2);

    // Tabla de vehículos
    const tableTop = doc.y;
    const tableLeft = 50;
    const columnWidth = (doc.page.width - 100) / 5;

    // Encabezados de tabla
    doc.font('Helvetica-Bold');
    doc.text('Patente', tableLeft, tableTop);
    doc.text('Tipo', tableLeft + columnWidth, tableTop);
    doc.text('Entrada', tableLeft + columnWidth * 2, tableTop);
    doc.text('Estado', tableLeft + columnWidth * 3, tableTop);
    doc.text('Tiempo Estacionado', tableLeft + columnWidth * 4, tableTop);
    doc.font('Helvetica');

    // Línea separadora
    doc.moveTo(tableLeft, tableTop + 20)
      .lineTo(tableLeft + columnWidth * 5, tableTop + 20)
      .stroke();

    let y = tableTop + 30;

    // Filas de datos
    vehiculos.forEach((vehiculo, index) => {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }

      const entrada = vehiculo.estadiaActual?.entrada 
        ? new Date(vehiculo.estadiaActual.entrada) 
        : null;
      
      const tiempoEstacionado = entrada 
        ? formatDuration(Date.now() - entrada.getTime()) 
        : 'N/A';

      const estado = vehiculo.esTemporal ? 'Temporal' : 'Sistema';
      const tipo = typeof vehiculo.tipoVehiculo === 'string' 
        ? vehiculo.tipoVehiculo 
        : vehiculo.tipoVehiculo?.nombre;

      // Establecer color según el tipo de vehículo
      let textColor = 'black';
      if (!vehiculo.fueVerificado) {
        textColor = 'red'; // No verificados en rojo
      } else if (vehiculo.esTemporal) {
        textColor = '#FFA500'; // Temporales en amarillo/naranja
      }
      
      doc.fillColor(textColor);

      doc.text(vehiculo.patente || 'N/A', tableLeft, y);
      doc.text(tipo || 'N/A', tableLeft + columnWidth, y);
      doc.text(entrada ? entrada.toLocaleString() : 'N/A', tableLeft + columnWidth * 2, y);
      doc.text(estado, tableLeft + columnWidth * 3, y);
      doc.text(tiempoEstacionado, tableLeft + columnWidth * 4, y);

      // Restaurar color a negro para el resto
      doc.fillColor('black');

      y += 25;

      // Línea separadora entre filas
      if (index < vehiculos.length - 1) {
        doc.moveTo(tableLeft, y - 5)
          .lineTo(tableLeft + columnWidth * 5, y - 5)
          .stroke();
      }
    });

    // Resumen
    doc.moveDown(2);
    doc.fontSize(12).text('Resumen:', { underline: true });
    doc.fontSize(10);
    doc.text(`Total vehículos en sistema: ${vehiculos.filter(v => !v.esTemporal).length}`);
    doc.text(`Total vehículos temporales: ${vehiculos.filter(v => v.esTemporal).length}`);
    doc.text(`Total verificados: ${vehiculos.filter(v => v.fueVerificado).length}`);
    doc.text(`Total no verificados: ${vehiculos.filter(v => !v.fueVerificado).length}`);
    doc.text(`Total auditados: ${vehiculos.length}`);

    doc.end();
  });
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);

  return parts.join(' ') || '0m';
}

module.exports = { createAuditPdf };