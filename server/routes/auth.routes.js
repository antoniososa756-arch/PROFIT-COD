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
function signToken(user) {
  const payload = { id: user.id, email: user.email, role: user.role };
  if (user.parent_user_id) payload.parent_user_id = user.parent_user_id;
  if (user.parent_role)    payload.parent_role    = user.parent_role;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

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
    const row = await db.get("SELECT id, email, password_hash, role, active, parent_user_id, permissions FROM users WHERE email = ?", [email]);
    if (!row) return res.status(401).json({ error: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });
    if (row.active === 0) return res.status(403).json({ error: "Cuenta desactivada. Contacta al administrador." });

    let permissions = null;
    let parent_role = null;
    if (row.role === "apoyo") {
      try { permissions = row.permissions ? JSON.parse(row.permissions) : null; } catch { permissions = null; }
      if (row.parent_user_id) {
        const parent = await db.get("SELECT role FROM users WHERE id = ?", [row.parent_user_id]);
        parent_role = parent?.role || null;
      }
    }
    const user = { id: row.id, email: row.email, role: row.role, parent_user_id: row.parent_user_id || null, parent_role, permissions };
    return res.json({ token: signToken(user), user });
  } catch (e) {
    return res.status(500).json({ error: "Error DB" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    // Para cuentas apoyo: own_id es su propio ID, id ya apunta al padre
    const profileId = req.user.own_id || req.user.id;
    const row = await db.get(
      "SELECT id, email, role, display_name, avatar_url, billing_name, billing_nif, billing_address, billing_city, billing_zip, billing_country, permissions FROM users WHERE id = ?",
      [profileId]
    );
    if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
    // Preservar role y permissions del token (middleware ya los resolvió correctamente)
    return res.json({ user: {
      ...req.user,
      ...row,
      role:        req.user.role,
      permissions: req.user.permissions ?? null,
    }});
  } catch(e) { return res.status(500).json({ error: "Error servidor" }); }
});

router.put("/display-name", auth, async (req, res) => {
  const { display_name } = req.body || {};
  if (typeof display_name !== "string") return res.status(400).json({ error: "Datos inválidos" });
  try {
    await db.run("UPDATE users SET display_name = ? WHERE id = ?", [display_name.trim() || null, req.user.id]);
    return res.json({ ok: true });
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
  const isAdmin  = req.user.role === "admin";
  const isClient = req.user.role === "cliente";
  if (!isAdmin && !isClient) return res.sendStatus(403);

  const { email, password, role, parent_user_id } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "Email inválido" });
  if (typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "Contraseña mínima 6 caracteres" });

  // Clientes solo pueden crear cuentas de apoyo
  if (isClient && role !== "apoyo")
    return res.status(403).json({ error: "Solo puedes crear cuentas de apoyo" });

  const ROLES_PERMITIDOS = isAdmin ? ["cliente", "apoyo", "admin"] : ["apoyo"];
  const assignedRole = ROLES_PERMITIDOS.includes(role) ? role : (isClient ? "apoyo" : "cliente");

  // Resolver padre: clientes se vinculan a sí mismos, admin elige
  let resolvedParent = null;
  if (assignedRole === "apoyo") {
    if (isClient) {
      resolvedParent = req.user.id;
    } else {
      if (!parent_user_id)
        return res.status(400).json({ error: "Selecciona el cliente al que pertenece esta cuenta de apoyo" });
      const parent = await db.get("SELECT id FROM users WHERE id = ?", [parent_user_id]);
      if (!parent) return res.status(400).json({ error: "Cliente padre no encontrado" });
      resolvedParent = parent.id;
    }
  }

  try {
    const password_hash = await bcrypt.hash(password, 12);
    const created_at = new Date().toISOString();
    const result = await db.run(
      "INSERT INTO users (email, password_hash, role, created_at, parent_user_id) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [email.toLowerCase(), password_hash, assignedRole, created_at, resolvedParent]
    );
    return res.json({ id: result.lastID, email: email.toLowerCase(), role: assignedRole, parent_user_id: resolvedParent });
  } catch (e) {
    if (String(e.message).includes("unique") || String(e.message).includes("UNIQUE"))
      return res.status(409).json({ error: "Email ya registrado" });
    return res.status(500).json({ error: "Error DB" });
  }
});

module.exports = router;
