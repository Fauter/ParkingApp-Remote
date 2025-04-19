const fs = require("fs");
const path = require("path");
const axios = require('axios');
const Vehiculo = require('../models/Vehiculo');
const Movimiento = require('../models/Movimiento'); 
const Tarifa = require('../models/Tarifa')

function obtenerPrecios() {
    const filePath = path.join(__dirname, '../data/precios.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
}

// Crear Vehículo
// Crear Vehículo
exports.createVehiculo = async (req, res) => {
    try {
        const { patente, tipoVehiculo, abonado } = req.body;

        if (!patente || !tipoVehiculo) {
            return res.status(400).json({ msg: "Faltan datos" });
        }

        let vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            // Si no existe, lo creo como siempre
            vehiculo = new Vehiculo({ patente, tipoVehiculo, abonado });

            if (abonado) {
                const precios = obtenerPrecios();
                const precioAbono = precios[tipoVehiculo.toLowerCase()]?.estadia || 0;

                vehiculo.abonoExpira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

                const nuevoMovimiento = new Movimiento({
                    patente,
                    operador: "Sistema",
                    tipoVehiculo,
                    metodoPago: "Efectivo",
                    factura: "No",
                    monto: precioAbono,
                    descripcion: "Pago de abono mensual"
                });

                await nuevoMovimiento.save();
            }

            // Registrar primera entrada en estadiaActual
            vehiculo.estadiaActual = { entrada: new Date() };
            await vehiculo.save();

            return res.status(201).json({ msg: "Vehículo creado y entrada registrada", vehiculo });
        }

        // Si ya existía, registrar una nueva entrada
        if (vehiculo.estadiaActual.entrada) {
            return res.status(400).json({ msg: "Este vehículo ya tiene una estadía en curso Create" });
        }

        // Registrar una nueva entrada en estadiaActual
        vehiculo.estadiaActual = { entrada: new Date() };
        await vehiculo.save();

        res.status(200).json({ msg: "Entrada registrada para vehículo existente", vehiculo });
    } catch (err) {
        console.error("💥 Error en createVehiculo:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};

// Obtener Vehículos
exports.getVehiculos = async (req, res) => {
    try {
        const vehiculos = await Vehiculo.find();
        res.json(vehiculos);
    } catch (err) {
        res.status(500).json({ msg: "Error del servidor" });
    }
};
// Obtener Vehículos por Patente
exports.getVehiculoByPatente = async (req, res) => {
    try {
        const { patente } = req.params;
        const vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            return res.status(404).json({ msg: "Vehículo no encontrado" });
        }

        res.json(vehiculo);
    } catch (err) {
        res.status(500).json({ msg: "Error del servidor" });
    }
};
// Obtener tipos de Vehículo desde Model
exports.getTiposVehiculo = (req, res) => {
    try {
        const tipos = Vehiculo.schema.path('tipoVehiculo').enumValues;
        res.json(tipos);
    } catch (err) {
        console.error("💥 Error al obtener tipos de vehículo:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};

// Registro de Entrada & Salida
exports.registrarEntrada = async (req, res) => {
    try {
        const { patente } = req.params;
        let vehiculo = await Vehiculo.findOne({ patente });

        if (!vehiculo) {
            return res.status(404).json({ msg: "Vehículo no encontrado" });
        }

        // ✅ Verificamos si ya tiene una estadía en curso
        if (vehiculo.estadiaActual?.entrada) {
            return res.status(400).json({ msg: "Este vehículo ya tiene una estadía en curso" });
        }

        // Registrar una nueva entrada
        vehiculo.estadiaActual = { entrada: new Date() };
        await vehiculo.save();

        res.status(200).json({ msg: "Entrada registrada para vehículo", vehiculo });
    } catch (err) {
        console.error("Error en registrarEntrada:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};
exports.registrarSalida = async (req, res) => {
    try {
      const { patente } = req.params;
      const { metodoPago, factura } = req.body;
  
      let vehiculo = await Vehiculo.findOne({ patente });
      if (!vehiculo) return res.status(404).json({ msg: "Vehículo no encontrado" });
  
      if (!vehiculo.estadiaActual.entrada) {
        return res.status(400).json({ msg: "No hay una estadía en curso." });
      }
  
      vehiculo.estadiaActual.salida = new Date();
      const tiempoMs = vehiculo.estadiaActual.salida - vehiculo.estadiaActual.entrada;
      const tiempoMin = Math.ceil(tiempoMs / 1000 / 60);  // Convertir a minutos
  
      // Obtener tarifas y precios desde los endpoints
      const [resTarifas, resPrecios] = await Promise.all([
        axios.get("https://parkingapp-back.onrender.com/api/tarifas"),
        axios.get("https://parkingapp-back.onrender.com/api/precios")
      ]);
  
      const tarifas = resTarifas.data;
      const precios = resPrecios.data;
  
      // Filtrar solo tarifas de tipo "hora" y "estadia" (excluir "turno" y "mensual")
      const tarifasHoraYEstadia = tarifas.filter(tarifa => tarifa.tipo === 'hora' || tarifa.tipo === 'estadia');
  
      let tarifaAplicada = null;
      let cantidadVeces = 1;
  
      // Lógica para calcular el costo
      let tipoVehiculo = vehiculo.tipoVehiculo.toLowerCase();
  
      if (tiempoMin <= 60) { // Menos de 1 hora
        tarifaAplicada = tarifasHoraYEstadia.find(tarifa => tarifa.nombre === "Hora");
        cantidadVeces = 1;
      } else if (tiempoMin <= 240) { // Menos de 4 horas (no usar tarifa "turno")
        tarifaAplicada = tarifasHoraYEstadia.find(tarifa => tarifa.nombre === "Hora");
        cantidadVeces = Math.ceil(tiempoMin / 60); // Redondear al número más cercano de horas
      } else if (tiempoMin <= 720) { // Menos de 12 horas
        tarifaAplicada = tarifasHoraYEstadia.find(tarifa => tarifa.nombre === "Hora");
        cantidadVeces = Math.ceil(tiempoMin / 60); // Redondear al número más cercano de horas
      } else if (tiempoMin <= 720 + 90) { // Entre 12 y 13.5 horas (Media estadía)
        tarifaAplicada = tarifasHoraYEstadia.find(tarifa => tarifa.nombre === "Media Estadía");
        cantidadVeces = 1;
      } else { // Más de 24 horas, aplicar tarifa de estadía
        tarifaAplicada = tarifasHoraYEstadia.find(tarifa => tarifa.nombre === "Estadía");
        cantidadVeces = Math.ceil(tiempoMin / (1440)); // Convertir el tiempo en días y redondear
      }
  
      const nombreTarifa = tarifaAplicada.nombre.toLowerCase();
      const precioUnidad = precios[tipoVehiculo]?.[nombreTarifa] ?? 0;
      const costoTotal = precioUnidad * cantidadVeces;
  
      // Guardar en historial
      vehiculo.estadiaActual.costoTotal = costoTotal;
      vehiculo.estadiaActual.nombreTarifa = tarifaAplicada.nombre;
      vehiculo.estadiaActual.tarifaAplicada = tarifaAplicada;
  
      vehiculo.historialEstadias.push({ ...vehiculo.estadiaActual });
  
      // Reset estadía
      vehiculo.estadiaActual = {
        entrada: null,
        salida: null,
        costoTotal: 0,
        nombreTarifa: null
      };
  
      await vehiculo.save();
  
      res.json({
        msg: "Salida registrada",
        costoTotal,
        tarifaAplicada,
        tiempoTotalMinutos: tiempoMin,
        cantidadVeces
      });
  
    } catch (err) {
      console.error("Error en registrarSalida:", err);
      res.status(500).json({ msg: "Error del servidor" });
    }
  };
  
  

// Estadias
exports.registrarEstadia = async (req, res) => {
    try {
        const { patente, metodoPago, factura, operador } = req.body;
        let vehiculo = await Vehiculo.findOne({ patente });
        if (!vehiculo) return res.status(404).json({ msg: "Vehículo no encontrado" });

        const precios = obtenerPrecios();
        const monto = precios[vehiculo.tipoVehiculo.toLowerCase()]?.estadia || 0;

        vehiculo.historialEstadias.push({
            entrada: new Date(),
            salida: new Date(),
            costoTotal: monto
        });

        await vehiculo.save();

        const nuevoMovimiento = new Movimiento({
            patente,
            operador,
            tipoVehiculo: vehiculo.tipoVehiculo,
            metodoPago,
            factura,
            monto,
            descripcion: "Estadía 24hs"
        });

        await nuevoMovimiento.save();
        res.json({ msg: "Estadía registrada", vehiculo, monto });
    } catch (err) {
        console.error("💥 Error en registrarEstadia:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};
// Registrar Media Estadía
exports.registrarMediaEstadia = async (req, res) => {
    try {
        const { patente, metodoPago, factura, operador } = req.body;
        let vehiculo = await Vehiculo.findOne({ patente });
        if (!vehiculo) return res.status(404).json({ msg: "Vehículo no encontrado" });

        const precios = obtenerPrecios();
        const monto = precios[vehiculo.tipoVehiculo.toLowerCase()]?.media || 0;

        vehiculo.historialEstadias.push({
            entrada: new Date(),
            salida: new Date(),
            costoTotal: monto
        });

        await vehiculo.save();

        const nuevoMovimiento = new Movimiento({
            patente,
            operador,
            tipoVehiculo: vehiculo.tipoVehiculo,
            metodoPago,
            factura,
            monto,
            descripcion: "Media Estadía"
        });

        await nuevoMovimiento.save();
        res.json({ msg: "Media estadía registrada", vehiculo, monto });
    } catch (err) {
        console.error("💥 Error en registrarMediaEstadia:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};

exports.updateAbono = async (req, res) => {
    try {
        const { patente } = req.params;
        const vehiculo = await Vehiculo.findOne({ patente });
        if (!vehiculo) return res.status(404).json({ msg: "Vehículo no encontrado" });

        const precios = obtenerPrecios();
        const precioAbono = precios[vehiculo.tipoVehiculo.toLowerCase()]?.estadia || 0;

        vehiculo.abonado = true;
        vehiculo.abonoExpira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días desde hoy
        await vehiculo.save();

        const nuevoMovimiento = new Movimiento({
            patente,
            operador: "Sistema",
            tipoVehiculo: vehiculo.tipoVehiculo,
            metodoPago: "Efectivo",
            factura: "No",
            monto: precioAbono,
            descripcion: "Renovación de abono"
        });

        await nuevoMovimiento.save();

        res.json({ msg: "Abono actualizado", vehiculo });
    } catch (err) {
        console.error("💥 Error en updateAbono:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};

// ELIMINAR TODOS LOS AUTOS
exports.eliminarTodosLosVehiculos = async (req, res) => {
    try {
        console.log("Eliminando todos los vehículos...");
        await Vehiculo.deleteMany({});
        console.log("Todos los vehículos fueron eliminados.");
        res.json({ msg: "Todos los vehículos fueron eliminados correctamente." });
    } catch (err) {
        console.error("💥 Error al eliminar los vehículos:", err);
        res.status(500).json({ msg: "Error del servidor" });
    }
};