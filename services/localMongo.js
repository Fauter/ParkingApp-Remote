const { MongoMemoryReplSet } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');

let replset = null;

async function startLocalMongo() {
  const dbPath = process.env.LOCAL_DB_PATH || path.join(__dirname, '..', 'mongodb-data');

  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
    console.log('[localMongo] carpeta mongodb-data creada en:', dbPath);
  }

  const downloadDir = process.env.MONGOMS_DOWNLOAD_DIR; // opcional

  console.log('[localMongo] arrancando MongoMemoryReplSet (transactions ON)...');
  replset = await MongoMemoryReplSet.create({
    binary: downloadDir ? { downloadDir } : undefined,
    replSet: {
      name: 'rs0',
      count: 1,
      storageEngine: 'wiredTiger',
    },
    instanceOpts: [{
      args: [
        '--setParameter', 'enableTestCommands=1',
      ]
    }]
  });

  const uri = replset.getUri();
  console.log('[localMongo] replicaset listo en:', uri, ' (dbPath:', dbPath, ')');
  return { mongod: replset, uri, dbPath };
}

async function stopLocalMongo() {
  if (replset) {
    try {
      await replset.stop();
      console.log('[localMongo] replset detenido');
    } catch (err) {
      console.error('[localMongo] error al detener replset:', err);
    }
  }
}

module.exports = { startLocalMongo, stopLocalMongo };