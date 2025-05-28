const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.json({ msg: "Login exitoso", token });
    } catch (err) {
        res.status(500).json({ msg: "Error del servidor" });
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
exports.getProfile = async (req, res) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ msg: "Acceso denegado, no hay token" });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
        const user = await User.findById(decoded.id).select("username");

        if (!user) {
            return res.status(404).json({ msg: "Usuario no encontrado" });
        }

        res.json(user);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ msg: "Token expirado" });
        }
        console.error(error);
        res.status(500).json({ msg: "Error en el servidor" });
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