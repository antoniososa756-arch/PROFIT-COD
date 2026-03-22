/**
 * planCheck — bloquea acceso a datos si el plan del cliente está caducado.
 * Los administradores siempre pasan.
 */
module.exports = (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "NO_AUTH" });

  // Admin siempre pasa
  if (user.role === "admin") return next();

  const plan      = user.plan      || "free";
  const status    = user.plan_status || "inactive";
  const expiresAt = user.plan_expires_at ? new Date(user.plan_expires_at) : null;
  const expired   = expiresAt ? expiresAt < new Date() : true;

  if (plan === "free" || status !== "active" || expired) {
    return res.status(402).json({ error: "PLAN_REQUERIDO", message: "Tu plan ha caducado. Renueva para continuar." });
  }

  next();
};
