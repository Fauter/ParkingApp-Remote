// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../controllers/authControllers');

// --------- Auth middleware (JWT) ----------
const requireAuth = auth.requireAuth;

// --------- Rutas públicas ----------
router.post('/register', auth.register);
router.post('/login', auth.login);

// --------- Rutas protegidas por JWT ----------
router.get('/profile', requireAuth, auth.getProfile);
router.get('/', requireAuth, auth.getAllUsers);
router.get('/:id', requireAuth, auth.getUserById);
router.put('/:id', requireAuth, auth.updateUser);
router.delete('/by-username/:username', requireAuth, auth.deleteUserByUsername);
router.delete('/:id', requireAuth, auth.deleteUserById);

// --------- Mantenimiento / utilidades (protegidas) ----------
router.get('/repair-ids', requireAuth, auth.repairUserIds);
router.delete('/delete-all', requireAuth, auth.deleteAllUsers);

module.exports = router;
