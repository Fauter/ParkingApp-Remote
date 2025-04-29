function calcularDetalleCliente({ tipoVehiculo, inicio, dias, hora, tarifas, precios, parametros } = {}) {
  if (!tipoVehiculo) return 'Debe seleccionar un tipo de vehículo.';

  const horaStr = hora || '01:00';
  const entrada = inicio ? new Date(inicio) : new Date();
  if (isNaN(entrada)) return 'Fecha de inicio inválida';

  const tiempoTotal = new Date(entrada);
  tiempoTotal.setDate(tiempoTotal.getDate() + Number(dias || 0));

  const [h, m] = horaStr.split(':').map(Number);
  tiempoTotal.setHours(tiempoTotal.getHours() + h);
  tiempoTotal.setMinutes(tiempoTotal.getMinutes() + m);

  const msTotal = tiempoTotal - entrada;
  let minutosTotales = Math.ceil(msTotal / 1000 / 60);

  const fraccionarDesdeMinutos = Number(parametros.fraccionarDesde || 0);
  if (fraccionarDesdeMinutos > 0 && minutosTotales < fraccionarDesdeMinutos) {
    minutosTotales = fraccionarDesdeMinutos;
  }
  if (minutosTotales <= 0) return 'Duración inválida';

  // Filtrar solo las tarifas de tipo "hora"
  const tarifasFiltradas = tarifas.filter(t => t.tipo === 'hora');

  // Asegúrate de usar solo las tarifas filtradas en la lógica posterior
  const tarifasOrdenadas = tarifasFiltradas
    .map(t => {
      const totalMin = t.dias * 1440 + t.horas * 60 + t.minutos;
      return { ...t, totalMin };
    })
    .sort((a, b) => a.totalMin - b.totalMin);

  let tiempoRestante = minutosTotales;
  const tipoVehiculoKey = tipoVehiculo.toLowerCase();
  let resumen = '';
  let costoTotal = 0;
  const tarifasUsadas = {};

  for (let i = tarifasOrdenadas.length - 1; i >= 0; i--) {
    const tarifa = tarifasOrdenadas[i];
    const { totalMin, tolerancia } = tarifa;
    const nombre = tarifa.nombre.toLowerCase();
    const precio = precios[tipoVehiculoKey]?.[nombre] ?? 0;

    while (
      tiempoRestante >= totalMin + tolerancia ||
      (tiempoRestante >= totalMin && tolerancia === 0)
    ) {
      if (!tarifasUsadas[nombre]) {
        tarifasUsadas[nombre] = { cantidad: 0, precio };
      }
      tarifasUsadas[nombre].cantidad += 1;
      costoTotal += precio;
      tiempoRestante -= totalMin;
    }

    if (tiempoRestante >= totalMin) {
      const diferencia = tiempoRestante - totalMin;
      if (diferencia <= tolerancia) {
        tiempoRestante = 0;
      } else {
        if (!tarifasUsadas[nombre]) {
          tarifasUsadas[nombre] = { cantidad: 0, precio };
        }
        tarifasUsadas[nombre].cantidad += 1;
        costoTotal += precio;
        tiempoRestante -= totalMin;
      }
    }
  }

  if (tiempoRestante > 0 && tarifasOrdenadas.length > 0) {
    const tarifaMin = tarifasOrdenadas[0];
    const nombre = tarifaMin.nombre.toLowerCase();
    const precio = precios[tipoVehiculoKey]?.[nombre] ?? 0;

    const cantidad = Math.ceil((tiempoRestante - tarifaMin.tolerancia) / tarifaMin.totalMin);
    if (cantidad > 0) {
      if (!tarifasUsadas[nombre]) {
        tarifasUsadas[nombre] = { cantidad: 0, precio };
      }
      tarifasUsadas[nombre].cantidad += cantidad;
      costoTotal += precio * cantidad;
    }
  }

  for (let nombre in tarifasUsadas) {
    const { cantidad, precio } = tarifasUsadas[nombre];
    resumen += `${cantidad} x ${nombre.charAt(0).toUpperCase() + nombre.slice(1)} = $${precio * cantidad}\n`;
  }

  return resumen.trim() + `\n\nTotal: $${costoTotal}`;
}

module.exports = calcularDetalleCliente;
