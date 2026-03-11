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
      params: {
        user,
        password,
        webbaseurl: "https://clientes.mrw.es/#"
      }
    }),
  });

  const cookies = res.headers.get("set-cookie") || "";
  const text = await res.text();

  let data;
  try { data = JSON.parse(text); } catch { data = {}; }

  return { sessionKey: data.sessionKey || data.SessionKey || "", userId: data.userId || data.UserId || "", cookies };
}

router.get("/:tracking", auth, async (req, res) => {
  const { tracking } = req.params;

  try {
    // 1. Login con credenciales del usuario
    const mrwUser = req.user.mrw_user;
    const mrwPass = req.user.mrw_password;

    if (!mrwUser || !mrwPass) {
      return res.json({ ok: false, error: "Sin credenciales MRW configuradas" });
    }

    const { sessionKey, userId, cookies } = await mrwLogin(mrwUser, mrwPass);

    if (!sessionKey) {
      return res.json({ ok: false, error: "Login MRW fallido" });
    }

    // 2. Consultar tracking
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    const fmt = d => `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;

    const qry = JSON.stringify({
      UserId: userId,
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
      return res.json({ ok: false, error: "Sin respuesta de MRW", raw: trackText.substring(0, 300) });
    }

    // Extraer estado
    const rows = trackData.data || trackData.Data || trackData;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.json({ ok: false, error: "Envío no encontrado en MRW" });
    }

    const estado = rows[0].Estado || rows[0].estado || rows[0].Situacion || "";
    res.json({ ok: true, raw: estado, status: mapMRWStatus(estado) });

  } catch (err) {
    console.error("MRW error:", err);
    res.status(500).json({ error: "Error consultando MRW" });
  }
});

module.exports = router;