// models/Outbox.js
const mongoose = require('mongoose');

const OutboxSchema = new mongoose.Schema({
  method: { type: String, enum: ['POST','PUT','DELETE', 'PATCH'], required: true },
  route: { type: String, required: true },        // ruta api original
  collection: { type: String },                    // colección objetivo (mapear en config)
  document: { type: mongoose.Schema.Types.Mixed }, // body / payload
  params: { type: mongoose.Schema.Types.Mixed },   // params de URL (id, etc)
  query: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ['pending','processing','synced','error'], default: 'pending' },
  error: { type: String },
  retries: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  syncedAt: { type: Date }
}, { 
  collection: 'outbox',
  // Esto silencia el warning de Mongoose por usar la key 'collection' en el schema
  suppressReservedKeysWarning: true
});

module.exports = mongoose.models.Outbox || mongoose.model('Outbox', OutboxSchema);
