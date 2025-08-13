// controllers/authControllers.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID inválido" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener el usuario" });
  }
};

exports.register = async (req, res) => {
  try {
    const { nombre, apellido, username, password, role } = req.body;

    if (!nombre || !apellido || !username || !password) {
      return res.status(400).json({ msg: "Faltan datos" });
    }

    let existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ msg: "Usuario ya registrado" });

    // 🚫 sin hash (como tenías)
    const user = new User({
      nombre,
      apellido,
      username,
      password,
      role: role || 'operador'
    });

    await user.save();

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "1h" }
    );

    // 👇 clave: devolvemos el documento creado (sin password) bajo la key "user"
    const safeUser = {
      _id: user._id,
      nombre: user.nombre,
      apellido: user.apellido,
      username: user.username,
      role: user.role,
      ultimoAcceso: user.ultimoAcceso || new Date()
    };

    return res.status(201).json({ msg: "Usuario registrado", user: safeUser, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ msg: "Faltan datos" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ msg: "Credenciales incorrectas" });
    }

    const passwordOk = password === user.password; // comparación directa
    if (!passwordOk) {
      return res.status(400).json({ msg: "Credenciales incorrectas" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "7d" }
    );

    res.json({ msg: "Login exitoso", token });
  } catch (err) {
    console.error("❌ Error en login:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.password === '') {
      delete updates.password;
    }

    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    res.json({ msg: "Usuario actualizado", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al actualizar el usuario" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('+password').lean().exec();
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
};

exports.getAllUsersWithPassword = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener los usuarios con password" });
  }
};

exports.getProfile = (req, res) => {
  res.json({
    _id: req.user._id,
    username: req.user.username,
    nombre: req.user.nombre,
    apellido: req.user.apellido,
    role: req.user.role
  });
};

exports.deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    await User.findByIdAndDelete(id);
    res.json({ msg: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al eliminar el usuario" });
  }
};

exports.deleteAllUsers = async (req, res) => {
  try {
    await User.deleteMany({});
    res.json({ msg: "Todos los usuarios fueron eliminados" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al borrar los usuarios" });
  }
};
