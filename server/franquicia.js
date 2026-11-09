// Desde cuándo está un envío en franquicia: fecha (yyyy-mm-dd) del PRIMER
// evento del seguimiento que menciona "franquicia" (p.ej. "Pendiente de
// recoger en Franquicia destino"), aunque MRW lo repita varios días.
// Se guarda en orders.franquicia_desde (cron MRW y /mrw-history) y lo usa
// Gestión Ecom > Incidencias MRW > Franquicia para contar los días.

// history: [{ estado, fecha: "dd/mm/yyyy" }] (formato de mrw_history_json)
function franquiciaDesde(history) {
  for (const h of Array.isArray(history) ? history : []) {
    if (!/franquicia/i.test(h?.estado || "")) continue;
    const m = String(h.fecha || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return null;
}

// Eventos {estado, fecha} desde la respuesta SOAP de MRW (GetEnvios con
// tipoInformacion=1), en el mismo formato que mrw_history_json.
function historialDesdeXml(xml) {
  const scope = String(xml || "").match(/<\w*:?SeguimientoAbonado[^>]*>([\s\S]*?)<\/\w*:?SeguimientoAbonado>/);
  if (!scope) return [];
  return [...scope[1].matchAll(/<\w*:?Seguimiento>([\s\S]*?)<\/\w*:?Seguimiento>/g)].map(m => {
    const d = m[1].match(/<\w*:?EstadoDescripcion[^>]*>([^<]+)<\/\w*:?EstadoDescripcion>/);
    const p = m[1].match(/<\w*:?Publicado[^>]*>(\d{4})-(\d{2})-(\d{2})T/);
    return d && p ? { estado: d[1].trim(), fecha: `${p[3]}/${p[2]}/${p[1]}` } : null;
  }).filter(Boolean);
}

module.exports = { franquiciaDesde, historialDesdeXml };
