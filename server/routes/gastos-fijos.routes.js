const express = require("express");
const auth = require("../middlewares/auth");
const db = require("../db");
const router = express.Router();

// ── TABLAS ──────────────────────────────────────────────
db.run(`
  CREATE TABLE IF NOT EXISTS gastos_fijos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    fijo INTEGER DEFAULT 0,
    orden INTEGER DEFAULT 0
  )
`, () => {});

db.run(`ALTER TABLE gastos_fijos ADD COLUMN precio_unit REAL DEFAULT NULL`, (err) => {
  if (err && !err.message.includes("duplicate column")) {
    console.error("Error ALTER TABLE:", err.message);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS gastos_fijos_valores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gasto_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    mes TEXT NOT NULL,
    valor REAL DEFAULT 0,
    UNIQUE(gasto_id, user_id, mes)
  )
`, () => {});

db.run(`
  CREATE TABLE IF NOT EXISTS gastos_fijos_precios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gasto_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    mes TEXT NOT NULL,
    precio_unit REAL DEFAULT 0,
    UNIQUE(gasto_id, user_id, mes)
  )
`, () => {});

// ── GET — gastos fijos + valores + precios del mes ──────
router.get("/", auth, (req, res) => {
  const { mes } = req.query;
  const userId = req.user.id;

  const fetchAndRespond = () => {
    db.all(
      `SELECT * FROM gastos_fijos WHERE user_id=? ORDER BY orden ASC, id ASC`,
      [userId],
      (err, items) => {
        if (err) return res.status(500).json({ error: "Error BD" });
        if (!mes) return res.json(items.map(i => ({ ...i, valor: 0 })));

        db.all(`SELECT * FROM gastos_fijos_valores WHERE user_id=? AND mes=?`, [userId, mes], (err2, valores) => {
          if (err2) return res.status(500).json({ error: "Error BD valores" });
          db.all(`SELECT * FROM gastos_fijos_precios WHERE user_id=? AND mes=?`, [userId, mes], (err3, precios) => {
            if (err3) return res.status(500).json({ error: "Error BD precios" });
            const mapVal = {};
            valores.forEach(v => { mapVal[v.gasto_id] = v.valor; });
            const mapPre = {};
            precios.forEach(p => { mapPre[p.gasto_id] = p.precio_unit; });
            const result = items.map(i => ({
              ...i,
              valor: mapVal[i.id] !== undefined ? mapVal[i.id] : 0,
              precio_unit: mapPre[i.id] !== undefined ? mapPre[i.id] : (i.precio_unit ?? 0)
            }));
            res.json(result);
          });
        });
      }
    );
  };

  // Verificar si ya existen MRW y LOGÍSTICA para este usuario
  db.all(
    `SELECT nombre FROM gastos_fijos WHERE user_id=? AND fijo=1`,
    [userId],
    (err, fijos) => {
      if (err) return res.status(500).json({ error: "Error BD" });

      const nombres = fijos.map(f => f.nombre);
      const tareas = [];

      if (!nombres.includes("MRW")) {
        tareas.push(new Promise((resolve) => {
          db.run(
            `INSERT INTO gastos_fijos (user_id, nombre, precio_unit, fijo, orden) VALUES (?,?,?,?,?)`,
            [userId, "MRW", 0, 1, 0],
            () => resolve()
          );
        }));
      }

      if (!nombres.includes("LOGÍSTICA")) {
        tareas.push(new Promise((resolve) => {
          db.run(
            `INSERT INTO gastos_fijos (user_id, nombre, precio_unit, fijo, orden) VALUES (?,?,?,?,?)`,
            [userId, "LOGÍSTICA", 0, 1, 1],
            () => resolve()
          );
        }));
      }

      // Si no hay ninguna fila en absoluto, crear también las filas vacías editables
      db.all(`SELECT id FROM gastos_fijos WHERE user_id=?`, [userId], (err2, all) => {
        if (err2) return res.status(500).json({ error: "Error BD" });

        const filasVacias = all.length === 0 || (all.length <= 2 && tareas.length > 0);

        if (filasVacias) {
          for (let orden = 2; orden <= 6; orden++) {
            tareas.push(new Promise((resolve) => {
              db.run(
                `INSERT INTO gastos_fijos (user_id, nombre, precio_unit, fijo, orden) VALUES (?,?,?,?,?)`,
                [userId, "", null, 0, orden],
                () => resolve()
              );
            }));
          }
        }

        if (tareas.length > 0) {
          Promise.all(tareas).then(() => fetchAndRespond());
        } else {
          fetchAndRespond();
        }
      });
    }
  );
});

// ── POST /reset — limpiar filas vacías basura y garantizar MRW/LOGÍSTICA ──
router.post("/reset", auth, (req, res) => {
  const userId = req.user.id;

  // 1. Borrar filas vacías sin nombre (basura de intentos anteriores)
  db.run(
    `DELETE FROM gastos_fijos WHERE user_id=? AND fijo=0 AND (nombre IS NULL OR nombre='')`,
    [userId],
    () => {
      // 2. Verificar qué fijos existen
      db.all(`SELECT nombre FROM gastos_fijos WHERE user_id=? AND fijo=1`, [userId], (err, fijos) => {
        if (err) return res.status(500).json({ error: "Error BD" });

        const nombres = (fijos || []).map(f => f.nombre);
        const inserts = [];

        if (!nombres.includes("MRW"))
          inserts.push([userId, "MRW", 0, 1, 0]);
        if (!nombres.includes("LOGÍSTICA"))
          inserts.push([userId, "LOGÍSTICA", 0, 1, 1]);

        // 3. Añadir 5 filas vacías editables
        for (let orden = 2; orden <= 6; orden++) {
          inserts.push([userId, "", null, 0, orden]);
        }

        let done = 0;
        if (inserts.length === 0) return res.json({ ok: true });

        inserts.forEach(vals => {
          db.run(
            `INSERT INTO gastos_fijos (user_id, nombre, precio_unit, fijo, orden) VALUES (?,?,?,?,?)`,
            vals,
            () => { if (++done === inserts.length) res.json({ ok: true }); }
          );
        });
      });
    }
  );
});

// ── POST — crear gasto fijo ─────────────────────────────
router.post("/", auth, (req, res) => {
  const { nombre, precio_unit, fijo, orden } = req.body;
  db.run(
    `INSERT INTO gastos_fijos (user_id, nombre, precio_unit, fijo, orden) VALUES (?,?,?,?,?)`,
    [req.user.id, nombre||"", precio_unit!=null ? parseFloat(precio_unit) : null, fijo?1:0, orden||0],
    function(err) {
      if (err) return res.status(500).json({ error: "Error guardando" });
      res.json({ id: this.lastID });
    }
  );
});

// ── PUT — actualizar nombre/precio_unit global ──────────
router.put("/:id", auth, (req, res) => {
  const { nombre, precio_unit } = req.body;
  db.run(
    `UPDATE gastos_fijos SET nombre=?, precio_unit=? WHERE id=? AND user_id=?`,
    [nombre, precio_unit!=null ? parseFloat(precio_unit) : null, req.params.id, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Error actualizando" });
      res.json({ ok: true });
    }
  );
});

// ── PUT — valor mensual ─────────────────────────────────
router.put("/:id/valor", auth, (req, res) => {
  const { mes, valor } = req.body;
  db.run(
    `INSERT INTO gastos_fijos_valores (gasto_id, user_id, mes, valor) VALUES (?,?,?,?)
     ON CONFLICT(gasto_id, user_id, mes) DO UPDATE SET valor=excluded.valor`,
    [req.params.id, req.user.id, mes, parseFloat(valor)||0],
    (err) => {
      if (err) return res.status(500).json({ error: "Error guardando valor" });
      res.json({ ok: true });
    }
  );
});

// ── PUT — precio_unit mensual ───────────────────────────
router.put("/:id/precio", auth, (req, res) => {
  const { mes, precio_unit } = req.body;
  db.run(
    `INSERT INTO gastos_fijos_precios (gasto_id, user_id, mes, precio_unit) VALUES (?,?,?,?)
     ON CONFLICT(gasto_id, user_id, mes) DO UPDATE SET precio_unit=excluded.precio_unit`,
    [req.params.id, req.user.id, mes, parseFloat(precio_unit)||0],
    (err) => {
      if (err) return res.status(500).json({ error: "Error guardando precio" });
      res.json({ ok: true });
    }
  );
});

// ── DELETE ──────────────────────────────────────────────
router.delete("/:id", auth, (req, res) => {
  db.run(
    `DELETE FROM gastos_fijos WHERE id=? AND user_id=?`,
    [req.params.id, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Error eliminando" });
      db.run(`DELETE FROM gastos_fijos_valores WHERE gasto_id=? AND user_id=?`, [req.params.id, req.user.id], () => {});
      db.run(`DELETE FROM gastos_fijos_precios WHERE gasto_id=? AND user_id=?`, [req.params.id, req.user.id], () => {});
      res.json({ ok: true });
    }
  );
});

module.exports = router;
