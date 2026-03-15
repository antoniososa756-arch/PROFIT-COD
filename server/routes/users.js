const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const auth = require("../middlewares/auth");
const router = express.Router();

router.get("/", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "No autorizado" });
  try {
    const rows = await db.all("SELECT id, email, role, active, created_at FROM users ORDER BY created_at DESC");
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Error al obtener usuarios" }); }
});

router.post("/create", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "No autorizado" });
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Datos incompletos" });

  try {
    const exists = await db.get("SELECT id FROM users WHERE email = ?", [email]);
    if (exists) return res.status(409).json({ error: "Usuario ya existe" });

    const hash = await bcrypt.hash(password, 12);
    const finalRole = role === "admin" ? "admin" : "cliente";
    await db.run(
      "INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, now()::text)",
      [email, hash, finalRole]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Error servidor" }); }
});

module.exports = router;
