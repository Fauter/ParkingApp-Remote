const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');


exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ msg: "ID inválido" });
        }

        const user = await User.findById(id).select('-password');
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

        let user = await User.findOne({ username });
        if (user) return res.status(400).json({ msg: "Usuario ya registrado" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            nombre,
            apellido,
            username,
            password: hashedPassword,
            role: role || 'operador'
        });

        await user.save();

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "1h" }
        );

        res.status(201).json({ msg: "Usuario registrado", token });
    } catch (err) {
        console.error(err); // Esto te muestra el error real en consola
        res.status(500).json({ msg: "Error del servidor" });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ msg: "Faltan datos" });
        }

        let user = await User.findOne({ username });
        if (!user) return res.status(400).json({ msg: "Credenciales incorrectas" });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Credenciales incorrectas" });

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({ msg: "Login exitoso", token });
    } catch (err) {
        res.status(500).json({ msg: "Error del servidor" });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Si la contraseña es una string vacía, eliminarla de los updates
        if (updates.password === '') {
            delete updates.password;
        } else if (updates.password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
        }

        const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select('-password');

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
      const users = await User.find().select("-password"); // Excluir contraseña por seguridad
      res.json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json({ msg: "Error al obtener los usuarios" });
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