const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  seq: { type: Number, default: 0, min: 0 }
});

// Método seguro para incrementar
CounterSchema.statics.increment = async function(name) {
  if (!name || typeof name !== 'string') throw new Error('Nombre de counter inválido');

  const counter = await this.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, runValidators: true }
  );

  if (!counter) throw new Error('No se pudo generar el counter');
  if (typeof counter.seq !== 'number' || isNaN(counter.seq)) {
    throw new Error('El counter seq es inválido: ' + counter.seq);
  }

  return counter.seq;
};

// Asegura que el counter sea al menos el valor dado
CounterSchema.statics.ensureAtLeast = async function(name, minValue) {
  if (!name || typeof name !== 'string') throw new Error('Nombre de counter inválido');
  if (typeof minValue !== 'number' || isNaN(minValue)) throw new Error('minValue inválido');

  const counter = await this.findOneAndUpdate(
    { name },
    { $max: { seq: minValue } }, // $max: solo sube si es menor
    { new: true, upsert: true, runValidators: true }
  );

  if (!counter) throw new Error('No se pudo asegurar el valor mínimo del counter');
  return counter.seq;
};

const Counter = mongoose.model('Counter', CounterSchema);
module.exports = Counter;
