const express = require("express");
const auth = require("../middlewares/auth");
const router = express.Router();

function mapMRWStatus(texto) {
  const t = (texto || "").toLowerCase();
  if (t.includes("entregado")) return "entregado";
  if (t.includes("tránsito") || t.includes("transito")) return "en_transito";
  if (t.includes("devuelto") || t.includes("retorno")) return "devuelto";
  if (t.includes("destruido")) return "destruido";
  if (t.includes("ausente") || t.includes("no entregado")) return "no_entregado";
  return "en_transito";
}

async function mrwLogin(user, password) {
  const res = await fetch("https://clientes.mrw.es/api/handlers/Login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://clientes.mrw.es/",
      "Origin": "https://clientes.mrw.es",
    },
    body: JSON.stringify({
      sessionKey: "",
      name: "login",
      params: { user, password, webbaseurl: "https://clientes.mrw.es/#" }
    }),
  });
  const cookies = res.headers.get("set-cookie") || "";
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  return {
    sessionKey: data.sessionKey || data.SessionKey || "",
    userId: data.userId || data.UserId || "",
    cookies
  };
}

// ✅ PRIMERO credentials, LUEGO /:tracking
router.post("/credentials", auth, async (req, res) => {
  const { mrw_user, mrw_password } = req.body;
  const userId = req.user.id;

  if (!mrw_user || !mrw_password) {
    return res.status(400).json({ error: "Faltan credenciales" });
  }

  try {
    await new Promise((resolve, reject) => {
      req.db.run(
        `UPDATE users SET mrw_user = ?, mrw_password = ? WHERE id = ?`,
        [mrw_user, mrw_password, userId],
        err => err ? reject(err) : resolve()
      );
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error guardando credenciales" });
  }
});

router.get("/:tracking", auth, async (req, res) => {
  const { tracking } = req.params;
  const userId = req.user.id;

  try {
    // 1. Obtener credenciales MRW desde la BD
    const user = await new Promise((resolve, reject) => {
      req.db.get(
        `SELECT mrw_user, mrw_password FROM users WHERE id = ?`,
        [userId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!user || !user.mrw_user || !user.mrw_password) {
      return res.json({ ok: false, error: "Sin credenciales MRW configuradas" });
    }

    // 2. Login en MRW
    const { sessionKey, userId: mrwUserId, cookies } = await mrwLogin(user.mrw_user, user.mrw_password);

    if (!sessionKey) {
      return res.json({ ok: false, error: "Login MRW fallido" });
    }

    // 3. Consultar tracking
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    const fmt = d => `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;

    const qry = JSON.stringify({
      UserId: mrwUserId,
      Abonados: [],
      FechaDesde: fmt(sixMonthsAgo),
      FechaHasta: fmt(today),
      NumEnvioDesdeLongitud12: tracking,
      NumEnvioHastaLongitud12: tracking,
      Tipo: "Normal",
      Estado: "",
      TipoEstado: "",
      EsInternacional: false,
      OrderField: "FechaEnvio",
      Order: "DESC"
    });

    const trackRes = await fetch("https://clientes.mrw.es/api/handlers/EnviosConsultasBase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://clientes.mrw.es/",
        "Origin": "https://clientes.mrw.es",
        "Cookie": cookies,
      },
      body: JSON.stringify({
        sessionKey,
        name: "GetDataTablePubliEnvioByQryNacional",
        params: { qry }
      }),
    });

    const trackText = await trackRes.text();
    let trackData;
    try { trackData = JSON.parse(trackText); } catch { trackData = null; }

    if (!trackData) {
      return res.json({ ok: false, error: "Sin respuesta MRW", raw: trackText.substring(0, 300) });
    }

    const rows = trackData.data || trackData.Data || trackData;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.json({ ok: false, error: "Envío no encontrado" });
    }

    const estado = rows[0].Estado || rows[0].estado || rows[0].Situacion || "";
    res.json({ ok: true, raw: estado, status: mapMRWStatus(estado) });

  } catch (err) {
    console.error("MRW error:", err);
    res.status(500).json({ error: "Error consultando MRW" });
  }
});

module.exports = router;