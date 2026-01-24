const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

const router = express.Router();

/* =========================
   CREAR CLIENTE (ADMIN)
   ========================= */
router.post("/clients", auth, admin, async (req, res) => {
  const { email, password, role } = req.body || {};

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Email inválido" });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Contraseña mínima 6 caracteres" });
  }

  const finalRole = role === "admin" ? "admin" : "cliente";
  const password_hash = await bcrypt.hash(password, 12);

  db.run(
    `
    INSERT INTO users (email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?)
    `,
    [email.toLowerCase(), password_hash, finalRole, new Date().toISOString()],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(409).json({ error: "Email ya existe" });
        }
        return res.status(500).json({ error: "Error DB" });
      }

      res.json({
        id: this.lastID,
        email: email.toLowerCase(),
        role: finalRole,
      });
    }
  );
});

/* =========================
   LISTAR CLIENTES (ADMIN)
   ========================= */
router.get("/clients", auth, admin, (req, res) => {
  db.all(
    `
    SELECT id, email, role, created_at
    FROM users
    ORDER BY created_at DESC
    `,
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Error DB" });
      res.json(rows);
    }
  );
});

/* =========================
   RESET PASSWORD (ADMIN)
   ========================= */
router.post("/reset-password/:id", auth, admin, async (req, res) => {
  console.log("🔐 RESET PASSWORD HIT");
  console.log("BODY RECIBIDO:", req.body);

  try {
    const userId = req.params.id;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Contraseña inválida" });
    }

    const password_hash = await bcrypt.hash(password, 12);

    db.run(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [password_hash, userId],
      function (err) {
        if (err) {
          return res.status(500).json({ error: "Error DB" });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json({ ok: true });
      }
    );
  } catch (e) {
    res.status(500).json({ error: "Error servidor" });
  }
});

/* =========================
   IMPERSONATE (ADMIN)
   ========================= */
router.post("/impersonate/:userId", auth, admin, async (req, res) => {
  const { userId } = req.params;

  const user = await db.get(
    "SELECT id, email, role FROM users WHERE id = ?",
    [userId]
  );

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      impersonatedBy: req.user.id
    },
    process.env.JWT_SECRET,
    { expiresIn: "30m" }
  );

  res.json({ token });
});

/* =========================
   RESET PASSWORD (ADMIN)
   ========================= */
router.post("/reset-password/:id", auth, admin, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};

  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Contraseña inválida" });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    db.run(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [hash, id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: "Error DB" });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json({ ok: true });
      }
    );
  } catch (e) {
    res.status(500).json({ error: "Error servidor" });
  }
});


/* =========================
   IMPERSONATE USER (ADMIN)
   ========================= */
router.post("/impersonate/:id", auth, admin, (req, res) => {
  const userId = req.params.id;

  db.get(
    "SELECT id, email, role FROM users WHERE id = ?",
    [userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: "Error DB" });
      }

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          impersonatedBy: req.user.id, // admin id
          isImpersonated: true
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      res.json({ token });
    }
  );
});


/* =========================
   EXPORT (SIEMPRE AL FINAL)
   ========================= */
module.exports = router;
