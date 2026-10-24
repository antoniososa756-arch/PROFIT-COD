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
const CTT_API_BASE = "https://ctt-pro-e-customer-web.de-c1.cloudhub.io/customer-web";
const CTT_SHIPPINGS_URL = `${CTT_API_BASE}/item-history-api/private/v2/rpc-shippings`;

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

function cttHeaders(accessToken, idToken) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    Id_token: idToken,
  };
}

// Lee el payload del id token de Cognito (JWT) sin verificar la firma --
// solo se usa para sacar el "cognito:username", que es lo que la web de CTT
// usa como identificador en /web-user-data/{id}.
function decodeJwtPayload(token) {
  const part = String(token || "").split(".")[1] || "";
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

// Datos de la cuenta: el backend de CTT exige filtrar rpc-shippings por
// "client_code" (si no, responde 500 "Client_Code not found"). Ese valor va
// cifrado (ej. "CzFmvEDOVGM=") pero la propia web no lo cifra: lo recibe ya
// cifrado de este endpoint como "client_id", igual que los ids de los
// centros (client_center_id, el "hideId" de su frontend).
async function cttGetUserData(accessToken, idToken) {
  const cognitoId = decodeJwtPayload(idToken)["cognito:username"];
  if (!cognitoId) throw new Error("El token de CTT no trae cognito:username");
  const res = await fetch(`${CTT_API_BASE}/web-user-data/${encodeURIComponent(cognitoId)}`, {
    method: "GET",
    headers: cttHeaders(accessToken, idToken),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new Error(`Respuesta no-JSON de CTT web-user-data (${res.status}): ${text.slice(0, 300)}`); }
  if (!res.ok) throw new Error(`CTT web-user-data respondió ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  const user = Array.isArray(json?.data) ? json.data[0] : null;
  // OJO: el filtro "client_code" de rpc-shippings espera el client_id (la
  // versión cifrada), no el client_code en claro -- con este último CTT
  // responde 500 DECRYPT_ERROR. Así lo hace su frontend (clientCode: clientId).
  if (!user?.client_id) throw new Error(`CTT web-user-data sin client_id: ${JSON.stringify(json).slice(0, 300)}`);
  return {
    clientCode: user.client_id,
    centerIds: (user.client_centers || []).map((c) => c.client_center_id).filter(Boolean),
    canViewAllCenters: !!user.effective_permissions?.can_view_all_centers,
  };
}

// Pide la lista de envíos recientes de la cuenta con los mismos filtros que
// manda la web de CTT, y se filtra en este lado por número de seguimiento --
// así se traen VARIOS envíos en una sola llamada en vez de una por pedido.
async function cttListShipments(accessToken, idToken, { pageLimit = 100, daysBack = 90 } = {}) {
  const { clientCode, centerIds, canViewAllCenters } = await cttGetUserData(accessToken, idToken);
  const now = new Date();
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const filters = [
    { field: "item_number", operation: "EQUALS", value: 1 },
    { field: "current_status_code", operation: "IS_NOT_NULL" },
    { field: "client_code", operation: "EQUALS", value: clientCode },
  ];
  if (!canViewAllCenters && centerIds.length) {
    filters.push({ field: "client_center_code", operation: "IN", value: centerIds });
  }
  filters.push({ field: "manifest_datetime", operation: "RANGE", from_value: from.toISOString(), to_value: now.toISOString() });
  const body = {
    page: { page_offset: 0, page_limit: pageLimit },
    config: { view: "WEBCLIENT", language: "ES", show_items: false },
    filter: { group_operation: "AND", filters },
  };
  const res = await fetch(CTT_SHIPPINGS_URL, {
    method: "POST",
    headers: cttHeaders(accessToken, idToken),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new Error(`Respuesta no-JSON de CTT (${res.status}): ${text.slice(0, 300)}`); }
  if (!res.ok) {
    // El error de CTT puede venir como string o como objeto anidado -- lo
    // serializamos completo (antes se perdía el detalle real, mostrando
    // solo "[object Object]" si message/error no era un string plano).
    const detail = typeof json?.message === "string" ? json.message
      : typeof json?.error === "string" ? json.error
      : JSON.stringify(json).slice(0, 500);
    throw new Error(`CTT respondió ${res.status}: ${detail}`);
  }
  return Array.isArray(json?.data) ? json.data : [];
}

// Busca un envío puntual por su número de seguimiento dentro de la lista
// reciente (ver cttListShipments).
async function cttFetchShipment(accessToken, idToken, trackingNumber) {
  const list = await cttListShipments(accessToken, idToken);
  return list.find((s) => s.shipping_code === trackingNumber) || null;
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

module.exports = { cttLogin, cttRefresh, cttGetValidSession, cttGetUserData, cttListShipments, cttFetchShipment, mapCTTStatus };
