const jwt = require("jsonwebtoken");
const db = require("../db");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "NO_AUTH_HEADER" });

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "TOKEN_VACIO" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar que el usuario sigue activo en la BD
    if (!decoded.isImpersonated) {
      const row = await db.get("SELECT active FROM users WHERE id = ?", [decoded.id]);
      if (!row || row.active === 0) {
        return res.status(403).json({ error: "CUENTA_DESACTIVADA" });
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "JWT_INVALIDO" });
  }
};