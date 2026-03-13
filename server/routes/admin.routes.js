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
    const rows = await db.all("SELECT id, email, role, created_at FROM users ORDER BY created_at DESC");
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

module.exports = router;
