const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "Acceso denegado, no hay token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");

    if (!decoded.id) {
      return res.status(400).json({ msg: "Token inválido: falta id" });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token expirado" });
    }
    console.error("Error en authMiddleware:", error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

module.exports = authMiddleware;
