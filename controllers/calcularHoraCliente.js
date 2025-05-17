function calcularHoraCliente({ tipoVehiculo, inicio, dias, hora, tarifas, precios, parametros } = {}) {
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

  const tarifasHora = tarifas
    .filter(t => t.tipo === 'hora')
    .map(t => ({
      ...t,
      totalMin: (t.dias * 1440) + (t.horas * 60) + t.minutos,
      nombreKey: t.nombre.toLowerCase(),
      precio: precios[tipoVehiculoKey]?.[t.nombre.toLowerCase()] ?? Infinity
    }))
    .sort((a, b) => a.totalMin - b.totalMin);

  if (!tarifasHora.length) return 'No hay tarifas horarias configuradas.';

  const maxMinutos = minutosTotales + Math.max(...tarifasHora.map(t => t.totalMin));
  const dp = Array(maxMinutos + 1).fill(Infinity);
  const backtrack = Array(maxMinutos + 1).fill(null);
  dp[0] = 0;

  for (let i = 0; i <= minutosTotales; i++) {
    if (!isFinite(dp[i])) continue;
    for (const tarifa of tarifasHora) {
      const { totalMin, precio, nombreKey } = tarifa;

      // Reglas de fraccionamiento
      if (
        fraccionarDesdeMinutos > 0 &&
        i < fraccionarDesdeMinutos &&
        totalMin < fraccionarDesdeMinutos
      ) {
        // Esta tarifa es una fracción y todavía no se llegó al límite → saltar
        continue;
      }

      const siguiente = i + totalMin;
      if (dp[i] + precio < dp[siguiente]) {
        dp[siguiente] = dp[i] + precio;
        backtrack[siguiente] = { nombreKey, totalMin, precio };
      }
    }
  }

  // Buscar el menor costo posible desde minutosTotales en adelante
  let mejorCosto = Infinity;
  let mejorIndice = -1;
  for (let i = minutosTotales; i < dp.length; i++) {
    if (dp[i] < mejorCosto) {
      mejorCosto = dp[i];
      mejorIndice = i;
    }
  }

  if (mejorIndice === -1 || !isFinite(mejorCosto)) {
    return 'No hay precios configurados correctamente para este tipo de vehículo.';
  }

  // Reconstrucción de tarifas usadas
  const tarifasUsadas = {};
  let i = mejorIndice;
  while (i > 0 && backtrack[i]) {
    const { nombreKey, totalMin, precio } = backtrack[i];
    tarifasUsadas[nombreKey] = tarifasUsadas[nombreKey] || { cantidad: 0, precio };
    tarifasUsadas[nombreKey].cantidad += 1;
    i -= totalMin;
  }

  let resumen = '';
  let costoTotal = 0;
  for (const [nombre, { cantidad, precio }] of Object.entries(tarifasUsadas)) {
    resumen += `${cantidad} x ${nombre.charAt(0).toUpperCase() + nombre.slice(1)} = $${cantidad * precio}\n`;
    costoTotal += cantidad * precio;
  }

  return resumen.trim() + `\n\nTotal: $${costoTotal}`;
}

module.exports = calcularHoraCliente;
