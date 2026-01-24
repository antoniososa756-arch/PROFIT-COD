console.log("🔥 AUTH.ROUTES.JS REAL CARGADO");
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const auth = require("../middlewares/auth");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET no está definido");
  process.exit(1);
}

const router = express.Router();

function isValidEmail(email) {
  return typeof email === "string" && email.includes("@") && email.length <= 200;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/* =====================
   CREATE ADMIN (1 VEZ)
   ===================== */
router.post("/create-admin", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!isValidEmail(email)) return res.status(400).json({ error: "Email inválido" });
    if (typeof password !== "string" || password.length < 6)
      return res.status(400).json({ error: "Contraseña mínima 6 caracteres" });

    db.get("SELECT id FROM users WHERE role = 'admin'", async (err, admin) => {
      if (admin) return res.status(403).json({ error: "Admin ya existe" });

      const password_hash = await bcrypt.hash(password, 12);
      const created_at = new Date().toISOString();

      db.run(
        "INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)",
        [email.toLowerCase(), password_hash, created_at],
        function (err2) {
          if (err2) return res.status(500).json({ error: "Error DB" });

          const user = { id: this.lastID, email: email.toLowerCase(), role: "admin" };
          const token = signToken(user);
          return res.json({ token, user });
        }
      );
    });
  } catch {
    return res.status(500).json({ error: "Error servidor" });
  }
});

/* =====================
   LOGIN
   ===================== */
router.post("/login", (req, res) => {
  console.log("🔥🔥🔥 LOGIN HIT 🔥🔥🔥");

  const rawEmail = req.body?.email;
const rawPassword = req.body?.password;

const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
const password = typeof rawPassword === "string" ? rawPassword.trim() : "";


  console.log("📩 BODY RECIBIDO:", req.body);

  if (!isValidEmail(email)) {
    console.log("❌ EMAIL INVALIDO:", email);
    return res.status(400).json({ error: "Email inválido" });
  }

  if (typeof password !== "string") {
    console.log("❌ PASSWORD INVALIDO:", password);
    return res.status(400).json({ error: "Contraseña inválida" });
  }

  const emailLower = email.toLowerCase();
  console.log("🔎 BUSCANDO EMAIL:", emailLower);

  db.get(
    "SELECT id, email, password_hash, role FROM users WHERE email = ?",
    [emailLower],
    async (err, row) => {
      if (err) {
        console.log("❌ ERROR DB:", err);
        return res.status(500).json({ error: "Error DB" });
      }

      console.log("📦 RESULTADO DB:", row);

      if (!row) {
        console.log("❌ USUARIO NO EXISTE");
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      console.log("🔐 PASSWORD RECIBIDA:", password);
      console.log("🔐 HASH EN BD:", row.password_hash);

      const ok = await bcrypt.compare(password, row.password_hash);

      if (!ok) {
        console.log("❌ PASSWORD NO COINCIDE");
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      console.log("✅ LOGIN CORRECTO");

      const user = { id: row.id, email: row.email, role: row.role };
      const token = signToken(user);

      return res.json({ token, user });
    }
  );
});

/* =====================
   ME
   ===================== */
router.get("/me", auth, (req, res) => {
  return res.json({ user: req.user });
});

/* =====================
   CREATE CLIENT (ADMIN)
   ===================== */
router.post("/create-user", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.sendStatus(403);

  const { email, password } = req.body || {};

  if (!isValidEmail(email)) return res.status(400).json({ error: "Email inválido" });
  if (typeof password !== "string" || password.length < 6)
    return res.status(400).json({ error: "Contraseña mínima 6 caracteres" });

  const password_hash = await bcrypt.hash(password, 12);
  const created_at = new Date().toISOString();

  db.run(
    "INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'cliente', ?)",
    [email.toLowerCase(), password_hash, created_at],
    function (err) {
      if (err) {
        if (String(err.message).includes("UNIQUE"))
          return res.status(409).json({ error: "Email ya registrado" });
        return res.status(500).json({ error: "Error DB" });
      }

      return res.json({
        id: this.lastID,
        email: email.toLowerCase(),
        role: "cliente"
      });
    }
  );
});

module.exports = router;
