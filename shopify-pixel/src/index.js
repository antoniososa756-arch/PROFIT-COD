// PROFITCOD — pixel de "Carritos Activos"
//
// Este archivo NO se despliega con el resto del servidor (git push / Render).
// Va dentro de una EXTENSIÓN de Shopify (tipo "Web Pixel"), que se despliega
// aparte con Shopify CLI hacia el Partner Dashboard. Ver las instrucciones en
// shopify-pixel/README.md para los pasos exactos.
//
// Qué hace: escucha 4 eventos estándar del comprador (vista de página,
// añadir al carrito, inicio de pago, compra) y se los manda a PROFITCOD en
// tiempo real via fetch(), para poder calcular "visitantes ahora mismo",
// "carritos activos", "en el pago" y "compras realizadas" por tienda.
//
// No lee nada del contenido de la página (el sandbox de Web Pixels no lo
// permite) y no identifica a la persona — solo un clientId anónimo que
// Shopify ya genera por navegador.

import { register } from "@shopify/web-pixels-extension";

register(({ analytics, settings }) => {
  // "shopDomain" se define como campo de settings en shopify.extension.toml
  // y se rellena automáticamente al activar el pixel para cada tienda (ver
  // activarPixelCarritos() en server/routes/shopify.routes.js) — así
  // identificamos la tienda aunque use un dominio propio distinto de
  // *.myshopify.com en el navegador del comprador.
  const shopDomain = settings.shopDomain;
  const BACKEND_URL = "https://profitcod.com/api/carritos/evento";

  function enviar(tipo, event) {
    if (!shopDomain || !event?.clientId) return;
    try {
      fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // keepalive para que el evento no se pierda si el visitante navega
        // a otra página justo después (ej. al completar el pago).
        keepalive: true,
        body: JSON.stringify({ shopDomain, tipo, clientId: event.clientId }),
      }).catch(() => {});
    } catch (e) {
      // Nunca debe romper la tienda del cliente por un fallo de red aquí.
    }
  }

  analytics.subscribe("page_viewed", (event) => enviar("visita", event));
  analytics.subscribe("product_added_to_cart", (event) => enviar("carrito", event));
  analytics.subscribe("checkout_started", (event) => enviar("pago_iniciado", event));
  analytics.subscribe("checkout_completed", (event) => enviar("compra", event));
});
