/**
 * planCheck — bloquea acceso a datos si el plan del cliente está caducado
 * o ha superado el límite de pedidos mensual.
 * Los administradores siempre pasan.
 */
const db = require("../db");
const { getEffectiveCycleStart } = require("../utils/billingCycle");

// Límites de pedidos por mes según plan
const PLAN_ORDER_LIMITS = { starter: 120, growth: 420, pro: 1000, business: 3000 };

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
    // Cuentas apoyo: mensaje diferenciado — el problema es del cliente padre
    if (user.role === "apoyo") {
      return res.status(402).json({ error: "PLAN_PADRE_REQUERIDO", message: "La cuenta principal no tiene una membresía activa. Contacta con el administrador de tu cuenta." });
    }
    return res.status(402).json({ error: "PLAN_REQUERIDO", message: "Tu plan ha caducado. Renueva para continuar." });
  }

  // Trial: sin límite de pedidos... salvo en Starter, cuyo tope de 120 pedidos es de
  // por vida (no un cupo mensual que se regala durante la prueba) y aplica siempre.
  if (status === "trial" && plan !== "starter") return next();

  // Ya superó el límite de su plan alguna vez: se queda bloqueado aunque llegue la
  // renovación y el conteo del ciclo actual vuelva a 0 — si no, un cliente podría
  // superar su límite cada mes y desbloquearse gratis en cuanto empieza el ciclo
  // siguiente, sin pagar nunca el plan superior que le corresponde. Solo se
  // limpia al subir de plan (webhook de Stripe) o manualmente por un admin.
  if (user.plan_overage_locked) {
    return res.status(402).json({
      error: "ORDER_LIMIT_EXCEEDED",
      message: `Superaste el límite de pedidos de tu plan ${plan}. Actualiza a un plan superior para continuar.`,
      locked: true,
    });
  }

  // Verificar límite de pedidos. En planes de pago es el ciclo de facturación actual
  // (desde que se activó el plan, no desde el día 1 del mes — así no cuenta pedidos
  // del trial). En Starter es un tope de por vida: se cuentan TODOS sus pedidos, sin
  // reiniciarse nunca — al superarlo, tiene que pasar a un plan de pago.
  const orderLimit = PLAN_ORDER_LIMITS[plan];
  if (orderLimit) {
    try {
      const cycleStart = plan === "starter" ? null : getEffectiveCycleStart(user.billing_cycle_start);
      const countRow = await db.get(`
        SELECT COUNT(*) as cnt
        FROM orders o
        LEFT JOIN shops s ON s.id = o.shop_id
        WHERE (s.user_id = $1 OR (SELECT shop_domain FROM shops WHERE id = o.shop_id) IN (SELECT shop_domain FROM shops WHERE user_id = $1))
          ${cycleStart ? "AND o.created_at >= $2" : ""}
      `, cycleStart ? [user.id, cycleStart.toISOString()] : [user.id]);
      const ordersCount = parseInt(countRow?.cnt || 0);
      if (ordersCount > orderLimit) {
        // Se persiste: a partir de ahora queda bloqueado hasta que suba de plan o
        // un admin lo libere, no solo hasta que renueve el ciclo actual.
        db.run("UPDATE users SET plan_overage_locked = true WHERE id = ?", [user.id]).catch(() => {});
        return res.status(402).json({
          error: "ORDER_LIMIT_EXCEEDED",
          message: plan === "starter"
            ? `Has superado el límite gratuito de ${orderLimit.toLocaleString("es-ES")} pedidos. Actualiza a un plan de pago para continuar.`
            : `Has superado el límite de ${orderLimit.toLocaleString("es-ES")} pedidos/mes de tu plan. Actualiza tu plan para continuar.`,
          count: ordersCount,
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
