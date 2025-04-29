const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

const BASE_URL = 'https://parkingapp-back.onrender.com/api';

const obtenerTarifas = async () => {
  const response = await fetch(`${BASE_URL}/tarifas`);
  if (!response.ok) throw new Error('Error al obtener tarifas');
  return response.json();
};

const obtenerPrecios = async () => {
  const response = await fetch(`${BASE_URL}/precios`);
  if (!response.ok) throw new Error('Error al obtener precios');
  return response.json();
};

const obtenerParametros = async () => {
  const response = await fetch(`${BASE_URL}/parametros`);
  if (!response.ok) throw new Error('Error al obtener parámetros');
  return response.json();
};

module.exports = {
  obtenerTarifas,
  obtenerPrecios,
  obtenerParametros
};