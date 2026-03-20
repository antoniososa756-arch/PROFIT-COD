console.log("🔥 AUTH.ROUTES.JS REAL CARGADO");
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const auth = require("../middlewares/auth");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error("❌ JWT_SECRET no definido"); process.exit(1); }

const router = express.Router();

function isValidEmail(e) { return typeof e === "string" && e.includes("@") && e.length <= 200; }
function signToken(user) { return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" }); }

router.post("/create-admin", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ error: "Email inválido" });
    if (typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "Contraseña mínima 6 caracteres" });

    const existing = await db.get("SELECT id FROM users WHERE role = 'admin'");
    if (existing) return res.status(403).json({ error: "Admin ya existe" });

    const password_hash = await bcrypt.hash(password, 12);
    const created_at = new Date().toISOString();
    const result = await db.run(
      "INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'admin', ?) RETURNING id",
      [email.toLowerCase(), password_hash, created_at]
    );
    const user = { id: result.lastID, email: email.toLowerCase(), role: "admin" };
    return res.json({ token: signToken(user), user });
  } catch (e) {
    return res.status(500).json({ error: "Error servidor" });
  }
});

router.post("/login", async (req, res) => {
  const rawEmail = req.body?.email;
  const rawPassword = req.body?.password;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword.trim() : "";

  if (!isValidEmail(email)) return res.status(400).json({ error: "Email inválido" });
  if (typeof password !== "string") return res.status(400).json({ error: "Contraseña inválida" });

  try {
    const row = await db.get("SELECT id, email, password_hash, role, active FROM users WHERE email = ?", [email]);
    if (!row) return res.status(401).json({ error: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });
    if (row.active === 0) return res.status(403).json({ error: "Cuenta desactivada. Contacta al administrador." });

    const user = { id: row.id, email: row.email, role: row.role };
    return res.json({ token: signToken(user), user });
  } catch (e) {
    return res.status(500).json({ error: "Error DB" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const row = await db.get(
      "SELECT id, email, role, avatar_url, billing_name, billing_nif, billing_address, billing_city, billing_zip, billing_country FROM users WHERE id = ?",
      [req.user.id]
    );
    if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json({ user: { ...req.user, ...row } });
  } catch(e) { return res.status(500).json({ error: "Error servidor" }); }
});

router.put("/avatar", auth, async (req, res) => {
  const { avatar_url } = req.body || {};
  if (typeof avatar_url !== "string") return res.status(400).json({ error: "Datos inválidos" });
  if (avatar_url.length > 600000) return res.status(400).json({ error: "Imagen demasiado grande (máx 450KB)" });
  try {
    await db.run("UPDATE users SET avatar_url = ? WHERE id = ?", [avatar_url, req.user.id]);
    return res.json({ ok: true });
  } catch(e) { return res.status(500).json({ error: "Error servidor" }); }
});

router.put("/password", auth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (typeof current_password !== "string" || typeof new_password !== "string")
    return res.status(400).json({ error: "Datos inválidos" });
  if (new_password.length < 6)
    return res.status(400).json({ error: "La nueva contraseña debe tener mínimo 6 caracteres" });
  try {
    const row = await db.get("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
    if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
    const ok = await bcrypt.compare(current_password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Contraseña actual incorrecta" });
    const hash = await bcrypt.hash(new_password, 12);
    await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id]);
    return res.json({ ok: true });
  } catch(e) { return res.status(500).json({ error: "Error servidor" }); }
});

router.put("/billing", auth, async (req, res) => {
  const { billing_name, billing_nif, billing_address, billing_city, billing_zip, billing_country } = req.body || {};
  try {
    await db.run(
      "UPDATE users SET billing_name = ?, billing_nif = ?, billing_address = ?, billing_city = ?, billing_zip = ?, billing_country = ? WHERE id = ?",
      [billing_name||null, billing_nif||null, billing_address||null, billing_city||null, billing_zip||null, billing_country||null, req.user.id]
    );
    return res.json({ ok: true });
  } catch(e) { return res.status(500).json({ error: "Error servidor" }); }
});

router.delete("/account", auth, async (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== "string") return res.status(400).json({ error: "Debes confirmar con tu contraseña" });
  try {
    const row = await db.get("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
    if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Contraseña incorrecta" });
    await db.run("DELETE FROM users WHERE id = ?", [req.user.id]);
    return res.json({ ok: true });
  } catch(e) { return res.status(500).json({ error: "Error servidor" }); }
});

router.post("/create-user", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.sendStatus(403);
  const { email, password } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "Email inválido" });
  if (typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "Contraseña mínima 6 caracteres" });

  try {
    const password_hash = await bcrypt.hash(password, 12);
    const created_at = new Date().toISOString();
    const result = await db.run(
      "INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'cliente', ?) RETURNING id",
      [email.toLowerCase(), password_hash, created_at]
    );
    return res.json({ id: result.lastID, email: email.toLowerCase(), role: "cliente" });
  } catch (e) {
    if (String(e.message).includes("unique") || String(e.message).includes("UNIQUE"))
      return res.status(409).json({ error: "Email ya registrado" });
    return res.status(500).json({ error: "Error DB" });
  }
});

module.exports = router;
