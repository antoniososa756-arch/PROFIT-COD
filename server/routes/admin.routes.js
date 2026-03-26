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
    const rows = await db.all("SELECT id, email, role, active, created_at FROM users ORDER BY created_at DESC");
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
      { expiresIn: "30m" }
    );
    res.json({ token });
  } catch (e) { res.status(500).json({ error: "Error DB" }); }
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
