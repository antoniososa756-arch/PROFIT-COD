const jwt = require("jsonwebtoken");
const db = require("../db");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "NO_AUTH_HEADER" });

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "TOKEN_VACIO" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Si NO es impersonación, verificar que el usuario sigue activo en BD
    if (!decoded.isImpersonated) {
      const row = await db.get(
        "SELECT active, role, plan, plan_status, plan_expires_at FROM users WHERE id = ?",
        [decoded.id]
      );
      if (!row || row.active === 0) {
        return res.status(403).json({ error: "CUENTA_DESACTIVADA" });
      }
      // Adjuntar info de plan al usuario para que planCheck la use
      decoded.role            = row.role;
      decoded.plan            = row.plan || "free";
      decoded.plan_status     = row.plan_status || "inactive";
      decoded.plan_expires_at = row.plan_expires_at || null;
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "JWT_INVALIDO" });
  }
};