// server/ctt-sync.js — Sincronización con CTT Express (Área de Clientes).
//
// CTT nunca mandó documentación técnica de su API para integraciones propias
// (dos PDFs que mandaron eran el manual del plugin de Shopify y el manual de
// uso de su web, ninguno un manual de API). Esto se armó inspeccionando en
// vivo la web "Área de Clientes" (webcliente.cttexpress.com) con las
// herramientas de desarrollador del navegador:
//
//  - El login real usa Amazon Cognito (protocolo SRP, no manda la contraseña
//    en texto plano) -- se resuelve con la librería oficial de AWS en vez de
//    reimplementar esa criptografía a mano.
//  - El estado de un envío se consulta con POST a un endpoint "rpc-shippings"
//    alojado en Mulesoft/CloudHub, mandando el token de Cognito.
//
// Si en algún momento CTT manda documentación oficial de un WebService
// distinto, lo correcto sería migrar a eso -- esto es, a falta de mejor
// opción, un acceso equivalente al que tiene cualquier usuario humano desde
// su navegador, automatizado.
const {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoRefreshToken,
} = require("amazon-cognito-identity-js");

const CTT_REGION    = "eu-central-1";
const CTT_POOL_ID   = "eu-central-1_F8jAzJtP0";
const CTT_CLIENT_ID = "bmnqrafpvofp4i537u4stvkso";
const CTT_SHIPPINGS_URL =
  "https://ctt-pro-e-customer-web.de-c1.cloudhub.io/customer-web/item/de.history-history-api/v2/rpc-shippings";

function getUserPool() {
  return new CognitoUserPool({ UserPoolId: CTT_POOL_ID, ClientId: CTT_CLIENT_ID });
}

// Login completo con usuario/contraseña (SRP) -- hace falta cuando no hay
// refresh token guardado todavía, o cuando el refresh también expiró.
function cttLogin(username, password) {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    const user = new CognitoUser({ Username: username, Pool: pool });
    const authDetails = new AuthenticationDetails({ Username: username, Password: password });
    user.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve({
          accessToken: session.getAccessToken().getJwtToken(),
          idToken: session.getIdToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
          expiresAt: new Date(session.getAccessToken().getExpiration() * 1000).toISOString(),
        });
      },
      onFailure: (err) => reject(err),
    });
  });
}

// Renovar sesión con el refresh token guardado, sin volver a pedir contraseña.
function cttRefresh(username, refreshTokenStr) {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    const user = new CognitoUser({ Username: username, Pool: pool });
    const refreshToken = new CognitoRefreshToken({ RefreshToken: refreshTokenStr });
    user.refreshSession(refreshToken, (err, session) => {
      if (err) return reject(err);
      resolve({
        accessToken: session.getAccessToken().getJwtToken(),
        idToken: session.getIdToken().getJwtToken(),
        // El refresh token no cambia al renovar -- Cognito no manda uno nuevo aquí.
        refreshToken: refreshTokenStr,
        expiresAt: new Date(session.getAccessToken().getExpiration() * 1000).toISOString(),
      });
    });
  });
}

// Devuelve un access/id token válido para estas credenciales -- usa el
// guardado en BD si todavía no expiró, lo renueva con el refresh token si
// expiró, o hace login completo si no hay refresh token o también falló.
// Persiste lo que consiga en ctt_credentials para el próximo ciclo.
async function cttGetValidSession(db, creds) {
  const now = Date.now();
  const stillValid = creds.access_token && creds.id_token && creds.token_expires_at
    && new Date(creds.token_expires_at).getTime() - now > 2 * 60 * 1000; // 2 min de margen
  if (stillValid) {
    return { accessToken: creds.access_token, idToken: creds.id_token };
  }

  let session = null;
  if (creds.refresh_token) {
    try { session = await cttRefresh(creds.area_usuario, creds.refresh_token); }
    catch (e) { session = null; }
  }
  if (!session) {
    session = await cttLogin(creds.area_usuario, creds.area_contrasena);
  }

  await db.run(
    `UPDATE ctt_credentials SET access_token = $1, id_token = $2, refresh_token = $3, token_expires_at = $4 WHERE user_id = $5`,
    [session.accessToken, session.idToken, session.refreshToken, session.expiresAt, creds.user_id]
  ).catch(() => {});

  return { accessToken: session.accessToken, idToken: session.idToken };
}

// Consulta el estado de un envío por su número de seguimiento.
// NOTA: el formato exacto del "filter" (nombres de campo/operador) se infirió
// observando la petición real en el navegador con el objeto colapsado --
// puede necesitar un ajuste si CTT devuelve un error de filtro inválido.
async function cttFetchShipment(accessToken, idToken, trackingNumber) {
  const body = {
    page: { page_offset: 0, page_limit: 1 },
    config: { view: "WEBCLIENT", language: "ES" },
    filter: {
      group_operation: "AND",
      filters: [
        { field: "shipping_code", operator: "EQUALS", value: trackingNumber },
      ],
    },
  };
  const res = await fetch(CTT_SHIPPINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      Id_token: idToken,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new Error(`Respuesta no-JSON de CTT (${res.status}): ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(json?.message || json?.error || `CTT respondió ${res.status}`);
  return json?.data?.[0] || null;
}

// Mapea el estado de CTT al mismo vocabulario que ya usa ProfitCOD
// (pendiente/en_preparacion/enviado/en_transito/entregado/devuelto/destruido/
// cancelado) -- basado en los codigos de evento "WEBxxxx" vistos en la
// respuesta real. Códigos no reconocidos caen en "en_transito" para no
// bloquear el pedido en un estado viejo, igual que hace mapMRWStatus.
function mapCTTStatus(shipment) {
  if (!shipment) return null;
  if (shipment.is_nulled) return "cancelado";
  const code = shipment.last_event_code || "";
  const milestone = shipment.tracking_info?.text?.toLowerCase() || "";
  if (code === "SHIPPING_DELIVERED" || milestone.includes("entregado")) return "entregado";
  if (milestone.includes("devuel")) return "devuelto";
  if (milestone.includes("destru")) return "destruido";
  if (milestone.includes("anulad") || milestone.includes("cancelad")) return "cancelado";
  const lastEvent = (shipment.events || [])[shipment.events.length - 1];
  const evCode = lastEvent?.code || "";
  if (evCode === "WEB0000") return "pendiente";
  if (evCode === "WEB0500") return "en_preparacion";
  return "en_transito";
}

module.exports = { cttLogin, cttRefresh, cttGetValidSession, cttFetchShipment, mapCTTStatus };
