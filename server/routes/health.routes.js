const express = require("express");
const { Client } = require("pg");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// ── TEMPORAL: diagnóstico de conexiones/locks colgados en Postgres ──
// Clave de un solo uso para este incidente. Quitar todo este bloque al resolverlo.
const DIAG_SECRET = "97287b8e55fcea300b6b8ed9a98697e971daae544709f7b5";
function checkSecret(req, res) {
  if (req.query.secret !== DIAG_SECRET) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

router.get("/db-diag", async (req, res) => {
  if (!checkSecret(req, res)) return;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
    query_timeout: 8000,
  });
  try {
    await client.connect();
    const r = await client.query(`
      SELECT pid, state, wait_event_type, wait_event,
             query, now() - query_start AS duration, now() - xact_start AS xact_duration,
             client_addr, application_name
      FROM pg_stat_activity
      WHERE datname = current_database()
      ORDER BY duration DESC NULLS LAST
    `);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await client.end().catch(() => {});
  }
});

router.post("/db-diag/kill/:pid", async (req, res) => {
  if (!checkSecret(req, res)) return;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
    query_timeout: 8000,
  });
  try {
    await client.connect();
    const r = await client.query("SELECT pg_terminate_backend($1) AS ok", [req.params.pid]);
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await client.end().catch(() => {});
  }
});

module.exports = router;

