// controllers/authControllers.js
const User = require('../models/User');
const Outbox = require('../models/Outbox');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Types;

function is24Hex(s) {
  return typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(s);
}

// convierte {type:'Buffer', data:[…]} -> Buffer
function bufferFromJson(bufLike) {
  try {
    if (bufLike && bufLike.type === 'Buffer' && Array.isArray(bufLike.data)) {
      return Buffer.from(bufLike.data);
    }
  } catch {}
  return null;
}

// Convierte a string HEX robusto
function idToString(x, depth = 0) {
  try {
    if (x == null) return '';
    if (typeof x === 'string') return x;
    if (typeof x === 'number' || typeof x === 'bigint' || typeof x === 'boolean') return String(x);
    if (depth > 6) return String(x);

    if (typeof x === 'object') {
      if ((x._bsontype === 'ObjectID' || x._bsontype === 'ObjectId') && typeof x.toHexString === 'function') {
        return x.toHexString();
      }
      if (typeof x.toHexString === 'function') return x.toHexString();

      if (x.id) {
        const buf = Buffer.isBuffer(x.id) ? x.id : bufferFromJson(x.id);
        if (buf && buf.length === 12) return buf.toString('hex');
      }
      const buf = bufferFromJson(x);
      if (buf && buf.length === 12) return buf.toString('hex');

      const cands = [];
      if (x.$oid != null) cands.push(x.$oid);
      if (x.oid  != null) cands.push(x.oid);
      if (x.id   != null) cands.push(x.id);
      if (x._id  != null) cands.push(x._id);
      for (const c of cands) {
        const s = idToString(c, depth + 1);
        if (is24Hex(s)) return s;
        if (s) return s;
      }
    }
    return String(x);
  } catch {
    return '';
  }
}

// -------- utils salida --------
function mapUserForOutput(u) {
  return {
    _id: idToString(u?._id),
    nombre: u?.nombre,
    apellido: u?.apellido,
    username: u?.username,
    password: u?.password, // sin hash (tu decisión)
    role: u?.role,
    ultimoAcceso: u?.ultimoAcceso,
    createdAt: u?.createdAt,
    updatedAt: u?.updatedAt
  };
}

function toOperadorObject(u) {
  return {
    _id: idToString(u?._id),
    username: u?.username,
    nombre: u?.nombre,
    apellido: u?.apellido,
    role: u?.role
  };
}

// -------- JWT helpers ----------
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'default_secret', { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
}

// ---------- Middleware: requireAuth ----------
exports.requireAuth = async (req, res, next) => {
  try {
    const hdr = req.headers['authorization'] || '';
    const m = /^Bearer\s+(.+)$/.exec(hdr);
    if (!m) return res.status(401).json({ msg: 'Token faltante' });

    const decoded = verifyToken(m[1]);
    // intentamos reconstruir usuario desde token (rápido)…
    let user = {
      _id: decoded.id || decoded._id,
      username: decoded.username,
      nombre: decoded.nombre,
      apellido: decoded.apellido,
      role: decoded.role
    };

    // …y refrescamos datos básicos desde DB si el id es válido (consistencia)
    const idStr = idToString(user._id);
    if (is24Hex(idStr)) {
      const fromDb = await User.findById(idStr)
        .select('nombre apellido username role ultimoAcceso createdAt updatedAt')
        .lean();
      if (fromDb) {
        user = {
          _id: idToString(fromDb._id),
          username: fromDb.username,
          nombre: fromDb.nombre,
          apellido: fromDb.apellido,
          role: fromDb.role
        };
      }
    }

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ msg: 'Token inválido' });
  }
};

// --------- Encola delete remoto per-user ----------
async function enqueueUserDelete({ idStr, username }) {
  const payload = {
    status: 'pending',
    method: 'DELETE',
    collection: 'users',
    route: idStr ? `/api/auth/${idStr}` : `/api/auth/by-username/${encodeURIComponent(username)}`,
    params: idStr ? { id: idStr } : undefined,
    document: idStr ? { _id: idStr } : { username },
    createdAt: new Date()
  };
  await Outbox.create(payload);
}

// -------------------- handlers --------------------

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ msg: 'ID inválido' });
    const user = await User.findById(id).select('+password').lean();
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' });
    return res.json(mapUserForOutput(user));
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ msg: error.message || 'Error al obtener el usuario' });
  }
};

exports.register = async (req, res) => {
  try {
    const { nombre, apellido, username, password, role } = req.body;
    if (!nombre || !apellido || !username || !password) {
      return res.status(400).json({ msg: 'Faltan datos' });
    }

    const existing = await User.findOne({ username }).select('_id').lean();
    if (existing) return res.status(400).json({ msg: 'Usuario ya registrado' });

    const user = await User.create({ nombre, apellido, username, password, role: role || 'operador' });

    const operador = toOperadorObject(user);
    const token = signToken({
      id: operador._id,
      username: operador.username,
      nombre: operador.nombre,
      apellido: operador.apellido,
      role: operador.role
    });

    return res.status(201).json({
      msg: 'Usuario registrado',
      user: mapUserForOutput(user.toObject()),
      operador,
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ msg: 'Faltan datos' });

    const user = await User.findOne({ username }).select('+password').lean();
    if (!user) return res.status(400).json({ msg: 'Credenciales incorrectas' });

    const passwordOk = password === user.password; // sin hash
    if (!passwordOk) return res.status(400).json({ msg: 'Credenciales incorrectas' });

    // actualizar último acceso (no bloqueante)
    try { await User.updateOne({ _id: user._id }, { $set: { ultimoAcceso: new Date() } }); } catch {}

    const operador = toOperadorObject(user);
    const token = signToken({
      id: operador._id,
      username: operador.username,
      nombre: operador.nombre,
      apellido: operador.apellido,
      role: operador.role
    });

    res.json({ msg: 'Login exitoso', token, operador });
  } catch (err) {
    console.error('❌ Error en login:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const updates = { ...req.body };
    if (updates.password === '') delete updates.password;

    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .select('+password')
      .lean();

    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' });
    res.json({ msg: 'Usuario actualizado', user: mapUserForOutput(user) });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ msg: error.message || 'Error al actualizar el usuario' });
  }
};

