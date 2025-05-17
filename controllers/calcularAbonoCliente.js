function calcularAbonoCliente({ tipoVehiculo, tarifas, precios, parametros } = {}) {
  if (!tipoVehiculo) return 'Debe seleccionar un tipo de vehículo.';

  const tipoVehiculoKey = tipoVehiculo.toLowerCase();

  const tarifasAbono = tarifas
    .filter(t => t.tipo === 'abono')
    .map(t => ({
      ...t,
      nombreKey: t.nombre.toLowerCase(),
      precio: precios[tipoVehiculoKey]?.[t.nombre.toLowerCase()] ?? Infinity
    }))
    .sort((a, b) => a.precio - b.precio);

  if (!tarifasAbono.length) return 'No hay tarifas tipo abono configuradas.';

  const disponibles = tarifasAbono.filter(t => isFinite(t.precio));

  if (!disponibles.length) {
    return 'No hay precios configurados correctamente para este tipo de vehículo.';
  }

  let resumen = 'Opciones de abono disponibles:\n\n';

  for (const tarifa of disponibles) {
    const nombre = tarifa.nombreKey.charAt(0).toUpperCase() + tarifa.nombreKey.slice(1);
    resumen += `• ${nombre}: $${tarifa.precio}\n`;
  }

  return resumen.trim();
}

module.exports = calcularAbonoCliente;
