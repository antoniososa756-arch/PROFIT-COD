const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// TEMPORAL: diagnóstico de solo lectura — auditar el estado de plan/trial de todos los clientes
const DEBUG_SECRET = "b6e4d1a8f7c2039e5b8a4c1d7f2e6b0a3c9d5f81";
router.get("/debug-all-clients-plan", async (req, res) => {
  if (req.query.secret !== DEBUG_SECRET) return res.status(403).json({ error: "forbidden" });
  try {
    const rows = await db.all(
      `SELECT id, email, plan, plan_status, plan_expires_at, trial_started_at, stripe_subscription_id
       FROM users WHERE role = 'cliente' ORDER BY id`
    );
    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

