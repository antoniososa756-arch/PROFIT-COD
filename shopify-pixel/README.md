# Carritos Activos — despliegue del pixel de Shopify

Esta parte **no se despliega con `git push`** como el resto de la app. Shopify exige
que el código que corre en el navegador de tus compradores sea una "extensión" de
tu app, publicada aparte hacia el Partner Dashboard con la Shopify CLI. Son ~10
minutos, una sola vez.

Ya está hecho de mi parte:
- El backend pide los permisos nuevos (`write_pixels`, `read_customer_events`) al
  conectar/reconectar una tienda.
- Al conectar/reconectar, el backend ya intenta activar el pixel automáticamente
  (`activarPixelCarritos` en `server/routes/shopify.routes.js`) — pero eso solo
  funciona **después** de que la extensión exista en Shopify, por eso el orden de
  los pasos de abajo importa.
- `shopify-pixel/src/index.js` (en esta misma carpeta) tiene el código del pixel
  ya escrito y lista para pegar.

## Requisitos

- Acceso a la cuenta de **Shopify Partners** donde está registrada la app de
  PROFITCOD (la que tiene el Client ID guardado en `SHOPIFY_API_KEY`).
- Node.js instalado en tu máquina (o usar esta misma terminal).

## Pasos

Desde la raíz del proyecto (`PROFIT-COD/`):

### 1. Vincular la CLI a la app existente

```
npx @shopify/cli@latest app config link
```

Te pedirá iniciar sesión en el navegador y elegir la organización y la app
(la misma que ya usas para conectar tiendas). Esto crea un archivo
`shopify.app.toml` en la raíz — no lo edites a mano.

### 2. Generar la extensión de tipo "Web Pixel"

```
npx @shopify/cli@latest app generate extension
```

Elige el tipo **Web Pixel** y ponle de nombre `carritos-activos`. Esto crea
una carpeta `extensions/carritos-activos/` con:
- `shopify.extension.toml`
- `src/index.js`
- `package.json`

### 3. Pegar el código del pixel

Reemplaza el contenido de `extensions/carritos-activos/src/index.js` (el que
generó la CLI) por el de **`shopify-pixel/src/index.js`** (el de esta carpeta).

### 4. Agregar el campo `shopDomain` a la configuración

Abre `extensions/carritos-activos/shopify.extension.toml` y agrega, dentro de
`[extensions.settings]`, un bloque de campo como este (si ya trae un campo de
ejemplo tipo `accountID`, bórralo y deja solo este):

```toml
[extensions.settings]
  [[extensions.settings.fields]]
  key = "shopDomain"
  type = "single_line_text_field"
  name = "Shop domain"
  description = "Dominio myshopify.com de la tienda (lo rellena PROFITCOD automáticamente)"
```

### 5. Desplegar

```
npx @shopify/cli@latest app deploy
```

Te va a preguntar si quieres **publicar/activar** ("release") esta versión —
di que sí. Si no lo hace automáticamente, publícala desde el Partner
Dashboard (Apps → tu app → Versions).

### 6. Reconectar tus tiendas en PROFITCOD

Ahora sí: entra a PROFITCOD → Integraciones, y **reconecta cada tienda
Shopify** (botón de conectar de nuevo). Como la app ahora pide permisos
nuevos, Shopify te va a mostrar la pantalla de autorización otra vez — acepta.
Esto dispara automáticamente la activación del pixel en esa tienda.

### 7. Verificar

- En Shopify Admin de la tienda → **Configuración → Eventos de cliente**
  ("Customer events") debería aparecer tu app como un pixel conectado.
- Abre el storefront en una ventana de incógnito, mira un producto o agrégalo
  al carrito.
- En PROFITCOD → Carritos Activos, espera unos 20 segundos (se actualiza
  solo) y deberías ver el número subir.

## Notas

- Si reconectaste una tienda **antes** de completar el paso 5 (desplegar), la
  activación del pixel habrá fallado en silencio (no rompe nada, solo no
  quedó activado). Simplemente reconecta esa tienda otra vez después del
  paso 5.
- Esto solo funciona para tiendas conectadas con el botón normal de "Conectar
  tienda" (OAuth). Las conectadas pegando un access token manual con
  credenciales propias del cliente (flujo "extraer token") no pueden usar
  esta extensión, porque el pixel pertenece a la app de PROFITCOD, no a la
  del cliente.