exports.getAllUsers = async (_req, res) => {
  try {
    const users = await User.find().select('+password').lean();
    return res.status(200).json(users.map(mapUserForOutput));
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
};

exports.getProfile = async (req, res) => {
  // req.user viene del middleware JWT
  const operador = {
    _id: idToString(req.user?._id),
    username: req.user?.username,
    nombre: req.user?.nombre,
    apellido: req.user?.apellido,
    role: req.user?.role
  };
  res.json(operador);
};

exports.deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await User.findById(id).select('_id username').lean();
    if (!exists) return res.status(404).json({ msg: 'Usuario no encontrado' });

    await User.deleteOne({ _id: new ObjectId(id) });

    res.json({ msg: 'Usuario eliminado correctamente', deletedId: id });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ msg: error.message || 'Error al eliminar el usuario' });
  }
};

exports.deleteUserByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ msg: 'Falta username' });

    const exists = await User.findOne({ username }).select('_id username').lean();
    if (!exists) return res.status(404).json({ msg: 'Usuario no encontrado' });

    const r = await User.deleteOne({ username });
    if (!r.deletedCount) return res.status(500).json({ msg: 'No se pudo borrar el usuario' });

    res.json({ msg: 'Usuario eliminado correctamente', deletedUsername: username });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ msg: error.message || 'Error al eliminar por username' });
  }
};

exports.repairUserIds = async (req, res) => {
  try {
    res.locals.__skipOutbox = true;

    const dry = String(req.query.dry || '0') === '1';
    const col = User.collection;

    const docs = await col.find({}, { projection: { _id: 1, username: 1, nombre: 1, apellido: 1, role: 1, password: 1, ultimoAcceso: 1, createdAt: 1, updatedAt: 1 } }).toArray();

    let fixed = 0, skipped = 0, errors = [];

    for (const d of docs) {
      const isOid = (d._id instanceof ObjectId);
      if (isOid) { skipped++; continue; }

      let newOid = null;
      try {
        if (d._id && typeof d._id.toHexString === 'function') {
          newOid = new ObjectId(d._id.toHexString());
        } else if (d._id && is24Hex(d._id.$oid)) {
          newOid = new ObjectId(d._id.$oid);
        } else if (d._id && d._id.id) {
          const buf = Buffer.isBuffer(d._id.id) ? d._id.id : bufferFromJson(d._id.id);
          if (buf && buf.length === 12) newOid = new ObjectId(buf.toString('hex'));
        }
      } catch (e) {}

      if (!newOid) { errors.push({ oldId: d._id, msg: 'no pude rehidratar' }); continue; }

      if (dry) { fixed++; continue; }

      const { _id, ...rest } = d;
      try {
        await col.insertOne({ _id: newOid, ...rest });
        await col.deleteOne({ _id: d._id });
        fixed++;
      } catch (e) {
        errors.push({ oldId: d._id, msg: e.message });
      }
    }

    return res.json({ dry, fixed, skipped, errorsCount: errors.length, errors });
  } catch (e) {
    console.error('repairUserIds error:', e);
    return res.status(500).json({ msg: e.message || 'repair error' });
  }
};

exports.deleteAllUsers = async (_req, res) => {
  try {
    res.locals.__skipOutbox = true;

    const users = await User.find({}, { _id: 1, username: 1 }).lean();
    if (!users.length) {
      return res.json({ msg: 'No había usuarios', deletedIds: [], deletedUsernames: [], failures: [] });
    }

    let deleted = 0;
    const deletedIds = [];
    const deletedUsernames = [];
    const failures = [];

    for (const u of users) {
      const idStr = idToString(u._id);
      let ok = false;

      try {
        if (is24Hex(idStr)) {
          await enqueueUserDelete({ idStr });
          const r = await User.deleteOne({ _id: new ObjectId(idStr) });
          if (r.deletedCount) { deleted++; ok = true; deletedIds.push(idStr); }
        } else if (u.username) {
          await enqueueUserDelete({ username: u.username });
          const r2 = await User.deleteOne({ username: u.username });
          if (r2.deletedCount) { deleted++; ok = true; deletedUsernames.push(u.username); }
        }
      } catch (e) {
        failures.push({ _id: u._id, username: u.username, error: e?.message });
      }

      if (!ok) {
        failures.push({ _id: u._id, username: u.username, error: 'No se pudo borrar' });
      }
    }

    return res.json({ msg: 'Usuarios eliminados', count: deleted, deletedIds, deletedUsernames, failures });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al borrar los usuarios' });
  }
};
