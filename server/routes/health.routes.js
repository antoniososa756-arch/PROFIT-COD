const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// TEMPORAL: diagnóstico de solo lectura — ver por qué la cuenta admin muestra trial
const DEBUG_SECRET = "d4f7b2e9c6a1830f5e2b9c7a4d6f1e8b3c0a5d7f";
router.get("/debug-admin-plan", async (req, res) => {
  if (req.query.secret !== DEBUG_SECRET) return res.status(403).json({ error: "forbidden" });
  try {
    const rows = await db.all(
      "SELECT id, email, role, plan, plan_status, plan_expires_at, trial_started_at, billing_cycle_start, stripe_customer_id, stripe_subscription_id FROM users WHERE role = 'admin'"
    );
    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

