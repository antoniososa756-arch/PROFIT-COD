const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Helper para compatibilidad con el código existente (que usa db.run, db.get, db.all)
const db = {
  query: (text, params) => pool.query(text, params),

  run: (text, params = []) => {
    // Convertir ? a $1, $2... (SQLite → PostgreSQL)
    let i = 0;
    const pgText = text.replace(/\?/g, () => `$${++i}`);
    return pool.query(pgText, params).then(res => ({
      lastID: res.rows[0]?.id,
      changes: res.rowCount,
    }));
  },

  get: (text, params = []) => {
    let i = 0;
    const pgText = text.replace(/\?/g, () => `$${++i}`);
    return pool.query(pgText, params).then(res => res.rows[0] || null);
  },

  all: (text, params = []) => {
    let i = 0;
    const pgText = text.replace(/\?/g, () => `$${++i}`);
    return pool.query(pgText, params).then(res => res.rows);
  },

  serialize: (fn) => fn(),
};

// Inicializar tablas
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cliente',
      created_at TEXT NOT NULL,
      mrw_user TEXT,
      mrw_password TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shops (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      shop_domain TEXT NOT NULL,
      access_token TEXT NOT NULL,
      app_secret TEXT,
      shop_name TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      last_sync TEXT,
      created_at TEXT NOT NULL DEFAULT now()::text,
      UNIQUE(user_id, shop_domain),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      shop_id INTEGER,
      order_id TEXT UNIQUE,
      order_number TEXT,
      created_at TEXT,
      customer_name TEXT,
      total_price REAL,
      currency TEXT,
      fulfillment_status TEXT,
      financial_status TEXT,
      tracking_number TEXT,
      carrier TEXT,
      raw_json TEXT,
      updated_at TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gastos_fijos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      precio_unit REAL DEFAULT NULL,
      fijo INTEGER DEFAULT 0,
      orden INTEGER DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gastos_fijos_valores (
      id SERIAL PRIMARY KEY,
      gasto_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      mes TEXT NOT NULL,
      valor REAL DEFAULT 0,
      UNIQUE(gasto_id, user_id, mes)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gastos_fijos_precios (
      id SERIAL PRIMARY KEY,
      gasto_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      mes TEXT NOT NULL,
      precio_unit REAL DEFAULT 0,
      UNIQUE(gasto_id, user_id, mes)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS impuestos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      porcentaje REAL DEFAULT 0,
      fijo INTEGER DEFAULT 0,
      orden INTEGER DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gastos_varios (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      shop_domain TEXT NOT NULL,
      mes TEXT NOT NULL,
      shopify REAL DEFAULT 0,
      UNIQUE(user_id, shop_domain, mes)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ads (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      shop_domain TEXT NOT NULL,
      date TEXT NOT NULL,
      meta REAL DEFAULT 0,
      tiktok REAL DEFAULT 0,
      UNIQUE(user_id, shop_domain, date)
    )
  `);

  console.log("✅ PostgreSQL tablas inicializadas");
}

initDB().catch(err => console.error("❌ Error inicializando DB:", err));

module.exports = db;
