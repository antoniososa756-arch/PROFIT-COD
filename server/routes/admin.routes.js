const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const auth = require("../middlewares/auth");
const router = express.Router();

function admin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Solo admin" });
  next();
}

router.get("/users", auth, admin, async (req, res) => {
  try {
    const rows = await db.all("SELECT id, email, role, active, created_at, parent_user_id, permissions FROM users ORDER BY created_at DESC");
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Error DB" }); }
});

router.delete("/users/:id", auth, admin, async (req, res) => {
  try {
    await db.run("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error DB" }); }
});

router.post("/reset-password/:id", auth, admin, async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: "Contraseña inválida" });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.params.id]);
    if (!result.changes) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error servidor" }); }
});

router.post("/impersonate/:id", auth, admin, async (req, res) => {
  try {
    const user = await db.get("SELECT id, email, role FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, impersonatedBy: req.user.id, isImpersonated: true },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );
    res.json({ token });
  } catch (e) { res.status(500).json({ error: "Error DB" }); }
});

// POST /api/admin/users/:id/grant-free-days — regala N días de acceso a un cliente.
// Requiere la contraseña de la PROPIA cuenta admin como confirmación de seguridad
// (no la del cliente) antes de tocar su plan.
router.post("/users/:id/grant-free-days", auth, admin, async (req, res) => {
  const { adminPassword, days } = req.body || {};
  const extraDays = Number.isInteger(days) && days > 0 ? days : 15;
  if (!adminPassword) return res.status(400).json({ error: "Falta la contraseña de administrador" });
  try {
    const adminRow = await db.get("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
    const match = adminRow && await bcrypt.compare(adminPassword, adminRow.password_hash);
    if (!match) return res.status(401).json({ error: "Contraseña de administrador incorrecta" });

    const target = await db.get("SELECT id, role, plan, plan_expires_at, stripe_subscription_id FROM users WHERE id = ?", [req.params.id]);
    if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
    if (target.role !== "cliente") return res.status(400).json({ error: "Solo se puede aplicar a cuentas de cliente" });

    const now = new Date();
    const base = target.plan_expires_at && new Date(target.plan_expires_at) > now ? new Date(target.plan_expires_at) : now;
    const newExpiry = new Date(base.getTime() + extraDays * 24 * 60 * 60 * 1000).toISOString();
    // Si no tenía plan (o quedó en "free" tras cancelar), le damos Starter — la app
    // bloquea el acceso a cualquier cuenta con plan "free" sin importar la fecha.
    const newPlan = target.plan && target.plan !== "free" ? target.plan : "starter";
    // Si ya es cliente de pago real (tiene suscripción de Stripe), se queda "active"
    // con los límites normales de su plan. Si no, usamos "trial" — ese estado no
    // aplica el límite de pedidos del plan (ver planCheck.js), que es justo lo que
    // se espera de "días gratis": acceso sin fricción, no forzar el tope de 120/420/...
    const newStatus = target.stripe_subscription_id ? "active" : "trial";

    await db.run(
      "UPDATE users SET plan = ?, plan_status = ?, plan_expires_at = ? WHERE id = ?",
      [newPlan, newStatus, newExpiry, target.id]
    );
    res.json({ ok: true, plan: newPlan, status: newStatus, plan_expires_at: newExpiry });
  } catch (e) { res.status(500).json({ error: "Error servidor" }); }
});

router.patch("/users/:id/status", auth, admin, async (req, res) => {
  try {
    const user = await db.get("SELECT id, role, active FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    if (user.role === "admin") return res.status(403).json({ error: "No se puede desactivar un administrador" });
    const newStatus = req.body.active ? 1 : 0;
    await db.run("UPDATE users SET active = ? WHERE id = ?", [newStatus, req.params.id]);
    res.json({ ok: true, active: newStatus });
  } catch (e) { res.status(500).json({ error: "Error DB" }); }
});

// ── Permisos de cuentas apoyo ──────────────────────────────────
// Accesible por admin (cualquier apoyo) o por el cliente padre del apoyo
router.patch("/users/:id/permissions", auth, async (req, res) => {
  const isAdmin  = req.user.role === "admin";
  const isClient = req.user.role === "cliente";
  if (!isAdmin && !isClient) return res.status(403).json({ error: "Sin permisos" });

  const VALID = ["metricas","rentabilidad","tiendas","productos","pedidos","reclamos","facturas","informes","exprod","ayuda","reembolsos_widget"];
  const { permissions } = req.body || {};
  if (!Array.isArray(permissions)) return res.status(400).json({ error: "permissions debe ser un array" });
  const clean = permissions.filter(p => VALID.includes(p));

  try {
    const target = await db.get("SELECT id, role, parent_user_id FROM users WHERE id = ?", [req.params.id]);
    if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
    if (target.role !== "apoyo") return res.status(400).json({ error: "Solo se pueden editar permisos de cuentas apoyo" });
    if (isClient && target.parent_user_id !== req.user.id)
      return res.status(403).json({ error: "No es tu cuenta de apoyo" });

    await db.run("UPDATE users SET permissions = ? WHERE id = ?", [JSON.stringify(clean), target.id]);
    res.json({ ok: true, permissions: clean });
  } catch (e) { res.status(500).json({ error: "Error DB" }); }
});

// Listar apoyo de un cliente (para Mi equipo)
router.get("/my-apoyo", auth, async (req, res) => {
  const isAdmin  = req.user.role === "admin";
  const isClient = req.user.role === "cliente";
  if (!isAdmin && !isClient) return res.status(403).json({ error: "Sin permisos" });
  try {
    const parentId = isAdmin ? (req.query.parent_id || null) : req.user.id;
    if (!parentId) return res.json([]);
    const rows = await db.all(
      "SELECT id, email, role, active, permissions FROM users WHERE role = 'apoyo' AND parent_user_id = ? ORDER BY created_at DESC",
      [parentId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Error DB" }); }
});

// ── Configuración de pagos (Stripe + PayPal) ──────────────────
router.get("/payment-config", auth, admin, async (req, res) => {
  try {
    const row = await db.get("SELECT * FROM payment_config WHERE id = 1");
    const mask = v => v ? v.slice(0, 6) + "••••••••••••" : "";
    res.json({
      stripe_public_key:       row?.stripe_public_key       || "",
      stripe_secret_key:       mask(row?.stripe_secret_key),
      stripe_webhook_secret:   mask(row?.stripe_webhook_secret),
      stripe_price_starter:    row?.stripe_price_starter    || "",
      stripe_price_growth:     row?.stripe_price_growth     || "",
      stripe_price_pro:        row?.stripe_price_pro        || "",
      stripe_price_business:   row?.stripe_price_business   || "",
      paypal_client_id:        row?.paypal_client_id        || "",
      paypal_secret:           mask(row?.paypal_secret),
      paypal_env:              row?.paypal_env              || "live",
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put("/payment-config", auth, admin, async (req, res) => {
  try {
    const {
      stripe_public_key, stripe_secret_key, stripe_webhook_secret,
      stripe_price_starter, stripe_price_growth, stripe_price_pro, stripe_price_business,
      paypal_client_id, paypal_secret, paypal_env
    } = req.body;
    const current = await db.get("SELECT * FROM payment_config WHERE id = 1");
    const val  = (newVal, oldVal) => (newVal && !newVal.includes("••")) ? newVal : (oldVal || "");
    const plain = (newVal, oldVal) => newVal || oldVal || "";
    await db.run(
      `UPDATE payment_config SET
        stripe_public_key = $1, stripe_secret_key = $2, stripe_webhook_secret = $3,
        stripe_price_starter = $4, stripe_price_growth = $5, stripe_price_pro = $6, stripe_price_business = $7,
        paypal_client_id = $8, paypal_secret = $9, paypal_env = $10, updated_at = now()::text
       WHERE id = 1`,
      [
        val(stripe_public_key,     current?.stripe_public_key),
        val(stripe_secret_key,     current?.stripe_secret_key),
        val(stripe_webhook_secret, current?.stripe_webhook_secret),
        plain(stripe_price_starter,  current?.stripe_price_starter),
        plain(stripe_price_growth,   current?.stripe_price_growth),
        plain(stripe_price_pro,      current?.stripe_price_pro),
        plain(stripe_price_business, current?.stripe_price_business),
        val(paypal_client_id,      current?.paypal_client_id),
        val(paypal_secret,         current?.paypal_secret),
        paypal_env || current?.paypal_env || "live",
      ]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
