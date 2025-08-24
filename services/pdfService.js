// services/pdfService.js
const PDFDocument = require('pdfkit');

async function createAuditPdf(vehiculos, operador, estadoAuditoria) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // Encabezado
    doc.fontSize(20).text('Reporte de Auditoría de Vehículos', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Fecha de generación: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.text(`Operador: ${operador}`, { align: 'center' });

    // Estado auditoría
    doc.moveDown();
    doc.fontSize(14).fillColor(estadoAuditoria === 'Conflicto' ? 'red' : 'green');
    doc.text(`Estado: ${estadoAuditoria}`, { align: 'center' });
    doc.fillColor('black');
    doc.moveDown(2);

    // Tabla
    const tableLeft = 50;
    const colCount = 4; // Patente | Tipo | Estado | Entrada
    const columnWidth = (doc.page.width - 100) / colCount;

    // Encabezados
    doc.font('Helvetica-Bold');
    doc.text('Patente', tableLeft, doc.y);
    doc.text('Tipo', tableLeft + columnWidth, doc.y);
    doc.text('Estado', tableLeft + columnWidth * 2, doc.y);
    doc.text('Entrada', tableLeft + columnWidth * 3, doc.y);
    doc.font('Helvetica');

    const headerY = doc.y;
    doc.moveTo(tableLeft, headerY + 20)
      .lineTo(tableLeft + columnWidth * colCount, headerY + 20)
      .stroke();

    let y = headerY + 30;

    vehiculos.forEach((vehiculo, index) => {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }

      let color = 'black';
      let estadoTexto = 'OK';

      if (!vehiculo.fueVerificado) {
        color = 'red';
        estadoTexto = 'No Encontrado';
      } else if (vehiculo.esTemporal) {
        color = '#007BFF'; // Azul
        estadoTexto = 'No Registrado';
      }

      const tipo = typeof vehiculo.tipoVehiculo === 'string'
        ? vehiculo.tipoVehiculo
        : vehiculo.tipoVehiculo?.nombre || vehiculo.tipo || 'N/A';

      const entradaStr = vehiculo.entrada
        ? new Date(vehiculo.entrada).toLocaleString()
        : (vehiculo.estadiaActual?.entrada ? new Date(vehiculo.estadiaActual.entrada).toLocaleString() : '—');

      doc.fillColor(color);
      doc.text(vehiculo.patente || 'N/A', tableLeft, y);
      doc.text(tipo || 'N/A', tableLeft + columnWidth, y);
      doc.text(estadoTexto, tableLeft + columnWidth * 2, y);
      doc.text(entradaStr, tableLeft + columnWidth * 3, y);
      doc.fillColor('black');

      y += 25;

      if (index < vehiculos.length - 1) {
        doc.moveTo(tableLeft, y - 5)
          .lineTo(tableLeft + columnWidth * colCount, y - 5)
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

module.exports = { createAuditPdf };
