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

  // Añadir columnas nuevas si no existen (migraciones seguras)
try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS financial_status TEXT`); } catch(e) {}
  try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS raw_json TEXT`); } catch(e) {}
  try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_domain TEXT`); } catch(e) {}

await pool.query(`
    CREATE TABLE IF NOT EXISTS productos_stock (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      shop_domain TEXT NOT NULL,
      product_id TEXT NOT NULL,
      stock INTEGER DEFAULT 0,
      stock_minimo INTEGER DEFAULT 5,
      costo_compra NUMERIC(10,2) DEFAULT 0,
      UNIQUE(user_id, shop_domain, product_id)
    )
  `);
  await pool.query(`ALTER TABLE productos_stock ADD COLUMN IF NOT EXISTS costo_compra NUMERIC(10,2) DEFAULT 0`);

await pool.query(`
    CREATE TABLE IF NOT EXISTS gastos_fijos_precios_globales (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      precio_mrw NUMERIC(10,2) DEFAULT 0,
      precio_logistica NUMERIC(10,2) DEFAULT 0
    )
  `);

await pool.query(`
    CREATE TABLE IF NOT EXISTS informes_ingresos_manuales (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      shop_domain TEXT NOT NULL,
      mes TEXT NOT NULL,
      columna INTEGER NOT NULL,
      nombre TEXT DEFAULT '',
      valor NUMERIC(10,2) DEFAULT 0,
      UNIQUE(user_id, shop_domain, mes, columna)
    )
  `);

await pool.query(`
    CREATE TABLE IF NOT EXISTS productos_variantes_config (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      shop_domain TEXT NOT NULL,
      variant_id TEXT NOT NULL,
      unidades_por_venta INTEGER DEFAULT 1,
      UNIQUE(user_id, shop_domain, variant_id)
    )
  `);

await pool.query(`
    CREATE TABLE IF NOT EXISTS entradas_mercancia (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      shop_domain TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      stock_anterior INTEGER NOT NULL,
      stock_nuevo INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT now()::text
    )
  `);
await pool.query(`ALTER TABLE productos_stock ADD COLUMN IF NOT EXISTS costo_compra NUMERIC(10,2) DEFAULT 0`);

await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      shop_domain TEXT NOT NULL,
      product_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      order_number TEXT,
      movement_type TEXT NOT NULL,
      units INTEGER NOT NULL,
      movement_date DATE NOT NULL,
      UNIQUE(user_id, order_id, product_id, movement_type)
    )
  `);
await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_movements_user_product ON stock_movements(user_id, product_id)`);

await pool.query(`
    CREATE TABLE IF NOT EXISTS product_groups (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(user_id, name)
    )
  `);
await pool.query(`
    CREATE TABLE IF NOT EXISTS product_group_members (
      group_id INTEGER NOT NULL REFERENCES product_groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      shop_domain TEXT NOT NULL,
      PRIMARY KEY(group_id, product_id)
    )
  `);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pgm_user_product ON product_group_members(user_id, product_id)`);

await pool.query(`
    CREATE TABLE IF NOT EXISTS reembolsos_estado (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      order_id TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      UNIQUE(user_id, order_id)
    )
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active INTEGER NOT NULL DEFAULT 1`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT`);
await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_mrw_check TEXT`);
await pool.query(`ALTER TABLE reembolsos_estado ADD COLUMN IF NOT EXISTS tracking_number TEXT`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_name TEXT`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_nif TEXT`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_address TEXT`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_city TEXT`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_zip TEXT`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_country TEXT`);

  // Columna cancelled_at separada para queries rápidas sin parsear raw_json
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TEXT`);

  // Poblar cancelled_at de registros existentes con raw_json ya guardado
  try {
    await pool.query(`
      UPDATE orders
      SET cancelled_at = raw_json::json->>'cancelled_at'
      WHERE fulfillment_status = 'cancelado'
        AND raw_json IS NOT NULL
        AND cancelled_at IS NULL
        AND raw_json::json->>'cancelled_at' IS NOT NULL
    `);
  } catch(e) { console.warn("Migration cancelled_at:", e.message); }

  // Índices para queries rápidas con 50k+ pedidos
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON orders(shop_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(fulfillment_status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON orders(cancelled_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_shop_domain  ON orders(shop_domain)`);

  console.log("✅ PostgreSQL tablas inicializadas");
}

initDB().catch(err => console.error("❌ Error inicializando DB:", err));

module.exports = db;
