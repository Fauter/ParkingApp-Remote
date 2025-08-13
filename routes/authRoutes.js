// routes/authRoutes.js
const express = require('express');
const mongoose = require('mongoose');
const Outbox = require('../models/Outbox');
const User = require('../models/User');

const { 
    register,
    login, 
    getAllUsers, 
    getAllUsersWithPassword,
    getUserById,
    getProfile, 
    updateUser,
} = require('../controllers/authControllers');

const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// ===== Rutas de autenticación =====
router.post('/register', register);
router.post('/login', login);

// ===== Rutas específicas =====
// router.get('/with-passwords', getAllUsersWithPassword);
router.get('/profile', authMiddleware, getProfile);
router.get('/', getAllUsersWithPassword);

// ===== BORRADO con registro en Outbox =====

// DELETE único usuario
router.delete('/:id([0-9a-fA-F]{24})', async (req, res, next) => {
  try {
    const { id } = req.params;
    res.locals.__skipOutbox = true; // Evita que lo meta otro middleware

    // Encola en Outbox
    await Outbox.create({
      method: 'DELETE',
      route: `/api/auth/${id}`,
      collection: 'users',
      document: { _id: id },
      params: { id, _id: id },
      status: 'pending',
      createdAt: new Date()
    });

    // Borra localmente
    await User.deleteOne({ _id: new mongoose.Types.ObjectId(id) });

    res.json({ ok: true, deletedId: id });
  } catch (err) {
    next(err);
  }
});

// DELETE múltiple (por array de IDs en body.ids)
router.delete('/', async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'Debes enviar body.ids = [ ... ]' });
    }
    res.locals.__skipOutbox = true;

    const now = new Date();
    const outboxItems = ids.map(id => ({
      method: 'DELETE',
      route: `/api/auth/${id}`,
      collection: 'users',
      document: { _id: id },
      params: { id, _id: id },
      status: 'pending',
      createdAt: now
    }));

    await Outbox.insertMany(outboxItems);
    await User.deleteMany({ _id: { $in: ids.map(i => new mongoose.Types.ObjectId(i)) } });

    res.json({ ok: true, deletedIds: ids });
  } catch (err) {
    next(err);
  }
});

// DELETE-ALL forzado
router.delete('/delete-all', async (req, res, next) => {
  try {
    res.locals.__skipOutbox = true;

    const users = await User.find({}, { _id: 1 }).lean();
    const ids = users.map(u => String(u._id));

    if (ids.length) {
      const now = new Date();
      await Outbox.insertMany(ids.map(id => ({
        method: 'DELETE',
        route: `/api/auth/${id}`,
        collection: 'users',
        document: { _id: id },
        params: { id, _id: id },
        status: 'pending',
        createdAt: now
      })));

      await User.deleteMany({ _id: { $in: ids.map(i => new mongoose.Types.ObjectId(i)) } });
    }

    res.json({ ok: true, deletedIds: ids });
  } catch (err) {
    next(err);
  }
});

// ===== Rutas genéricas con ID =====
router.get('/:id([0-9a-fA-F]{24})', getUserById);
router.put('/:id([0-9a-fA-F]{24})', updateUser);

module.exports = router;
