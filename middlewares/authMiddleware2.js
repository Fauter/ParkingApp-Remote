// authMiddleware.js
// Middleware simple para simular usuario logueado
// En producción usarías JWT o sesión real

const authMiddleware2 = (req, res, next) => {
  // Por ejemplo: si viene un header 'x-usuario-nombre', lo uso para simular autenticación
  const nombre = req.headers['x-usuario-nombre'] || null;

  if (!nombre) {
    return res.status(401).json({ error: 'Usuario no autenticado middle' });
  }

  req.user = { nombre }; // Seteamos usuario en request
  next();
};

module.exports = authMiddleware2;
