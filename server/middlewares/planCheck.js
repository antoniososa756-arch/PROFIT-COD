/**
 * planCheck — bloquea acceso a datos si el plan del cliente está caducado
 * o ha superado el límite de pedidos mensual.
 * Los administradores siempre pasan.
 */
const db = require("../db");

// Límites de pedidos por mes según plan
const PLAN_ORDER_LIMITS = { basic: 500, pro: 5000, business: 15000 };

module.exports = async (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "NO_AUTH" });

  // Admin siempre pasa sin restricciones
  if (user.role === "admin") return next();

  const plan      = user.plan      || "free";
  const status    = user.plan_status || "inactive";
  const expiresAt = user.plan_expires_at ? new Date(user.plan_expires_at) : null;
  const expired   = expiresAt ? expiresAt < new Date() : true;

  if (plan === "free" || (status !== "active" && status !== "trial") || expired) {
    return res.status(402).json({ error: "PLAN_REQUERIDO", message: "Tu plan ha caducado. Renueva para continuar." });
  }

  // Verificar límite de pedidos del mes actual
  const orderLimit = PLAN_ORDER_LIMITS[plan];
  if (orderLimit) {
    try {
      const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
      const countRow = await db.get(`
        SELECT COUNT(*) as cnt
        FROM orders o
        LEFT JOIN shops s ON s.id = o.shop_id
        WHERE (s.user_id = $1 OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))
          AND o.created_at LIKE $2
      `, [user.id, month + "%"]);
      const monthlyCount = parseInt(countRow?.cnt || 0);
      if (monthlyCount > orderLimit) {
        return res.status(402).json({
          error: "ORDER_LIMIT_EXCEEDED",
          message: `Has superado el límite de ${orderLimit.toLocaleString("es-ES")} pedidos/mes de tu plan. Actualiza tu plan para continuar.`,
          count: monthlyCount,
          limit: orderLimit,
        });
      }
    } catch(e) {
      console.error("planCheck order limit error:", e.message);
      // No bloqueamos si falla la consulta
    }
  }

  next();
};
