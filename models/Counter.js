const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  seq: { type: Number, default: 0, min: 0 }
});

// Incremento atómico + upsert
CounterSchema.statics.increment = async function(name) {
  if (!name || typeof name !== 'string') throw new Error('Nombre de counter inválido');

  const counter = await this.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 }, $setOnInsert: { name } },
    { new: true, upsert: true, runValidators: true }
  );

  if (!counter) throw new Error('No se pudo generar el counter');
  if (typeof counter.seq !== 'number' || isNaN(counter.seq)) {
    throw new Error('El counter seq es inválido: ' + counter.seq);
  }
  return counter.seq;
};

// Asegura que el counter sea al menos el valor dado (nunca baja)
CounterSchema.statics.ensureAtLeast = async function(name, minValue) {
  if (!name || typeof name !== 'string') throw new Error('Nombre de counter inválido');
  if (typeof minValue !== 'number' || isNaN(minValue)) throw new Error('minValue inválido');

  const counter = await this.findOneAndUpdate(
    { name },
    { $max: { seq: minValue }, $setOnInsert: { name } },
    { new: true, upsert: true, runValidators: true }
  );
  if (!counter) throw new Error('No se pudo asegurar el valor mínimo del counter');
  return counter.seq;
};

// Reset "seguro" que no reduce si value < seq actual
CounterSchema.statics.safeReset = async function(name, value) {
  if (!name || typeof name !== 'string') throw new Error('Nombre de counter inválido');
  if (typeof value !== 'number' || isNaN(value)) throw new Error('value inválido');

  const counter = await this.findOneAndUpdate(
    { name },
    { $max: { seq: value }, $setOnInsert: { name } },
    { new: true, upsert: true, runValidators: true }
  );
  return counter;
};

CounterSchema.statics.getSeq = async function(name) {
  const c = await this.findOne({ name }).lean();
  return c ? c.seq : 0;
};

const Counter = mongoose.model('Counter', CounterSchema);
module.exports = Counter;
