const cron = require('node-cron');
const Vehiculo = require('../models/Vehiculo');
const Turno = require('../models/Turno');
const { expirarTurnosAutomáticamente } = require('../controllers/turnoControllers');

// Verifica si un vehículo tiene turnos activos válidos
async function verificarYActualizarTurnosVehiculos() {
  const ahora = new Date();

  try {
    const vehiculos = await Vehiculo.find();

    for (const vehiculo of vehiculos) {
      const turnos = await Turno.find({ patente: vehiculo.patente });

      const tieneTurnoActivo = turnos.some(turno =>
        turno.expirado === false && new Date(turno.fin) > ahora
      );

      if (vehiculo.turno !== tieneTurnoActivo) {
        vehiculo.turno = tieneTurnoActivo;
        await vehiculo.save();
        console.log(`Vehículo ${vehiculo.patente}: turno actualizado a ${tieneTurnoActivo}`);
      }
    }
  } catch (err) {
    console.error("Error al verificar/actualizar turnos:", err);
  }
}

// Ejecutar cada hora
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Ejecutando verificación de turnos de vehículos...');
  await expirarTurnosAutomáticamente(); // 👈 ESTO FALTABA
  await verificarYActualizarTurnosVehiculos();
});
