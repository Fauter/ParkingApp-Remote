function calcularDetalleCliente({ tipoVehiculo, inicio, dias, hora, tarifas, precios, parametros } = {}) {
  if (!tipoVehiculo) return 'Debe seleccionar un tipo de vehículo.';

  const entrada = inicio ? new Date(inicio) : new Date();
  if (isNaN(entrada)) return 'Fecha de inicio inválida';

  const [h, m] = (hora || '00:00').split(':').map(Number);
  const salida = new Date(entrada);
  salida.setDate(salida.getDate() + Number(dias || 0));
  salida.setHours(salida.getHours() + h);
  salida.setMinutes(salida.getMinutes() + m);

  let minutosTotales = Math.ceil((salida - entrada) / 60000);
  if (minutosTotales <= 0) return '';

  const tipoVehiculoKey = tipoVehiculo.toLowerCase();
  const fraccionarDesdeMinutos = Number(parametros.fraccionarDesde || 0);
  if (fraccionarDesdeMinutos > 0 && minutosTotales <= fraccionarDesdeMinutos) {
    minutosTotales = fraccionarDesdeMinutos;
  }

  const tarifasHora = tarifas
    .filter(t => t.tipo === 'hora')
    .map(t => ({
      ...t,
      totalMin: (t.dias * 1440) + (t.horas * 60) + t.minutos,
    }))
    .sort((a, b) => a.totalMin - b.totalMin);

  if (!tarifasHora.length) return 'No hay tarifas horarias configuradas.';

  let tiempoRestante = minutosTotales;
  const tarifasUsadas = {};
  let costoTotal = 0;

  while (tiempoRestante > 0) {
    // Encontrar la tarifa más grande que se pueda aplicar sin pasarse
    let tarifaAplicada = null;

    for (let i = tarifasHora.length - 1; i >= 0; i--) {
      const t = tarifasHora[i];
      const tolerancia = t.tolerancia || 0;
      const nombre = t.nombre.toLowerCase();
      const precio = precios[tipoVehiculoKey]?.[nombre] ?? 0;

      if (tiempoRestante >= t.totalMin) {
        // Si me paso pero dentro de la tolerancia, se redondea hacia abajo
        if (tiempoRestante < t.totalMin + tolerancia) {
          tiempoRestante = 0;
        } else {
          tiempoRestante -= t.totalMin;
        }

        tarifasUsadas[nombre] = tarifasUsadas[nombre] || { cantidad: 0, precio };
        tarifasUsadas[nombre].cantidad += 1;
        costoTotal += precio;

        tarifaAplicada = true;
        break;
      }
    }

    if (!tarifaAplicada) {
      // Si no aplicó ninguna tarifa (por ser muy poco tiempo), se cobra la mínima
      const menorTarifa = tarifasHora[0];
      const nombre = menorTarifa.nombre.toLowerCase();
      const precio = precios[tipoVehiculoKey]?.[nombre] ?? 0;

      tarifasUsadas[nombre] = tarifasUsadas[nombre] || { cantidad: 0, precio };
      tarifasUsadas[nombre].cantidad += 1;
      costoTotal += precio;
      tiempoRestante = 0;
    }
  }

  // Armar resumen
  let resumen = '';
  for (const [nombre, { cantidad, precio }] of Object.entries(tarifasUsadas)) {
    resumen += `${cantidad} x ${nombre.charAt(0).toUpperCase() + nombre.slice(1)} = $${cantidad * precio}\n`;
  }

  return resumen.trim() + `\n\nTotal: $${costoTotal}`;
}

module.exports = calcularDetalleCliente;
