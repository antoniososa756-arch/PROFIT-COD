const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "data.sqlite");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cliente',
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // TABLA SHOPS (SIN app_secret)
  db.run(`
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      shop_domain TEXT NOT NULL,
      access_token TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      last_sync TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, shop_domain),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // MIGRACIÓN SEGURA: añadir app_secret
  db.run(
    `ALTER TABLE shops ADD COLUMN app_secret TEXT`,
    err => {
      if (err && !err.message.includes("duplicate column")) {
        console.error("DB alter error:", err.message);
      }
    }
  );
});

db.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER,
    order_id TEXT UNIQUE,
    order_number TEXT,
    created_at TEXT,
    customer_name TEXT,
    total_price REAL,
    currency TEXT,
    fulfillment_status TEXT,
    tracking_number TEXT,
    carrier TEXT,
    raw_json TEXT,
    updated_at TEXT
  )
`);

module.exports = db;
