// Leads (tracker en vivo del formulario Releasit COD) es exclusivo de la
// cuenta administrador y de sus cuentas de apoyo -- nunca de un Cliente ni
// del apoyo de un Cliente. Va siempre después de auth.
module.exports = (req, res, next) => {
  const u = req.user || {};
  const ok = u.role === "admin" || (u.role === "apoyo" && u.parent_role === "admin");
  if (!ok) return res.status(403).json({ error: "No autorizado" });
  next();
};
