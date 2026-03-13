const API_BASE = "https://profit-cod.onrender.com";

console.log("🟢 app.js cargado");
// public/js/app.js
(() => {

// ❌ NO ejecutar app.js en login
if (location.pathname.includes("login")) {
  console.log("⛔ app.js ignorado en login");
  return;
}

  // 🔐 TOKEN GLOBAL (ADMIN / IMPERSONACIÓN)
  const params = new URLSearchParams(window.location.search);

  const token =
    params.get("impersonated") === "1"
      ? localStorage.getItem("impersonated_token")
      : localStorage.getItem("token");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  fetch(`${API_BASE}/api/auth/me`, {
  headers: {
    Authorization: "Bearer " + token,
  },
})
    .then((res) => {
      if (!res.ok) throw new Error("No autorizado");
      return res.json();
    })
    .then((data) => {
      currentUser = {
        id: data.user.id,
        name: data.user.email,
        role: data.user.role === "admin" ? "Administrador" : "Cliente",
      };

      // 🎨 CLASE DE ROL EN EL BODY (ADMIN / CLIENTE)
      document.body.classList.remove("role-admin", "role-client");
      document.body.classList.add(
        data.user.role === "admin" ? "role-admin" : "role-client"
      );

      // 🚀 Cargar app UNA sola vez
      loadApp(localStorage.getItem("section") || "metricas");
    })
    .catch(() => {
      localStorage.removeItem("token");
      window.location.href = "/login.html";
    });

  // ⬇️ EXPONEMOS currentUser PARA EL RESTO DEL ARCHIVO
  window.getCurrentUser = () => currentUser;

})();

// 🧱 CONTENEDOR PRINCIPAL (OBLIGATORIO)

let currentUser = {};
const appEl = document.getElementById("app");
let gastosExtras = {};

if (!appEl) {
  console.error("❌ No existe <div id='app'> en index.html");
} else {
  console.log("✅ appEl encontrado");
}

/* =========================
   ICONS
   ========================= */

const icons = {
  metricas: `
    <svg viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  `,
  tiendas: `
    <svg viewBox="0 0 24 24">
      <path d="M3 9l1-4h16l1 4"/>
      <path d="M5 9v10h14V9"/>
      <path d="M9 19v-6h6v6"/>
    </svg>
  `,
  productos: `
    <svg viewBox="0 0 24 24">
      <path d="M3 7l9 5 9-5"/>
      <path d="M3 7v10l9 5 9-5V7"/>
    </svg>
  `,
  pedidos: `
    <svg viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <path d="M8 9h8M8 13h6"/>
    </svg>
  `,
  facturas: `
    <svg viewBox="0 0 24 24">
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/>
      <path d="M9 7h6M9 11h6"/>
    </svg>
  `,
  informes: `
    <svg viewBox="0 0 24 24">
      <path d="M4 20V4h16"/>
      <path d="M8 16v-4M12 16v-7M16 16v-10"/>
    </svg>
  `,
  ayuda: `
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 8a3 3 0 0 1 3 3c0 2-3 2-3 4"/>
      <circle cx="12" cy="17" r="1"/>
    </svg>
  `,
  plan: `
    <svg viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="14" rx="2"/>
      <path d="M3 10h18"/>
    </svg>
  `
};

/* =========================
   I18N
   ========================= */

const I18N = {
  ES: {
    labels: {
      metricas: "Métricas",
      tiendas: "Tiendas",
      productos: "Productos",
      pedidos: "Pedidos",
      facturas: "Facturas",
      informes: "Informes",
      ayuda: "Centro de ayuda",
      plan: "Plan de facturación",
    },
    ui: {
      panel: "Panel",
      sectionPrefix: "Sección: ",
      searchPH: "Buscar pedidos, facturas, tiendas...",
      night: "Modo nocturno",
      langTitle: "Idioma",
      notiTitle: "Notificaciones",
      clearNoti: "Limpiar notificaciones",
      accountTitle: "Cuenta",
      profile: "Perfil",
      settings: "Ajustes",
      theme: "Cambiar tema",
      logout: "Cerrar sesión",
      previewTitle: "Vista previa",
      previewText: "Aquí irá el contenido real de la sección (tablas, métricas, pedidos, etc.).",
      notFound: "Valor no encontrado",
      modalTitle: "Personaliza tu logo",
      modalDesc: "Configura cómo se verá tu logo en modo claro y modo oscuro.",
      modalLight: "Tu logo – Modo claro",
      modalDark: "Tu logo – Modo oscuro",
      modalSave: "Guardar",
      modalCancel: "Cancelar",
    },
    notifications: [
      { title: "Pedido sincronizado", text: "Se importó 1 pedido nuevo de Shopify." },
      { title: "MRW actualizado", text: "2 envíos cambiaron de estado." },
      { title: "Factura pendiente", text: "Tienes 1 factura por revisar." },
    ],
  },

  EN: {
    labels: {
      metricas: "Metrics",
      tiendas: "Stores",
      productos: "Products",
      pedidos: "Orders",
      facturas: "Invoices",
      informes: "Reports",
      ayuda: "Help center",
      plan: "Billing plan",
    },
    ui: {
      panel: "Dashboard",
      sectionPrefix: "Section: ",
      searchPH: "Search orders, invoices, stores...",
      night: "Night mode",
      langTitle: "Language",
      notiTitle: "Notifications",
      clearNoti: "Clear notifications",
      accountTitle: "Account",
      profile: "Profile",
      settings: "Settings",
      theme: "Change theme",
      logout: "Log out",
      previewTitle: "Preview",
      previewText: "Here will be the real section content (tables, metrics, orders, etc.).",
      notFound: "Value not found",
      modalTitle: "Customize your logo",
      modalDesc: "Set how your logo looks in light mode and dark mode.",
      modalLight: "Your logo – Light mode",
      modalDark: "Your logo – Dark mode",
      modalSave: "Save",
      modalCancel: "Cancel",
    },
    notifications: [
      { title: "Order synced", text: "1 new Shopify order was imported." },
      { title: "MRW updated", text: "2 shipments changed status." },
      { title: "Pending invoice", text: "You have 1 invoice to review." },
    ],
  },

  PT: {
    labels: {
      metricas: "Métricas",
      tiendas: "Lojas",
      productos: "Produtos",
      pedidos: "Pedidos",
      facturas: "Faturas",
      informes: "Relatórios",
      ayuda: "Central de ajuda",
      plan: "Plano de faturação",
    },
    ui: {
      panel: "Painel",
      sectionPrefix: "Seção: ",
      searchPH: "Buscar pedidos, faturas, lojas...",
      night: "Modo noturno",
      langTitle: "Idioma",
      notiTitle: "Notificações",
      clearNoti: "Limpar notificações",
      accountTitle: "Conta",
      profile: "Perfil",
      settings: "Definições",
      theme: "Mudar tema",
      logout: "Terminar sessão",
      previewTitle: "Pré-visualização",
      previewText: "Aqui irá o conteúdo real da seção (tabelas, métricas, pedidos, etc.).",
      notFound: "Valor não encontrado",
      modalTitle: "Personaliza o teu logótipo",
      modalDesc: "Define como o teu logótipo aparece no modo claro e no modo escuro.",
      modalLight: "O teu logótipo – Modo claro",
      modalDark: "O teu logótipo – Modo escuro",
      modalSave: "Guardar",
      modalCancel: "Cancelar",
    },
    notifications: [
      { title: "Pedido sincronizado", text: "Foi importado 1 novo pedido do Shopify." },
      { title: "MRW atualizado", text: "2 envios mudaram de estado." },
      { title: "Fatura pendente", text: "Tens 1 fatura por rever." },
    ],
  },

  IT: {
    labels: {
      metricas: "Metriche",
      tiendas: "Negozi",
      productos: "Prodotti",
      pedidos: "Ordini",
      facturas: "Fatture",
      informes: "Report",
      ayuda: "Centro assistenza",
      plan: "Piano di fatturazione",
    },
    ui: {
      panel: "Pannello",
      sectionPrefix: "Sezione: ",
      searchPH: "Cerca ordini, fatture, negozi...",
      night: "Modalità notte",
      langTitle: "Lingua",
      notiTitle: "Notifiche",
      clearNoti: "Cancella notifiche",
      accountTitle: "Account",
      profile: "Profilo",
      settings: "Impostazioni",
      theme: "Cambia tema",
      logout: "Disconnetti",
      previewTitle: "Anteprima",
      previewText: "Qui apparirà il contenuto reale della sezione (tabelle, metriche, ordini, ecc.).",
      notFound: "Valore non trovato",
      modalTitle: "Personalizza il tuo logo",
      modalDesc: "Imposta come apparirà il logo in modalità chiara e scura.",
      modalLight: "Il tuo logo – Modalità chiara",
      modalDark: "Il tuo logo – Modalità scura",
      modalSave: "Salva",
      modalCancel: "Annulla",
    },
    notifications: [
      { title: "Ordine sincronizzato", text: "È stato importato 1 nuovo ordine da Shopify." },
      { title: "MRW aggiornato", text: "2 spedizioni hanno cambiato stato." },
      { title: "Fattura in sospeso", text: "Hai 1 fattura da controllare." },
    ],
  },
};

function getLang() {
  return localStorage.getItem("lang") || "ES";
}

function dict() {
  return I18N[getLang()] || I18N.ES;
}

const languages = [
  { code: "ES", name: "Español" },
  { code: "EN", name: "English" },
  { code: "PT", name: "Português" },
  { code: "IT", name: "Italiano" },
];

// THEME
const theme = localStorage.getItem("theme") || "light";
if (theme === "dark") document.body.classList.add("dark");

// SEARCH DATA
const searchIndex = [
  { label: "Pedido #10231", section: "pedidos" },
  { label: "Pedido #10232", section: "pedidos" },
  { label: "Factura F-7781", section: "facturas" },
  { label: "Factura F-7782", section: "facturas" },
  { label: "Tienda NovacTienda", section: "tiendas" },
  { label: "Producto Zapatillas Urban", section: "productos" },
  { label: "Informe Enero", section: "informes" },
];

// Helpers
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(str) {
  return String(str || "")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

 /* =========================
     NOTIFICATIONS (LA CLAVE)
     - Se eliminan UNA A UNA al abrir
     ========================= */
  function getNotifications(d) {
    let list = null;
    try {
      list = JSON.parse(localStorage.getItem("notifications") || "null");
    } catch (e) {
      list = null;
    }
    if (!Array.isArray(list)) {
      list = (d.notifications || []).map((n, idx) => ({
        id: `${Date.now()}_${idx}`,
        title: n.title,
        text: n.text,
      }));
      localStorage.setItem("notifications", JSON.stringify(list));
    }
    return list;
  }

  function setNotifications(list) {
    localStorage.setItem("notifications", JSON.stringify(list || []));
  }

  function renderNotifPanel(panelEl, list, d) {
    if (!panelEl) return;
    panelEl.innerHTML = `
      <div class="dropdown-title">${d.ui.notiTitle}</div>
      ${
        list.length
          ? list
              .map(
                (n, i) => `
                <div class="notif-row" onclick="openNotif(event, '${escapeAttr(n.id)}')" style="cursor:pointer;">
                  <strong>${escapeHtml(n.title)}</strong>
                  <span>${escapeHtml(n.text)}</span>
                </div>`
              )
              .join("")
          : `<div class="notif-row"><strong>OK</strong><span>No hay notificaciones</span></div>`
      }
      <div class="drop-item" onclick="clearNotif()" style="justify-content:center;">
        ${d.ui.clearNoti}
      </div>
    `;
  }

  function updateNotifBadge(count) {
    const badge = document.querySelector(".notify-badge");
    if (badge) badge.textContent = String(count || 0);
  }
function menuItem(id, labels) {
  return `<div class="menu-item" data-id="${id}">
    ${icons[id] || ""}${labels[id] || id}
  </div>`;
}
function loadApp(section) {

  const d = dict();
  const labels = d.labels;

  const savedLang = localStorage.getItem("lang") || "ES";

  const logoLight = localStorage.getItem("logo_light");
  const logoDark = localStorage.getItem("logo_dark");
  const logo = document.body.classList.contains("dark")
    ? (logoDark || logoLight)
    : logoLight;

  const notiList = getNotifications(d);

  appEl.innerHTML = `
  <div class="layout">
    <div class="sidebar" id="sidebar">
      <div class="logo-zone">
        <div class="logo-wrapper">
          ${
            logo
              ? `<img src="${logo}"><div class="edit-logo" onclick="openLogoModal()">✎</div>`
              : `<div class="logo-placeholder" onclick="openLogoModal()">LOGO</div>`
          }
        </div>
      </div>

      ${menuItem("metricas", labels)}
      ${menuItem("tiendas", labels)}
      ${menuItem("productos", labels)}
      ${menuItem("pedidos", labels)}
      ${menuItem("facturas", labels)}
      ${menuItem("informes", labels)}
      ${menuItem("ayuda", labels)}

      ${
        currentUser.role === "Administrador"
          ? `
            <div class="divider"></div>

            <div class="menu-item" data-id="crear-cliente">
              ➕ Crear cliente
            </div>

            <div class="menu-item" data-id="gestion-clientes">
              👥 Gestión de clientes
            </div>
          `
          : ""
      }

      <div class="divider"></div>

      ${menuItem("plan", labels)}

      <div class="spacer"></div>

      <div class="toggle">
        <span>${d.ui.night}</span>
        <div class="switch" onclick="toggleTheme()"></div>
      </div>
    </div>

        <div class="main">
          <div class="topbar">

            <div class="topbar-left">
              <button class="icon-btn" onclick="toggleSidebar()" title="Menú">
                <svg viewBox="0 0 24 24">
                  <path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>
                </svg>
              </button>

              <div class="breadcrumbs">
                <span id="panelLabel">${d.ui.panel}</span>
                <span>›</span>
                <strong id="crumb"></strong>
              </div>
            </div>

            <div class="topbar-center">
              <div class="search">
                <svg viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7"></circle>
                  <path d="M20 20l-3.5-3.5"></path>
                </svg>
                <input id="search" placeholder="${d.ui.searchPH}" oninput="doSearch(this.value)" onfocus="doSearch(this.value)" />
                <div class="search-results" id="searchDrop"></div>
              </div>
            </div>

            <div class="topbar-right" style="position:relative;">

              <div class="pill" id="langBtn" onclick="toggleLang()" title="Idioma">${savedLang} ▾</div>
              <div class="dropdown" id="langDrop">
                <div class="dropdown-title">${d.ui.langTitle}</div>
                ${languages
                  .map(
                    (l) =>
                      `<div class="drop-item" onclick="setLang('${l.code}')"><span>${l.name}</span><small>${l.code}</small></div>`
                  )
                  .join("")}
              </div>

              <div class="notify" title="${d.ui.notiTitle}" style="position:relative;">
                <button class="icon-btn" style="border:none;" onclick="toggleNotif()">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </button>

                <span class="notify-badge">${notiList.length}</span>

                <div class="panel" id="notifPanel"></div>
              </div>

              <div class="user" onclick="toggleUser()" style="position:relative;">
                <div class="user-info">
                  <div class="user-name">${escapeHtml(currentUser.name)}</div>
                  <div class="user-role">${escapeHtml(currentUser.role)}</div>
                </div>
                <div class="user-avatar"></div>

                <div class="dropdown" id="userDrop" style="right:0; width:260px;">
                  <div class="dropdown-title">${d.ui.accountTitle}</div>
                  <div class="drop-item" onclick="openUserSection('profile')">${d.ui.profile}</div>
                  <div class="drop-item" onclick="openUserSection('settings')">${d.ui.settings}</div>
                  <div class="drop-item" onclick="toggleTheme()">${d.ui.theme}</div>
                  <div class="drop-item" onclick="logout()">${d.ui.logout}</div>
                </div>
              </div>

            </div>
          </div>

          <div class="content">
            <h2 id="title"></h2>
            <div class="muted" id="subtitle"></div>

            <div class="card" id="cardBox">
              <div style="font-weight:600; margin-bottom:6px;" id="previewTitle">${d.ui.previewTitle}</div>
              <div class="muted" id="previewText">${d.ui.previewText}</div>
            </div>
          </div>

        </div>
      </div>
    `;

    // Render panel notifs
    const panel = document.getElementById("notifPanel");
    renderNotifPanel(panel, notiList, d);
    updateNotifBadge(notiList.length);

    document.querySelectorAll(".menu-item").forEach((el) => {
      el.onclick = () => {
        setSection(el.dataset.id);
      };
    });

    document.querySelectorAll(".menu-subitem").forEach((el) => {
      el.onclick = () => setSection(el.dataset.id);
    });

    setSection(section);
    ensureOutsideClose();
}

function setSection(id) {
  const d = dict();
  localStorage.setItem("section", id);

  document.querySelectorAll(".menu-item").forEach((i) => i.classList.remove("active"));
  const activeEl = document.querySelector('.menu-item[data-id="' + id + '"]');
  if (activeEl) activeEl.classList.add("active");

  const t = document.getElementById("title");
  const s = document.getElementById("subtitle");
  const c = document.getElementById("crumb");
  const box = document.getElementById("cardBox");

  // Título normal (por defecto)
  const title = d.labels[id] || id;
  if (t) t.textContent = title;
  if (s) s.textContent = d.ui.sectionPrefix + title;
  if (c) c.textContent = title;

// =========================
// SECCIÓN MÉTRICAS
// =========================
if (id === "metricas") {
  if (t) t.textContent = "Métricas";
  if (s) s.textContent = "Estadísticas generales";
  if (c) c.textContent = "Métricas";

const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = d => d.toISOString().split("T")[0];

  if (box) {
    box.className = "card metricas-box";
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <h3 style="margin:0;font-size:15px;font-weight:600;">Estadísticas</h3>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <input type="date" id="metrics-date-from" value="${fmt(firstDay)}"
            style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;color:var(--text);background:var(--card);"/>
          <span style="color:#6b7280;font-size:13px;">—</span>
          <input type="date" id="metrics-date-to" value="${fmt(now)}"
            style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;color:var(--text);background:var(--card);"/>
          <select id="metrics-shop"
            style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
            <option value="">Todas las tiendas</option>
          </select>
          <button onclick="aplicarFiltroMetricas()"
            style="padding:7px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .2s;"
            onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            Filtrar
          </button>
        </div>
      </div>

      <div class="stats-grid" id="statsGrid">

        <div class="stat-card" style="flex-direction:column;align-items:flex-start;gap:6px;justify-content:center;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="stat-icon blue">
              <svg viewBox="0 0 24 24"><path d="M3 7l9 5 9-5M3 7v10l9 5 9-5V7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-num" id="stat-total">0</span>
              <span class="stat-label">Total Pedidos</span>
            </div>
          </div>
          <div style="border-top:1px solid #e5e7eb;padding-top:6px;width:100%;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:12px;color:#6b7280;">Enviados <span style="font-size:10px;color:#9ca3af;">(excl. pendientes y cancelados)</span></span>
            <span style="font-size:14px;font-weight:700;color:#16a34a;" id="stat-enviados">0</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon blue">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-pendientes">0</span>
            <span class="stat-label">Pend. preparación</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon blue">
            <svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-transito">0</span>
            <span class="stat-label">En tránsito</span>
          </div>
        </div>

        <div class="stat-card" style="flex-direction:column;align-items:flex-start;gap:8px;">
          <div class="stat-label" style="font-weight:600;">Tasa de entrega</div>
          <div style="display:flex;align-items:center;gap:16px;width:100%;">
            <div style="position:relative;width:80px;height:80px;flex-shrink:0;">
              <svg viewBox="0 0 36 36" style="transform:rotate(-90deg);width:80px;height:80px;">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" stroke-width="3.5"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#16a34a" stroke-width="3.5"
                  stroke-dasharray="0 100" id="donut-entregado" stroke-linecap="butt"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#dc2626" stroke-width="3.5"
                  stroke-dasharray="0 100" id="donut-rojo" stroke-linecap="butt"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" stroke-width="3.5"
                  stroke-dasharray="0 100" id="donut-pendiente" stroke-linecap="butt"/>
              </svg>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;" id="donut-pct">0%</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;font-size:12px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="width:10px;height:10px;border-radius:50%;background:#16a34a;display:inline-block;flex-shrink:0;"></span>
                <span id="legend-entregado">Entregado 0%</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="width:10px;height:10px;border-radius:50%;background:#dc2626;display:inline-block;flex-shrink:0;"></span>
                <span id="legend-rojo">Dev+Dest 0%</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;display:inline-block;flex-shrink:0;"></span>
                <span id="legend-pendiente">Pendiente 0%</span>
              </div>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#16a34a;">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-entregados">0</span>
            <span class="stat-label">Entregados</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#dc2626;">
            <svg viewBox="0 0 24 24"><path d="M1 4v6h6M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-devueltos">0</span>
            <span class="stat-label">Devueltos</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#7c3aed;">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-destruidos">0</span>
            <span class="stat-label">Destruidos</span>
          </div>
        </div>

      </div>
    `;
  }

function aplicarFiltroMetricas() {
  const from = document.getElementById("metrics-date-from")?.value;
  const to   = document.getElementById("metrics-date-to")?.value;

  if (from && to && from > to) {
    alert("❌ La fecha de inicio no puede ser mayor que la fecha de fin");
    return;
  }

  loadMetricas();
}
window.aplicarFiltroMetricas = aplicarFiltroMetricas;

  loadMetricas();

// Cargar tiendas en el selector de métricas
  fetch(`${API_BASE}/api/shopify/stores`, {
    headers: { Authorization: "Bearer " + localStorage.getItem("token") }
  }).then(r => r.json()).then(stores => {
    const sel = document.getElementById("metrics-shop");
    if (sel && Array.isArray(stores)) {
      stores.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.domain;
        opt.textContent = s.shop_name || s.domain;
        sel.appendChild(opt);
      });
    }
  }).catch(() => {});
  closeAllDrops();
  closeSearchDrop();
  return;
}

// =========================
// SECCIONES ADMIN (CUSTOM)
// =========================

if (id === "crear-cliente") {

  if (t) t.textContent = "Crear cliente";
  if (s) s.textContent = "Alta de nuevo cliente";
  if (c) c.textContent = "Crear cliente";

  box.className = "card";
  if (box) box.innerHTML = `
    <form class="client-form" id="createClientForm">
      <div class="form-grid">
        <div class="form-group">
          <label>Email</label>
          <input id="clientEmail" type="email" placeholder="cliente@email.com" required>
        </div>

        <div class="form-group">
          <label>Contraseña</label>
          <input id="clientPassword" type="password" placeholder="••••••••" required>
        </div>
      </div>

      <div id="clientMsg" style="margin-top:10px;font-size:13px;"></div>

      <div class="form-actions">
        <button class="btn-primary" type="submit">Crear cliente</button>
      </div>
    </form>
  `;

  const form = document.getElementById("createClientForm");
  const msg = document.getElementById("clientMsg");

  form.onsubmit = async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.style.color = "";

    const email = document.getElementById("clientEmail").value.trim();
    const password = document.getElementById("clientPassword").value.trim();

    try {
      const res = await fetch(`${API_BASE}/api/auth/create-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.style.color = "#dc2626";
        msg.textContent = data.error || "Error al crear cliente";
        return;
      }

      msg.style.color = "#16a34a";
      msg.textContent = "Cliente creado correctamente";
      form.reset();

    } catch {
      msg.style.color = "#dc2626";
      msg.textContent = "Error de conexión";
    }
  };

  closeAllDrops();
  closeSearchDrop();
  return;
}


if (id === "gestion-clientes") {

  if (t) t.textContent = "Gestión de clientes";
  if (s) s.textContent = "Listado de usuarios";
  if (c) c.textContent = "Gestión de clientes";
  box.className = "card";
  if (box) {
    box.innerHTML = `
      <div class="client-table">

        <div class="client-row client-head">
          <div>Email</div>
          <div>Contraseña</div>
          <div>Rol</div>
          <div>Ver</div>
          <div>Editar</div>
          <div>Estado</div>
        </div>

        <div id="usersTable"></div>

      </div>
    `;

    const table = document.getElementById("usersTable");

    fetch(`${API_BASE}/api/users`, {
      headers: {
        "Authorization": "Bearer " + localStorage.getItem("token")
      }
    })
      .then(res => res.json())
      .then(users => {

        if (!Array.isArray(users)) {
          table.innerHTML = `
            <div style="padding:10px;color:#dc2626;">
              Error cargando usuarios
            </div>
          `;
          return;
        }

        table.innerHTML = users.map(u => `
          <div class="client-row">

            <div>${u.email}</div>

            <div class="password-cell">
              <span>••••••••</span>
              <button
                class="reset-icon"
                onclick="resetPassword('${u.id}')"
                title="Generar nueva contraseña"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
                  <path d="M21 3v6h-6"/>
                </svg>
              </button>
            </div>

            <div>${u.role === "admin" ? "Administrador" : "Cliente"}</div>

            <div class="view-eye" onclick="viewClient('${u.id}')">
              <svg viewBox="0 0 24 24">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>

            <div>
              <button class="btn-edit">Editar</button>
            </div>

            <div>
              <label class="user-switch">
                <input type="checkbox" checked>
                <span class="user-slider"></span>
              </label>
            </div>

          </div>
        `).join("");
      })
      .catch(() => {
        table.innerHTML = `
          <div style="padding:10px;color:#dc2626;">
            Error de conexión
          </div>
        `;
      });
  }

  closeAllDrops();
  closeSearchDrop();
  return;

  }
// =========================
// SECCIÓN TIENDAS
// =========================
if (id === "tiendas") {
  if (t) t.textContent = "Tiendas";
  if (s) s.textContent = "Gestiona tus tiendas conectadas";
  if (c) c.textContent = "Tiendas";

  box.className = "card";  
  if (box) {
    box.innerHTML = `
      <div style="display:flex; justify-content:flex-end; margin-bottom:20px;">
        <button class="btn-primary" onclick="openShopifyConnect()">
          + Conectar tienda Shopify
        </button>
      </div>

      <div id="storesGrid" class="stores-grid"></div>
    `;
  }

  fetchStores();

  closeAllDrops();
  closeSearchDrop();
  return;
}

// =========================
// SECCIÓN PEDIDOS
// =========================
if (id === "pedidos") {

  if (t) t.textContent = "Pedidos";
  if (s) s.textContent = "Gestión de pedidos";
  if (c) c.textContent = "Pedidos";

  box.innerHTML = `
      <div class="orders-header">

       <div class="filters">
          <!-- FILA ÚNICA: Filtros izquierda | Acciones derecha -->
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:10px;width:100%;">

            <!-- IZQUIERDA: filtros -->
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <input type="date" id="filter-date-from" value=""
                onchange="applyFilters()"
                style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;color:var(--text);background:var(--card);"/>
              <span style="color:#6b7280;font-size:13px;">—</span>
              <input type="date" id="filter-date-to" value=""
                onchange="applyFilters()"
                style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;color:var(--text);background:var(--card);"/>
              <select id="filter-shop-inline"
                onchange="applyFilters()"
                style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
                <option value="">Todas las tiendas</option>
              </select>
              <select id="filter-status"
                onchange="applyFilters()"
                style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="entregado">Entregado</option>
                <option value="en_transito">En tránsito</option>
                <option value="devuelto">Devuelto</option>
                <option value="destruido">Destruido</option>
                <option value="franquicia">Franquicia</option>
                <option value="cancelado">Cancelado</option>
              </select>
              <button onclick="clearFiltersInline()" style="padding:7px 14px;background:#fef2f2;border:1px solid #dc2626;border-radius:8px;color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Limpiar</button>
            </div>

            <!-- DERECHA: Sincronizar e Importar -->
            <div style="display:flex;align-items:center;gap:8px;">
              <button class="btn-sync" onclick="syncAndRefreshOrders()">
                <svg viewBox="0 0 24 24"><path d="M1 4v6h6" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Sincronizar
              </button>
              <label style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;background:#16a34a;color:#fff;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                📥 Importar Excel MRW
                <input type="file" accept=".xlsx,.xls" style="display:none;" onchange="syncExcelMRW(this)">
              </label>
            </div>

          </div>
        </div>

        <div class="tabs">

          <span class="tab active" onclick="filterByTab(this, '')">Todos</span>
          <span class="tab" onclick="filterByTab(this, 'pendiente')">Pendiente</span>
          <span class="tab" onclick="filterByTab(this, 'entregado')">Entregado</span>
          <span class="tab" onclick="filterByTab(this, 'en_transito')">En tránsito</span>
          <span class="tab" onclick="filterByTabMulti(this, ['devuelto','destruido'])">Dev/Destruido</span>
          <span class="tab" onclick="filterByTab(this, 'franquicia')">Franquicia</span>
        </div>

        <div id="orders-counter" style="font-size:13px;color:#6b7280;margin-bottom:8px;padding:0 4px;"></div>

        <div class="orders-table">
          <div class="orders-row head" style="display:grid;grid-template-columns:30px 14% 9% 11% 13% 12% 1fr 10%;gap:0;">
            <div>#</div>
            <div>Pedido</div>
            <div>Tipo de pago</div>
            <div>Fecha de creación</div>
            <div>Nº seguimiento</div>
            <div>Estado logístico</div>
            <div>Nombre del cliente</div>
            <div>Costo</div>
          </div>
          <div id="ordersBody">
            <div class="muted" style="padding:16px;">Cargando pedidos...</div>
          </div>
        </div>

        <div id="ordersPagination" style="display:flex;justify-content:center;align-items:center;gap:6px;padding:18px 0 4px;flex-wrap:wrap;"></div>

      </div>
    `;

    // Cargar pedidos reales
    // Cargar pedidos reales
    fetchOrders();
    syncAndRefreshOrders();

    // Cargar tiendas en filtro inline
    fetch(`${API_BASE}/api/shopify/stores`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    }).then(r => r.json()).then(stores => {
      const sel = document.getElementById("filter-shop-inline");
      if (sel && Array.isArray(stores)) {
        stores.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s.domain;
          opt.textContent = s.shop_name || s.domain;
          sel.appendChild(opt);
        });
      }
    }).catch(() => {});

    // Auto-refresh cada 5 minutos
    if (window.__ordersInterval) clearInterval(window.__ordersInterval);
    window.__ordersInterval = setInterval(() => {
      syncAndRefreshOrders();
    }, 5 * 60 * 1000);

  closeAllDrops();
  closeSearchDrop();
  return;
}

// =========================
// SECCIÓN FACTURAS
// =========================
if (id === "facturas") {
  if (t) t.textContent = "Facturas";
  if (s) s.textContent = "Gestión de facturas";
  if (c) c.textContent = "Facturas";
  box.className = "";
  box.removeAttribute("style");
  box.innerHTML = `
    <div id="facturas-wrap">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;">
        ${[
          ["reembolsos","Reembolsos"],
          ["gastos-ads","Gastos Ads"],
          ["gastos-fijos","Gastos Fijos"],
          ["gastos-tienda","Gastos por Tienda"],
          ["nomina","Nómina"]
        ].map(([key, label]) => `
          <button id="tab-btn-${key}" onclick="switchFacturasTab('${key}')"
            style="padding:8px 18px;border-radius:8px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;cursor:pointer;background:#fff;color:#374151;transition:all .15s;">
            ${label}
          </button>
        `).join("")}
      </div>
      <div id="facturas-content"></div>
    </div>
  `;
  switchFacturasTab("reembolsos");
  closeAllDrops();
  closeSearchDrop();
  return;
}




// =========================
// SECCIÓN GASTOS ADS
// =========================
if (id === "gastos-ads") {
  if (t) t.textContent = "Gastos Ads";
  if (s) s.textContent = "Rendimiento publicitario por tienda";
  if (c) c.textContent = "Gastos Ads";

  box.className = "card metricas-box";
  if (box) {
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
        <select id="ads-shop-sel"
          style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          <option value="">Cargando tiendas...</option>
        </select>
        <select id="ads-month-sel"
          style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${Array.from({length:12},(_,i)=>{
            const d = new Date(); d.setMonth(i);
            return `<option value="${i+1}" ${i===new Date().getMonth()?"selected":""}>${d.toLocaleString("es",{month:"long"})}</option>`;
          }).join("")}
        </select>
        <select id="ads-year-sel"
          style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===new Date().getFullYear()?"selected":""}>${y}</option>`).join("")}
        </select>
        <button onclick="loadAdsTable()"
          style="padding:7px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
          Ver
        </button>
      </div>
      <div id="ads-table-wrap" style="overflow-x:auto;margin:0 auto;"></div>
    `;
  }

  // Cargar tiendas
  fetch(`${API_BASE}/api/shopify/stores`, {
    headers: { Authorization: "Bearer " + localStorage.getItem("token") }
  }).then(r=>r.json()).then(stores => {
    const sel = document.getElementById("ads-shop-sel");
    if (!sel || !Array.isArray(stores)) return;
    sel.innerHTML = stores.map(s =>
      `<option value="${s.domain}">${escapeHtml(s.shop_name || s.domain)}</option>`
    ).join("");
    loadAdsTable();
  }).catch(()=>{});

  closeAllDrops();
  closeSearchDrop();
  return;
}

// =========================
// SECCIÓN GASTOS FIJOS
// =========================
// =========================
// SECCIÓN GASTOS FIJOS
// =========================
if (id === "gastos-fijos") {
  if (t) t.textContent = "Gastos Fijos";
  if (s) s.textContent = "Gestión de gastos fijos mensuales";
  if (c) c.textContent = "Gastos Fijos";
  box.className = "";           // ← sin clase card, sin borde extra
  box.removeAttribute("style"); // ← limpia cualquier padding residual
  if (box) {
    box.innerHTML = `<div id="gastos-fijos-wrap">Cargando...</div>`;
  }
  loadGastosFijos();
  closeAllDrops();
  closeSearchDrop();
  return;
}

// =========================
// SECCIÓN GASTOS VARIOS
// =========================
if (id === "gastos-varios") {
  if (t) t.textContent = "Gastos Varios";
  if (s) s.textContent = "Resumen de gastos por tienda";
  if (c) c.textContent = "Gastos Varios";
  box.className = "card";
  if (box) {
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
        <select id="gv-month-sel"
          style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
            .map((m,i)=>`<option value="${i+1}" ${i===new Date().getMonth()?"selected":""}>${m}</option>`).join("")}
        </select>
        <select id="gv-year-sel"
          style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===new Date().getFullYear()?"selected":""}>${y}</option>`).join("")}
        </select>
        <button onclick="loadGastosVarios()"
          style="padding:7px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
          Ver
        </button>
      </div>
      <div id="gv-mes-label" style="margin-bottom:16px;padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#16a34a;font-weight:600;"></div>
      <div id="gv-content"></div>
    `;
  }
  loadGastosVarios();
  closeAllDrops();
  closeSearchDrop();
  return;
}

}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
  loadApp(localStorage.getItem("section") || "metricas");
}

function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  if (!sb) return;

  sb.classList.toggle("hidden");
  closeAllDrops();
  closeSearchDrop();
}

function toggleLang() {
  closeAllDrops("langDrop");
  const d = document.getElementById("langDrop");
  if (d) d.classList.toggle("open");
  closeSearchDrop();
}

function setLang(code) {
  localStorage.setItem("lang", code);
  loadApp(localStorage.getItem("section") || "metricas");
}

// ✅ campana: SOLO abre/cierra
function toggleNotif() {
  closeAllDrops("notifPanel");
  const p = document.getElementById("notifPanel");
  if (p) p.classList.toggle("open");
  closeSearchDrop();
}

// ✅ click en UNA notificación: se elimina de la lista y baja contador
function openNotif(e, id) {
  // 🔒 MUY IMPORTANTE
  e.stopPropagation();

  const d = dict();
  const list = getNotifications(d);
  const next = list.filter(n => n.id !== id);

  setNotifications(next);
  updateNotifBadge(next.length);

  const panel = document.getElementById("notifPanel");
  renderNotifPanel(panel, next, d);
}

function clearNotif() {
  setNotifications([]);
  updateNotifBadge(0);

  const panel = document.getElementById("notifPanel");
  if (panel) {
    const d = dict();
    renderNotifPanel(panel, [], d);
  }

  closeAllDrops();
  closeSearchDrop();
}

function toggleUser() {
  closeAllDrops("userDrop");
  const d = document.getElementById("userDrop");
  if (d) d.classList.toggle("open");
  closeSearchDrop();
}

function closeAllDrops(exceptId) {
  ["langDrop", "notifPanel", "userDrop"].forEach((id) => {
    if (id === exceptId) return;
    const el = document.getElementById(id);
    if (el) el.classList.remove("open");
  });
}

function ensureOutsideClose() {
  if (window.__outsideBound) return;
  window.__outsideBound = true;

  document.addEventListener("click", (e) => {
    const langBtn = document.getElementById("langBtn");
    const langDrop = document.getElementById("langDrop");
    const notifPanel = document.getElementById("notifPanel");
    const userDrop = document.getElementById("userDrop");

    const notifyWrapper = document.querySelector(".notify");
    const userWrapper = document.querySelector(".user");
    const searchWrap = document.querySelector(".search");
    const searchDrop = document.getElementById("searchDrop");

    const inLang =
      (langBtn && langBtn.contains(e.target)) ||
      (langDrop && langDrop.contains(e.target));

    const inNotif =
      (notifyWrapper && notifyWrapper.contains(e.target)) ||
      (notifPanel && notifPanel.contains(e.target));

    const inUser =
      (userWrapper && userWrapper.contains(e.target)) ||
      (userDrop && userDrop.contains(e.target));

    const inSearch =
      (searchWrap && searchWrap.contains(e.target)) ||
      (searchDrop && searchDrop.contains(e.target));

    if (!inLang && !inNotif && !inUser) closeAllDrops();
    if (!inSearch) closeSearchDrop();
  });
}

// SEARCH

function doSearch(value) {
  const d = dict();
  const q = (value || "").trim().toLowerCase();
  const drop = document.getElementById("searchDrop");
  if (!drop) return;

  if (!q) {
    drop.innerHTML = "";
    drop.classList.remove("open");
    return;
  }

  const results = searchIndex
    .filter(it => it.label.toLowerCase().includes(q))
    .slice(0, 12);

  if (results.length === 0) {
    drop.innerHTML = `
      <div class="search-empty">${d.ui.notFound}</div>
    `;
    drop.classList.add("open");
    return;
  }

  drop.innerHTML = results
    .map(r => `
      <div
        class="search-item"
        onclick="goToSearch('${escapeAttr(r.section)}','${escapeAttr(r.label)}')"
      >
        ${escapeHtml(r.label)}
      </div>
    `)
    .join("");

  drop.classList.add("open");
}

function closeSearchDrop() {
  const drop = document.getElementById("searchDrop");
  if (drop) {
    drop.classList.remove("open");
    drop.innerHTML = "";
  }
}

function goToSearch(section, label) {
  setSection(section);

  const box = document.getElementById("cardBox");
  if (box) {
    box.innerHTML = `
      <div style="font-weight:600; margin-bottom:6px;">
        ${escapeHtml(label)}
      </div>
      <div class="muted">OK (demo)</div>
    `;
  }

  closeSearchDrop();
}

 // MODAL LOGO

function openLogoModal() {
  const d = dict();
  const modal = document.createElement("div");
  modal.className = "modal-bg";

  modal.innerHTML = `
    <div class="modal">
      <h3 style="margin:0 0 6px;">${d.ui.modalTitle}</h3>
      <div class="muted" style="margin-bottom:10px;">${d.ui.modalDesc}</div>

      <div class="preview-row">
        <div class="preview-box light" onclick="pick('light')">
          <img id="prevLight" />
          <div class="preview-title">${d.ui.modalLight}</div>
        </div>

        <div class="preview-box dark" onclick="pick('dark')">
          <img id="prevDark" />
          <div class="preview-title">${d.ui.modalDark}</div>
        </div>
      </div>

      <input type="file" id="fileLight" hidden>
      <input type="file" id="fileDark" hidden>

      <button
        class="btn"
        style="background:var(--green); color:#fff;"
        onclick="saveLogos()"
      >
        ${d.ui.modalSave}
      </button>
      <button class="btn btn-secondary" onclick="closeModal()">
        ${d.ui.modalCancel}
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  const f1 = document.getElementById("fileLight");
  const f2 = document.getElementById("fileDark");
  if (f1) f1.onchange = (e) => preview(e, "prevLight");
  if (f2) f2.onchange = (e) => preview(e, "prevDark");

  const savedL = localStorage.getItem("logo_light");
  const savedD = localStorage.getItem("logo_dark");

  const pL = document.getElementById("prevLight");
  const pD = document.getElementById("prevDark");

  if (pL && savedL) {
    pL.src = savedL;
    pL.dataset.value = savedL;
  }

  if (pD && savedD) {
    pD.src = savedD;
    pD.dataset.value = savedD;
  }
}

function pick(mode) {
  const el = document.getElementById(
    mode === "light" ? "fileLight" : "fileDark"
  );
  if (el) el.click();
}

function preview(e, id) {
  const file = e && e.target && e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = document.getElementById(id);
    if (!img) return;
    img.src = ev.target.result;
    img.dataset.value = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function saveLogos() {
  const lightEl = document.getElementById("prevLight");
  const darkEl = document.getElementById("prevDark");

  const light = lightEl ? lightEl.dataset.value : null;
  const dark = darkEl ? darkEl.dataset.value : null;

  if (light) localStorage.setItem("logo_light", light);
  if (dark) localStorage.setItem("logo_dark", dark);

  closeModal();
  loadApp(localStorage.getItem("section") || "metricas");
}

function closeModal() {
  const m = document.querySelector(".modal-bg");
  if (m) m.remove();
}

function switchFacturasTab(key) {
  ["reembolsos","gastos-ads","gastos-fijos","gastos-tienda","nomina"].forEach(k => {
    const btn = document.getElementById("tab-btn-" + k);
    if (!btn) return;
    if (k === key) {
      btn.style.background = "#16a34a";
      btn.style.color = "#fff";
      btn.style.borderColor = "#16a34a";
    } else {
      btn.style.background = "#fff";
      btn.style.color = "#374151";
      btn.style.borderColor = "#e5e7eb";
    }
  });

  const content = document.getElementById("facturas-content");
  if (!content) return;

  if (key === "reembolsos") {
    content.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <input type="date" id="ree-date-from" value="" onchange="renderReembolsos()"
            style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;color:var(--text);background:var(--card);"/>
          <span style="color:#6b7280;font-size:13px;">—</span>
          <input type="date" id="ree-date-to" value="" onchange="renderReembolsos()"
            style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;color:var(--text);background:var(--card);"/>
          <select id="ree-shop" onchange="renderReembolsos()"
            style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
            <option value="">Todas las tiendas</option>
          </select>
          <button onclick="clearReembolsosFilters()" style="padding:7px 14px;background:#fef2f2;border:1px solid #dc2626;border-radius:8px;color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Limpiar</button>
        </div>
      </div>
      <div id="ree-counter" style="font-size:13px;color:#6b7280;margin-bottom:8px;padding:0 4px;"></div>
      <div class="orders-table">
        <div class="orders-row head" style="display:grid;grid-template-columns:40px 16% 14% 1fr 10% 14%;gap:0;">
          <div>#</div>
          <div>Pedido</div>
          <div>Fecha de creación</div>
          <div>Nombre del cliente</div>
          <div>Costo</div>
          <div>Estado del pago</div>
        </div>
        <div id="reeBody"><div class="muted" style="padding:16px;">Cargando...</div></div>
      </div>
      <div id="reePagination" style="display:flex;justify-content:center;align-items:center;gap:6px;padding:18px 0 4px;flex-wrap:wrap;"></div>
    `;
    fetch(`${API_BASE}/api/shopify/stores`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    }).then(r => r.json()).then(stores => {
      const sel = document.getElementById("ree-shop");
      if (sel && Array.isArray(stores)) {
        stores.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s.domain;
          opt.textContent = s.shop_name || s.domain;
          sel.appendChild(opt);
        });
      }
    }).catch(() => {});
    loadReembolsos();
    return;
  }

  if (key === "gastos-ads") {
    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
        <select id="ads-shop-sel" style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          <option value="">Cargando tiendas...</option>
        </select>
        <select id="ads-month-sel" style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${Array.from({length:12},(_,i)=>{const d=new Date();d.setMonth(i);return `<option value="${i+1}" ${i===new Date().getMonth()?"selected":""}>${d.toLocaleString("es",{month:"long"})}</option>`;}).join("")}
        </select>
        <select id="ads-year-sel" style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===new Date().getFullYear()?"selected":""}>${y}</option>`).join("")}
        </select>
        <button onclick="loadAdsTable()" style="padding:7px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Ver</button>
      </div>
      <div id="ads-table-wrap" style="overflow-x:auto;"></div>
    `;
    fetch(`${API_BASE}/api/shopify/stores`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    }).then(r=>r.json()).then(stores => {
      const sel = document.getElementById("ads-shop-sel");
      if (!sel || !Array.isArray(stores)) return;
      sel.innerHTML = stores.map(s=>`<option value="${s.domain}">${escapeHtml(s.shop_name||s.domain)}</option>`).join("");
      loadAdsTable();
    }).catch(()=>{});
    return;
  }

  if (key === "gastos-fijos") {
    content.innerHTML = `<div id="gastos-fijos-wrap">Cargando...</div>`;
    loadGastosFijos();
    return;
  }

  if (key === "gastos-tienda") {
    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
        <select id="gv-month-sel" style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"].map((m,i)=>`<option value="${i+1}" ${i===new Date().getMonth()?"selected":""}>${m}</option>`).join("")}
        </select>
        <select id="gv-year-sel" style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===new Date().getFullYear()?"selected":""}>${y}</option>`).join("")}
        </select>
        <button onclick="loadGastosVarios()" style="padding:7px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Ver</button>
      </div>
      <div id="gv-mes-label" style="margin-bottom:16px;padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#16a34a;font-weight:600;"></div>
      <div id="gv-content"></div>
    `;
    loadGastosVarios();
    return;
  }

  content.innerHTML = `
    <div class="card" style="padding:24px;">
      <div style="font-weight:600;margin-bottom:6px;">${key.charAt(0).toUpperCase()+key.slice(1)}</div>
      <div class="muted">Próximamente</div>
    </div>
  `;
}
window.switchFacturasTab = switchFacturasTab;

// Exponer funciones usadas por onclick
window.loadApp = loadApp;
window.setSection = setSection;
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;
window.toggleLang = toggleLang;
window.setLang = setLang;
window.toggleNotif = toggleNotif;
window.openNotif = openNotif;
window.clearNotif = clearNotif;
window.toggleUser = toggleUser;
window.doSearch = doSearch;
window.goToSearch = goToSearch;
window.openLogoModal = openLogoModal;
window.pick = pick;
window.preview = preview;
window.saveLogos = saveLogos;
window.closeModal = closeModal;

// =========================
// SECCIONES DE USUARIO
// =========================

function openUserSection(type) {
  const box = document.getElementById("cardBox");
  const title = document.getElementById("title");
  const subtitle = document.getElementById("subtitle");
  const crumb = document.getElementById("crumb");

  if (!box) return;

  if (type === "profile") {
    title.textContent = "Perfil";
    subtitle.textContent = "Datos de la cuenta";
    crumb.textContent = "Perfil";

    box.innerHTML = `
      <div style="font-weight:600; margin-bottom:10px;">Perfil de usuario</div>
      <div class="muted">Nombre: ${currentUser.name}</div>
      <div class="muted">Rol: ${currentUser.role}</div>
    `;
  }

  if (type === "settings") {
    title.textContent = "Ajustes";
    subtitle.textContent = "Configuración de la cuenta";
    crumb.textContent = "Ajustes";

    box.innerHTML = `
      <div style="font-weight:600; margin-bottom:10px;">Ajustes</div>
      <div class="muted">Aquí irán las preferencias del usuario</div>
    `;
  }

  closeAllDrops();
}

// =========================
// LOGOUT
// =========================

function logout() {
  localStorage.clear();
  location.reload();
}

// Exponer funciones
window.openUserSection = openUserSection;
window.logout = logout;

// =========================
// RESET PASSWORD (ADMIN)
// =========================

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function resetPassword(userId) {
  // eliminar modal anterior si existe
  const old = document.querySelector(".modal-bg");
  if (old) old.remove();

  // contraseña sugerida
  const password = generatePassword();

  const modal = document.createElement("div");
  modal.className = "modal-bg";

  modal.innerHTML = `
    <div class="modal">
      <h3>Cambiar contraseña</h3>
      <p class="muted">Puedes usar la sugerida o escribir una nueva.</p>

      <input
        id="admin-reset-password"
        type="text"
        value="${password}"
        style="width:100%;margin:10px 0;padding:8px;"
      />

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="confirmReset('${userId}')">
          Guardar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

async function confirmReset(userId) {
  const input = document.getElementById("admin-reset-password");
  const password = input.value.trim();

  if (password.length < 6) {
    alert("La contraseña debe tener al menos 6 caracteres");
    return;
  }

  const res = await fetch(
    `${API_BASE}/api/admin/reset-password/${userId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({ password }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Error al cambiar contraseña");
    return;
  }

  closeModal();
  alert("Contraseña actualizada correctamente");
}

// exponer funciones al HTML
window.resetPassword = resetPassword;
window.confirmReset = confirmReset;

async function viewClient(userId) {
  try {
    const res = await fetch(
      `${API_BASE}/api/admin/impersonate/${userId}`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "No autorizado");
      return;
    }

    // 🔐 Guardamos el token del admin si no existe
    if (!localStorage.getItem("admin_token")) {
      localStorage.setItem("admin_token", localStorage.getItem("token"));
    }

    // 🔐 Guardamos token del cliente
    localStorage.setItem("impersonated_token", data.token);

    // 🌐 Abrir panel del cliente en nueva pestaña
    window.open("/?impersonated=1", "_blank");

  } catch {
    alert("Error de conexión");
  }
}

function closeShopifyStep4() {
  const m4 = document.getElementById("shopifyStep4");
  if (m4) m4.style.display = "none";
}

window.closeShopifyStep4 = closeShopifyStep4;

async function fetchStores() {
  const grid = document.getElementById("storesGrid");
  if (!grid) return;

  grid.innerHTML = "Cargando tiendas…";

  try {
    const res = await fetch(`${API_BASE}/api/shopify/stores`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const stores = await res.json();

    if (!Array.isArray(stores) || stores.length === 0) {
      grid.innerHTML = `
        <div class="muted">
          Aún no tienes tiendas conectadas.
        </div>
      `;
      return;
    }

grid.innerHTML = stores.map(store => `
  <div class="store-card">
    <div class="store-header">
      <div class="shopify-badge">Shopify</div>
      <div class="store-menu" onclick="openStoreMenu(event, ${store.id})">⋮</div>
    </div>

    <div class="store-name-row">
      <div
        class="store-name"
        id="store-name-${store.id}"
        onclick="editStoreName(${store.id})"
        title="Clic para editar nombre"
        style="cursor:pointer; display:flex; align-items:center; gap:6px;"
      >
        ${escapeHtml(store.shop_name || store.domain)}
        <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:#9ca3af;fill:none;stroke-width:2;flex-shrink:0;">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </div>
      <div class="store-domain muted" style="font-size:11px; margin-top:2px;">
        ${escapeHtml(store.domain)}
      </div>
    </div>

    <div class="store-meta">
      <div>
        Estado:
        <span class="status ${store.status === 'active' ? 'active' : 'inactive'}">
          ${store.status === 'active' ? 'Activa' : 'Inactiva'}
        </span>
      </div>
      <div class="sync">
        Última sincronización:<br>
        ${store.last_sync ? new Date(store.last_sync).toLocaleString() : "Nunca"}
      </div>
    </div>

    <div class="store-actions">
      ${store.status === "active"
        ? `<button class="btn-secondary" onclick="disableStore(${store.id})">Deshabilitar</button>`
        : `<button class="btn-primary" onclick="openReactivateModal('${store.domain}', ${store.id})">Habilitar</button>`
      }
    </div>
  </div>
`).join("");

  } catch (e) {
    grid.innerHTML = `
      <div style="color:#dc2626">
        Error cargando tiendas
      </div>
    `;
  }
}

// =========================
// SHOPIFY CONEXIÓN (TOKEN + APP SECRET)
// =========================
async function submitShopifyConnection() {
  const shop = document.getElementById("pf-shop-domain")?.value.trim();
  const accessToken = document.getElementById("pf-access-token")?.value.trim();
  const appSecret = document.getElementById("pf-app-secret")?.value.trim();

  if (!shop || !accessToken || !appSecret) {
    alert("Debes completar dominio, access token y app secret");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/shopify/connect-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({
        shop,
        accessToken,
        appSecret,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error conectando la tienda");
      return;
    }

    alert("✅ Tienda conectada correctamente");

    closeShopifyStep4?.();
    setSection("tiendas");

  } catch (err) {
    alert("Error de conexión con el servidor");
  }
}

function openShopifyConnect() {
  const modal = document.getElementById("shopifyStep4");
  if (modal) modal.style.display = "flex";
}

window.openShopifyConnect = openShopifyConnect;


// 👉 EXPONER A HTML
window.submitShopifyConnection = submitShopifyConnection;


// 👇 ESTA LÍNEA VA FUERA DE LA FUNCIÓN
window.viewClient = viewClient;

async function disableStore(storeId) {
  if (!confirm("¿Seguro que quieres deshabilitar esta tienda?")) return;

  const res = await fetch(
    `${API_BASE}/api/shopify/disable/${storeId}`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    }
  );

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Error deshabilitando tienda");
    return;
  }

  setSection("tiendas");
}

// =========================
// CARGAR MÉTRICAS REALES
// =========================
async function loadMetricas() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = d => d.toISOString().split("T")[0];

  const dateFrom = document.getElementById("metrics-date-from")?.value || fmt(firstDay);
  const dateTo   = document.getElementById("metrics-date-to")?.value   || fmt(now);
  const shop     = document.getElementById("metrics-shop")?.value       || "";

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const orders = await res.json();
    let list = Array.isArray(orders) ? orders : [];

    list = list.filter(o => {
      if (!o.created_at) return true;
      const d = o.created_at.split("T")[0];
      if (dateFrom && d < dateFrom) return false;
      if (dateTo   && d > dateTo)   return false;
      return true;
    });

    if (shop) list = list.filter(o => o.shop_domain === shop);

    const total      = list.length;
    const pendientes = list.filter(o => o.fulfillment_status === "pendiente").length;
    const transito   = list.filter(o => ["en_preparacion","enviado"].includes(o.fulfillment_status)).length;
    const entregados = list.filter(o => o.fulfillment_status === "entregado").length;
    const devueltos  = list.filter(o => o.fulfillment_status === "devuelto").length;
    const destruidos = list.filter(o => o.fulfillment_status === "destruido").length;
    const rojos      = devueltos + destruidos;

    const enviados = list.filter(o => ["enviado","entregado","devuelto","destruido"].includes(o.fulfillment_status)).length;
    const base     = enviados > 0 ? enviados : 1;
    const pctEntregado = Math.round((entregados / base) * 100);
    const pctRojo      = Math.round((rojos      / base) * 100);
    const pctPendiente = Math.round((transito   / base) * 100);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("stat-total",      total);
    set("stat-enviados",   enviados);
    set("stat-pendientes", pendientes);
    set("stat-transito",   transito);
    set("stat-entregados", entregados);
    set("stat-devueltos",  devueltos);
    set("stat-destruidos", destruidos);
    set("donut-pct",       pctEntregado + "%");
    set("legend-entregado", `Entregado ${pctEntregado}%`);
    set("legend-rojo",      `Dev+Dest ${pctRojo}%`);
    set("legend-pendiente", `En tránsito ${pctPendiente}%`);

    // Donut con 3 segmentos (offset acumulado)
    const circumference = 100;
    let offset = 0;

    function setArc(id, pct, off) {
      const el = document.getElementById(id);
      if (!el) return;
      el.setAttribute("stroke-dasharray", `${pct} ${circumference - pct}`);
      el.setAttribute("stroke-dashoffset", -off);
    }

    setArc("donut-entregado", pctEntregado, offset);
    offset += pctEntregado;
    setArc("donut-rojo",      pctRojo,      offset);
    offset += pctRojo;
    setArc("donut-pendiente", pctPendiente, offset);

  } catch(e) {
    console.error("Error cargando métricas:", e);
  }
}
window.loadMetricas = loadMetricas;

// =========================
// GASTOS ADS
// =========================
async function loadAdsTable() {
  const shop  = document.getElementById("ads-shop-sel")?.value;
  const month = document.getElementById("ads-month-sel")?.value;
  const year  = document.getElementById("ads-year-sel")?.value;
  const wrap  = document.getElementById("ads-table-wrap");
  if (!wrap || !shop || !month || !year) return;

  wrap.innerHTML = `<div class="muted" style="padding:16px;">Cargando...</div>`;

  const daysInMonth = new Date(year, month, 0).getDate();
  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const monthName = monthNames[parseInt(month)-1];

  let orders = [];
  try {
    const r = await fetch(`${API_BASE}/api/orders`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const all = await r.json();
    orders = Array.isArray(all) ? all.filter(o => {
      if (!o.created_at) return false;
      if (o.fulfillment_status === "cancelado") return false;
      const d = new Date(o.created_at);
      return o.shop_domain === shop &&
             d.getMonth()+1 === parseInt(month) &&
             d.getFullYear() === parseInt(year);
    }) : [];
  } catch {}

  let spends = {};
  try {
    const r = await fetch(`${API_BASE}/api/ads?shop=${encodeURIComponent(shop)}&month=${month}&year=${year}`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const rows = await r.json();
    if (Array.isArray(rows)) rows.forEach(r => { spends[r.date] = { meta: r.meta||0, tiktok: r.tiktok||0 }; });
  } catch {}

  let totalFact=0, totalMeta=0, totalTiktok=0, totalPedidos=0;

  const rows = Array.from({length: daysInMonth}, (_,i) => {
    const day     = i+1;
    const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const label   = `${day} de ${monthName} de ${year}`;
    const dayOrders = orders.filter(o => o.created_at && o.created_at.startsWith(dateStr));
    const facturacion = dayOrders.reduce((s,o) => s+(parseFloat(o.total_price)||0), 0);
    const pedidos = dayOrders.length;
    const meta    = spends[dateStr]?.meta   || 0;
    const tiktok  = spends[dateStr]?.tiktok || 0;
    const gasto   = meta + tiktok;
    const cpa     = pedidos > 0 ? gasto/pedidos : null;
    const roas    = gasto   > 0 ? facturacion/gasto : null;

    totalFact    += facturacion;
    totalMeta    += meta;
    totalTiktok  += tiktok;
    totalPedidos += pedidos;

    return { day, dateStr, label, facturacion, pedidos, meta, tiktok, gasto, cpa, roas };
  });

  const totalGasto = totalMeta + totalTiktok;
  const totalCPA   = totalPedidos > 0 ? totalGasto/totalPedidos : null;
  const totalROAS  = totalGasto   > 0 ? totalFact/totalGasto    : null;

  const fmt  = n => n != null ? n.toFixed(2)+" €" : "-";
  const fmt2 = n => n != null ? n.toFixed(2) : "-";
  const td   = (content, extra="") => `<td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:15px;${extra}">${content}</td>`;
  const th   = (content, extra="") => `<th style="padding:11px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;font-size:13px;${extra}">${content}</th>`;

  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#f9fafb;">
          ${th("Día","text-align:left;")}
          ${th("Gasto Meta","text-align:right;")}
          ${th("Gasto TikTok","text-align:right;")}
          ${th("Facturación","text-align:right;")}
          ${th("Cantidad Pedidos","text-align:right;")}
          ${th("CPA","text-align:right;")}
          ${th("ROAS","text-align:right;")}
        </tr>
        <tr style="background:#16a34a;">
          <td style="padding:13px 16px;font-weight:700;color:#fff;border:1px solid #15803d;font-size:15px;">Balance del mes</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #15803d;">${fmt(totalMeta)}</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #15803d;">${fmt(totalTiktok)}</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #15803d;">${fmt(totalFact)}</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #15803d;">${totalPedidos}</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #15803d;">${fmt(totalCPA)}</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #15803d;">${fmt2(totalROAS)}</td>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
            ${td(r.label, "color:#374151;white-space:nowrap;")}
            ${td(`<input type="number" min="0" step="0.01" value="${r.meta||""}" placeholder="0.00" data-date="${r.dateStr}" data-shop="${shop}" data-type="meta" onchange="saveAdsSpend(this)" style="width:80px;padding:4px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;text-align:right;font-family:inherit;background:var(--card);color:var(--text);">`, "text-align:right;")}
            ${td(`<input type="number" min="0" step="0.01" value="${r.tiktok||""}" placeholder="0.00" data-date="${r.dateStr}" data-shop="${shop}" data-type="tiktok" onchange="saveAdsSpend(this)" style="width:80px;padding:4px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;text-align:right;font-family:inherit;background:var(--card);color:var(--text);">`, "text-align:right;")}
            ${td(r.facturacion > 0 ? fmt(r.facturacion) : "-", "text-align:right;")}
            ${td(r.pedidos > 0 ? r.pedidos : "-", "text-align:right;")}
            ${td(fmt(r.cpa), "text-align:right;")}
            ${td(fmt2(r.roas), `text-align:right;font-weight:${r.roas!=null&&r.roas>=2?'700':'400'};color:${r.roas!=null&&r.roas>=2?'#16a34a':r.roas!=null&&r.roas<1?'#dc2626':'inherit'};`)}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// =========================
// GASTOS FIJOS
// =========================
async function loadGastosFijos() {
  const wrap = document.getElementById("gastos-fijos-wrap");
  if (!wrap) return;

  const now = new Date();
  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
      <select id="gf-month-sel"
        style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${monthNames.map((m,i)=>`<option value="${i+1}" ${i===now.getMonth()?"selected":""}>${m}</option>`).join("")}
      </select>
      <select id="gf-year-sel"
        style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===now.getFullYear()?"selected":""}>${y}</option>`).join("")}
      </select>
      <button onclick="loadGastosFijosData()"
        style="padding:7px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
        Ver
      </button>
      <button onclick="copiarMesAnteriorGF()"
        style="padding:7px 16px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
        📋 Copiar mes anterior
      </button>
    </div>
    <div id="gf-content"></div>
  `;

  await loadGastosFijosData();
}

async function loadGastosFijosData() {
  const content = document.getElementById("gf-content");
  if (!content) return;

  const month = document.getElementById("gf-month-sel")?.value || (new Date().getMonth()+1);
  const year  = document.getElementById("gf-year-sel")?.value  || new Date().getFullYear();
  const mes   = `${year}-${String(month).padStart(2,"0")}`;

  content.innerHTML = `<div style="padding:16px;color:#6b7280;">Cargando...</div>`;

  let totalPedidos = 0;
  try {
    const r = await fetch(`${API_BASE}/api/orders`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const all = await r.json();
    if (Array.isArray(all)) {
      totalPedidos = all.filter(o => {
        if (!o.created_at) return false;
        if (o.fulfillment_status === "cancelado") return false;
        const d = new Date(o.created_at);
        return d.getMonth()+1 === parseInt(month) && d.getFullYear() === parseInt(year);
      }).length;
    }
  } catch {}

  let items = [];
  try {
    // Asegurar que las filas base existen
    await fetch(`${API_BASE}/api/gastos-fijos/reset`, {
      method: "POST",
      headers: { "Content-Type":"application/json", Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const r = await fetch(`${API_BASE}/api/gastos-fijos?mes=${mes}`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const data = await r.json();
    items = Array.isArray(data) ? data : [];
  } catch {}

  // Si no hay filas base creadas aún, crearlas UNA SOLA VEZ

  if (items.length === 0) {
    const defaults = [
      { nombre: "MRW",       precio_unit: 0, fijo: 1, orden: 0 },
      { nombre: "LOGÍSTICA", precio_unit: 0, fijo: 1, orden: 1 },
      { nombre: "", precio_unit: null, fijo: 0, orden: 2 },
      { nombre: "", precio_unit: null, fijo: 0, orden: 3 },
      { nombre: "", precio_unit: null, fijo: 0, orden: 4 },
    ];
    for (let i = 0; i < defaults.length; i++) {
      try {
        const r = await fetch(`${API_BASE}/api/gastos-fijos`, {
          method: "POST",
          headers: { "Content-Type":"application/json", Authorization:"Bearer "+localStorage.getItem("token") },
          body: JSON.stringify(defaults[i])
        });
        const saved = await r.json();
        if (!saved || !saved.id) continue;
        defaults[i].id = saved.id;
        defaults[i].valor = 0;
      } catch {}
    }
    items = defaults.filter(d => d.id);
  }

  let impuestos = [];
  try {
    const r = await fetch(`${API_BASE}/api/impuestos`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const data = await r.json();
    impuestos = Array.isArray(data) ? data : [];
  } catch {}

  if (impuestos.length === 0) {
    try {
      const r = await fetch(`${API_BASE}/api/impuestos`, {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization:"Bearer "+localStorage.getItem("token") },
        body: JSON.stringify({ nombre:"IVA", porcentaje:21, fijo:1, orden:0 })
      });
      const saved = await r.json();
      impuestos = [{ id: saved.id, nombre:"IVA", porcentaje:21, fijo:1 }];
    } catch {}
  }

  const fmt = n => (parseFloat(n)||0).toFixed(2);
  const inp = `width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:inherit;background:var(--card);color:var(--text);box-sizing:border-box;`;
  const totalValor = items.reduce((s,i) => s+(parseFloat(i.valor)||0), 0);
  const thStyle = `padding:11px 14px;border:1px solid #d1fae5;font-weight:600;color:#fff;text-align:`;

  const tablaGF = `
    <div style="background:var(--card);border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#16a34a;">
            <th style="${thStyle}left;">GASTO FIJO</th>
            <th style="${thStyle}right;">VALOR MES</th>
            <th style="${thStyle}right;">P. UNIT</th>
            <th style="${thStyle}right;">ESTIMADO</th>
            <th style="${thStyle}center;width:36px;"></th>
          </tr>
          <tr style="background:#f0fdf4;">
            <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:700;color:#16a34a;">TOTAL</td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:700;color:#16a34a;text-align:right;">${fmt(totalValor)} €</td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;"></td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:700;color:#16a34a;text-align:right;">— €</td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;"></td>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const esFijo = item.fijo===1||item.fijo===true;
            const estimado = item.precio_unit!=null ? totalPedidos*(parseFloat(item.precio_unit)||0) : null;
            return `
            <tr data-id="${item.id}" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
              <td style="padding:7px 12px;border:1px solid #e5e7eb;">
                ${esFijo
                  ? `<span style="font-weight:600;color:var(--text);">${item.nombre}</span>`
                  : `<input type="text" value="${escapeHtml(item.nombre||'')}" placeholder="Descripción..."
                      data-id="${item.id}" data-field="nombre" onchange="updateGastoFijo(this)"
                      style="${inp}">`
                }
              </td>
              <td style="padding:7px 12px;border:1px solid #e5e7eb;">
                <input type="number" min="0" step="0.01" value="${fmt(item.valor)}"
                  data-id="${item.id}" data-field="valor" data-mes="${mes}"
                  onchange="updateGastoFijoValor(this)"
                  onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();this.style.borderColor='#16a34a';setTimeout(()=>{this.style.borderColor='#e5e7eb'},1500);this.dispatchEvent(new Event('change'));}"
                  style="${inp}text-align:right;">
              </td>
              <td style="padding:7px 12px;border:1px solid #e5e7eb;">
                ${esFijo
                  ? `<input type="number" min="0" step="0.01" value="${fmt(item.precio_unit)}"
                      data-id="${item.id}" data-field="precio_unit" data-mes="${mes}"
                      onchange="updateGastoFijoPrecio(this)"
                      onkeydown="if(event.key==='Enter'){event.preventDefault();this.dispatchEvent(new Event('change'));}"
                      style="${inp}text-align:right;">`
                  : `<span style="color:#d1d5db;display:block;text-align:center;">—</span>`
                }
              </td>
              <td style="padding:7px 12px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">
                ${estimado!=null ? fmt(estimado)+" €" : "—"}
              </td>
              <td style="padding:7px 12px;border:1px solid #e5e7eb;text-align:center;">
                ${!esFijo
                  ? `<button onclick="deleteGastoFijo(${item.id})"
                      style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:15px;font-weight:700;padding:0;">✕</button>`
                  : ""
                }
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      <div style="padding:12px 14px;">
        <button onclick="addGastoFijo()"
          style="padding:7px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
          + Añadir fila
        </button>
      </div>
    </div>
  `;

  const tablaIMP = `
    <div style="background:var(--card);border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#16a34a;">
            <th style="${thStyle}left;">IMPUESTO</th>
            <th style="${thStyle}right;">%</th>
          </tr>
        </thead>
        <tbody>
          ${impuestos.map(imp => `
          <tr onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
            <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;">IVA</td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;">
              <input type="number" min="0" step="0.01" value="${fmt(imp.porcentaje)}"
                data-id="${imp.id}" data-field="porcentaje"
                onchange="updateImpuesto(this)"
                onkeydown="if(event.key==='Enter'){event.preventDefault();this.dispatchEvent(new Event('change'));}"
                style="${inp}text-align:right;">
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;

  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const mesLabel = monthNames[parseInt(month)-1].toUpperCase() + " " + year;

  content.innerHTML = `
    <div style="margin-bottom:16px;padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#16a34a;font-weight:600;">
      📅 Trabajando en: ${mesLabel}
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;align-items:start;">
      <div>${tablaGF}</div>
      <div>${tablaIMP}</div>
    </div>
  `;
}

async function updateGastoFijoValor(input) {
  const id    = input.dataset.id;
  const mes   = input.dataset.mes;
  const valor = parseFloat(input.value)||0;
  try {
    const r = await fetch(`${API_BASE}/api/gastos-fijos/${id}/valor`, {
      method: "PUT",
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+localStorage.getItem("token") },
      body: JSON.stringify({ mes, valor })
    });
    const data = await r.json();
    if (!data.ok) console.error("Error guardando valor:", data);
  } catch(e) { console.error(e); }
}

async function updateGastoFijo(input) {
  const id    = input.dataset.id;
  const field = input.dataset.field;
  const row   = input.closest("tr");
  const nombre     = row.querySelector("[data-field='nombre']")?.value || row.querySelector("span")?.textContent || "";
  const precioUnit = parseFloat(row.querySelector("[data-field='precio_unit']")?.value)||0;
  try {
    await fetch(`${API_BASE}/api/gastos-fijos/${id}`, {
      method: "PUT",
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+localStorage.getItem("token") },
      body: JSON.stringify({ nombre, precio_unit: field==="precio_unit" ? parseFloat(input.value)||0 : precioUnit })
    });
    input.blur();
    input.style.borderColor = "#16a34a";
    setTimeout(() => { input.style.borderColor = "#e5e7eb"; }, 1500);
  } catch(e) { console.error(e); }
}

async function addGastoFijo() {
  try {
    const r = await fetch(`${API_BASE}/api/gastos-fijos`, {
      method: "POST",
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+localStorage.getItem("token") },
      body: JSON.stringify({ nombre:"", precio_unit:null, fijo:0, orden:999 })
    });
    const saved = await r.json();
    if (saved && saved.id) {
      await loadGastosFijosData();
    }
  } catch(e) { console.error(e); }
}

async function deleteGastoFijo(id) {
  try {
    await fetch(`${API_BASE}/api/gastos-fijos/${id}`, {
      method: "DELETE",
      headers: { Authorization:"Bearer "+localStorage.getItem("token") }
    });
    loadGastosFijosData();
  } catch(e) { console.error(e); }
}

async function updateImpuesto(input) {
  const id = input.dataset.id;
  const porcentaje = parseFloat(input.value)||0;
  try {
    await fetch(`${API_BASE}/api/impuestos/${id}`, {
      method: "PUT",
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+localStorage.getItem("token") },
      body: JSON.stringify({ nombre:"IVA", porcentaje })
    });
    input.blur();
    input.style.borderColor = "#16a34a";
    setTimeout(() => { input.style.borderColor = "#e5e7eb"; }, 1500);
  } catch(e) { console.error(e); }
}

window.loadGastosFijos      = loadGastosFijos;
window.loadGastosFijosData  = loadGastosFijosData;
window.updateGastoFijoValor = updateGastoFijoValor;
window.updateGastoFijo      = updateGastoFijo;
window.addGastoFijo         = addGastoFijo;
window.deleteGastoFijo      = deleteGastoFijo;
window.updateImpuesto       = updateImpuesto;

async function updateGastoFijoPrecio(input) {
  const id         = input.dataset.id;
  const mes        = input.dataset.mes;
  const precio_unit = parseFloat(input.value)||0;
  try {
    await fetch(`${API_BASE}/api/gastos-fijos/${id}/precio`, {
      method: "PUT",
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+localStorage.getItem("token") },
      body: JSON.stringify({ mes, precio_unit })
    });
    input.blur();
    input.style.borderColor = "#16a34a";
    setTimeout(() => { input.style.borderColor = "#e5e7eb"; }, 1500);
  } catch(e) { console.error(e); }
}
window.updateGastoFijoPrecio = updateGastoFijoPrecio;

async function saveAdsSpend(input) {
  const date  = input.dataset.date;
  const shop  = input.dataset.shop;
  const type  = input.dataset.type;
  const spend = parseFloat(input.value) || 0;

  try {
    await fetch(`${API_BASE}/api/ads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({ shop, date, type, spend })
    });
    loadAdsTable();
  } catch(e) {
    console.error("Error guardando gasto:", e);
  }
}

window.loadAdsTable  = loadAdsTable;
window.saveAdsSpend  = saveAdsSpend;

// =========================
// GASTOS VARIOS
// =========================
async function loadGastosVarios() {
  const content = document.getElementById("gv-content");
  const label   = document.getElementById("gv-mes-label");
  if (!content) return;

  const month = document.getElementById("gv-month-sel")?.value || (new Date().getMonth()+1);
  const year  = document.getElementById("gv-year-sel")?.value  || new Date().getFullYear();
  const mes   = `${year}-${String(month).padStart(2,"0")}`;

  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  if (label) label.textContent = `📅 Trabajando en: ${monthNames[parseInt(month)-1].toUpperCase()} ${year}`;

  content.innerHTML = `<div style="padding:16px;color:#6b7280;">Cargando...</div>`;

  // 1. Tiendas activas
  let stores = [];
  try {
    const r = await fetch(`${API_BASE}/api/shopify/stores`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const all = await r.json();
    stores = Array.isArray(all) ? all.filter(s => s.active || s.status === "active" || s.is_active) : [];
    if (stores.length === 0) stores = Array.isArray(all) ? all : [];
  } catch {}

  const numTiendas = stores.length || 1;

  // 2. Gastos Ads del mes (Meta y TikTok por tienda)
  let adsSpends = {};
  try {
    for (const store of stores) {
      const r = await fetch(`${API_BASE}/api/ads?shop=${encodeURIComponent(store.domain)}&month=${month}&year=${year}`, {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") }
      });
      const rows = await r.json();
      let meta = 0, tiktok = 0;
      if (Array.isArray(rows)) rows.forEach(r => { meta += r.meta||0; tiktok += r.tiktok||0; });
      adsSpends[store.domain] = { meta, tiktok };
    }
  } catch {}

  // 3. Gastos fijos del mes → dividir entre tiendas activas
  let gastosFijos = [];
  try {
    const r = await fetch(`${API_BASE}/api/gastos-fijos?mes=${mes}`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    gastosFijos = await r.json();
    if (!Array.isArray(gastosFijos)) gastosFijos = [];
  } catch {}

  // Separar MRW/Logística del resto de fijos
  const gastosMRW      = gastosFijos.filter(g => ["MRW","LOGÍSTICA"].includes(g.nombre));
  const gastosOtrosFijos = gastosFijos.filter(g => !["MRW","LOGÍSTICA"].includes(g.nombre));

  const totalMRW       = gastosMRW.reduce((s,g) => s+(parseFloat(g.valor)||0), 0);
  const totalOtrosFijos = gastosOtrosFijos.reduce((s,g) => s+(parseFloat(g.valor)||0), 0);
  const fijoXTienda    = totalOtrosFijos / numTiendas;

  // 4. Gastos varios guardados (Shopify)
  let gastosVarios = {};
  try {
    const r = await fetch(`${API_BASE}/api/gastos-varios?mes=${mes}`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const rows = await r.json();
    if (Array.isArray(rows)) rows.forEach(r => { gastosVarios[r.shop_domain] = r.shopify||0; });
  } catch {}

  const fmt = n => (parseFloat(n)||0).toFixed(2);
  const inp = `padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:inherit;background:var(--card);color:var(--text);width:100%;box-sizing:border-box;text-align:right;`;

  // Construir tabla por tienda
  const cols = stores.map(store => {
    const ads     = adsSpends[store.domain] || { meta: 0, tiktok: 0 };
    const shopify = gastosVarios[store.domain] || 0;
    const mrw       = 0;
    const logistica = 0;
    const extrasTotal = (gastosExtras[store.domain]||[]).reduce((s,g) => s+(parseFloat(g.valor)||0), 0);
    const total = ads.meta + ads.tiktok + shopify + fijoXTienda + mrw + logistica + extrasTotal;

    return `
      <div style="background:var(--card);border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;min-width:220px;flex:1;">
        <div style="background:#16a34a;padding:12px 16px;">
          <div style="font-weight:700;color:#fff;font-size:14px;">${escapeHtml(store.shop_name||store.domain)}</div>
          <div style="font-size:11px;color:#bbf7d0;margin-top:2px;">${store.domain}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tbody>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Gasto Meta</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(ads.meta)} €</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Gasto TikTok</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(ads.tiktok)} €</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Productos</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">0.00 €</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">MRW</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(mrw)} €</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Logística</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(logistica)} €</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Gastos Fijos</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(fijoXTienda)} €
                <div style="font-size:10px;color:#9ca3af;">${fmt(totalOtrosFijos)}€ ÷ ${numTiendas} tiendas</div>
              </td>
            </tr>
            <tr style="background:#eff6ff;">
              <td style="padding:10px 14px;border:1px solid #bfdbfe;font-weight:700;color:#2563eb;">Shopify</td>
              <td style="padding:10px 14px;border:1px solid #bfdbfe;">
                <input type="number" min="0" step="0.01"
                  value="${fmt(shopify)}"
                  data-shop="${store.domain}" data-mes="${mes}"
                  onchange="saveGastoVarioShopify(this)"
                  onkeydown="if(event.key==='Enter'){event.preventDefault();this.dispatchEvent(new Event('change'));}"
                  style="${inp}background:#eff6ff;color:#2563eb;font-weight:600;">
              </td>
            </tr>
            ${(gastosExtras[store.domain]||[]).map((g,idx) => `
            <tr style="background:#eff6ff;">
              <td style="padding:7px 14px;border:1px solid #bfdbfe;">
                <input type="text" value="${escapeHtml(g.nombre||'')}" placeholder="Concepto..."
                  data-shop="${store.domain}" data-idx="${idx}" data-mes="${mes}"
                  onchange="updateGastoExtraNombre(this)"
                  style="border:none;outline:none;background:transparent;width:100%;font-size:13px;color:#2563eb;font-family:inherit;">
              </td>
              <td style="padding:7px 14px;border:1px solid #bfdbfe;">
                <input type="number" min="0" step="0.01" value="${fmt(g.valor||0)}" placeholder="0.00"
                  data-shop="${store.domain}" data-idx="${idx}" data-mes="${mes}"
                  onchange="updateGastoExtraValor(this)"
                  style="${inp}background:#eff6ff;color:#2563eb;font-weight:600;">
              </td>
            </tr>`).join("")}
            <tr style="background:#eff6ff;">
              <td colspan="2" style="padding:6px 14px;border:1px solid #bfdbfe;">
                <button onclick="addGastoExtra('${store.domain}')"
                  style="background:none;border:none;cursor:pointer;color:#2563eb;font-size:12px;font-weight:600;padding:0;font-family:inherit;">
                  + Añadir concepto
                </button>
              </td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td style="padding:11px 14px;border:1px solid #e5e7eb;font-weight:700;color:#16a34a;">TOTAL</td>
              <td style="padding:11px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:700;color:#16a34a;">${fmt(total)} €</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join("");

  content.innerHTML = `
    <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:start;">
      ${cols || `<div style="color:#6b7280;padding:16px;">No hay tiendas activas.</div>`}
    </div>
  `;
}

async function saveGastoVarioShopify(input) {
  const shop    = input.dataset.shop;
  const mes     = input.dataset.mes;
  const shopify = parseFloat(input.value)||0;
  try {
    await fetch(`${API_BASE}/api/gastos-varios/shopify`, {
      method: "PUT",
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+localStorage.getItem("token") },
      body: JSON.stringify({ shop_domain: shop, mes, shopify })
    });
    await loadGastosVarios();
  } catch(e) { console.error(e); }
}

window.loadGastosVarios      = loadGastosVarios;
window.saveGastoVarioShopify = saveGastoVarioShopify;

async function copiarMesAnteriorGF() {
  const month = document.getElementById("gf-month-sel")?.value;
  const year  = document.getElementById("gf-year-sel")?.value;
  const mes   = `${year}-${String(month).padStart(2,"0")}`;

  const prevDate = new Date(parseInt(year), parseInt(month)-2, 1);
  const prevMes  = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,"0")}`;

  try {
    const r = await fetch(`${API_BASE}/api/gastos-fijos?mes=${prevMes}`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const prevItems = await r.json();
    if (!Array.isArray(prevItems)) return;

    for (const prev of prevItems) {
      if ((parseFloat(prev.valor)||0) > 0) {
        await fetch(`${API_BASE}/api/gastos-fijos/${prev.id}/valor`, {
          method: "PUT",
          headers: { "Content-Type":"application/json", Authorization:"Bearer "+localStorage.getItem("token") },
          body: JSON.stringify({ mes, valor: prev.valor })
        });
      }
      if ((parseFloat(prev.precio_unit)||0) > 0) {
        await fetch(`${API_BASE}/api/gastos-fijos/${prev.id}/precio`, {
          method: "PUT",
          headers: { "Content-Type":"application/json", Authorization:"Bearer "+localStorage.getItem("token") },
          body: JSON.stringify({ mes, precio_unit: prev.precio_unit })
        });
      }
    }
    loadGastosFijosData();
  } catch(e) { console.error(e); }
}
window.copiarMesAnteriorGF = copiarMesAnteriorGF;


// =========================
// CARGAR PEDIDOS REALES
// =========================
let allOrders = [];

async function fetchOrders() {
  const body = document.getElementById("ordersBody");
  if (!body) return;

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const orders = await res.json();
    allOrders = Array.isArray(orders) ? orders : [];
    renderOrders(allOrders);

  } catch (e) {
    if (body) body.innerHTML = `<div style="color:#dc2626;padding:16px;">Error cargando pedidos</div>`;
  }
}

let currentOrdersPage = 1;
const ORDERS_PER_PAGE = 20;
let currentDisplayOrders = [];

function renderOrders(orders) {
  currentDisplayOrders = orders;
  currentOrdersPage = 1;
  renderOrdersPage();
}

function renderOrdersPage() {
  const body = document.getElementById("ordersBody");
  const pagination = document.getElementById("ordersPagination");
  if (!body) return;

  if (!currentDisplayOrders.length) {
    body.innerHTML = `<div class="muted" style="padding:16px;">No hay pedidos todavía</div>`;
    if (pagination) pagination.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(currentDisplayOrders.length / ORDERS_PER_PAGE);
  const start = (currentOrdersPage - 1) * ORDERS_PER_PAGE;
  const pageOrders = currentDisplayOrders.slice(start, start + ORDERS_PER_PAGE);

  const counter = document.getElementById("orders-counter");
  if (counter) {
    const total = currentDisplayOrders.length;
    const desde = total === 0 ? 0 : start + 1;
    const hasta = Math.min(start + ORDERS_PER_PAGE, total);
    counter.textContent = `Mostrando ${desde}–${hasta} de ${total} pedidos`;
  }

  body.innerHTML = pageOrders.map((o, idx) => {
    const numero = start + idx + 1;
    let paymentBadge = "-";
    try {
      const raw = o.raw_json ? (typeof o.raw_json === "string" ? JSON.parse(o.raw_json) : o.raw_json) : null;
      const fin = raw?.financial_status || raw?.payment_status || o.financial_status || o.payment_status || "";
      const finLower = fin.toLowerCase().trim();
      if (finLower === "pending" || finLower === "cod" || finLower === "pendiente") {
        paymentBadge = `<span class="status yellow">COD</span>`;
      } else if (finLower === "paid" || finLower === "pagado") {
        paymentBadge = `<span class="status green">Pagado</span>`;
      } else if (finLower === "partially_paid") {
        paymentBadge = `<span class="status blue">Parcial</span>`;
      } else if (finLower === "refunded" || finLower === "voided") {
        paymentBadge = `<span class="status red">Null</span>`;
      } else {
        paymentBadge = `<span style="color:#9ca3af;font-size:12px;">${fin || "-"}</span>`;
      }
    } catch(e) { paymentBadge = "-"; }

    return `
    <div class="orders-row" style="display:grid;grid-template-columns:30px 14% 9% 11% 13% 12% 1fr 10%;gap:0;">
      <div style="color:#9ca3af;font-size:12px;display:flex;align-items:center;overflow:hidden;">${numero}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(o.order_number || "-")}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${paymentBadge}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.created_at ? new Date(o.created_at).toLocaleDateString('es-ES') : "-"}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(o.tracking_number || "-")}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span class="status ${statusClass(o.fulfillment_status)}">${statusLabel(o.fulfillment_status)}</span></div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(o.customer_name || "-")}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.total_price || 0} ${escapeHtml(o.currency || "")}</div>
    </div>`;
  }).join("");

if (pagination) {
    if (totalPages < 1) { pagination.innerHTML = ""; return; }
    const p = currentOrdersPage;
    const delta = 2;
    let pages = "";

    // Botón anterior
    pages += `<button onclick="goToOrdersPage(${Math.max(1, p-1)})"
      style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;
        background:var(--card);color:${p===1?"#d1d5db":"var(--text)"};
        font-size:13px;cursor:pointer;font-family:inherit;"
      ${p===1?"disabled":""}>‹</button>`;

    // Páginas con ventana deslizante
    let startPage = Math.max(1, p - delta);
    let endPage   = Math.min(totalPages, p + delta);
    if (p <= delta) endPage   = Math.min(totalPages, delta * 2 + 1);
    if (p >= totalPages - delta) startPage = Math.max(1, totalPages - delta * 2);

    if (startPage > 1) {
      pages += `<button onclick="goToOrdersPage(1)"
        style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;
          background:var(--card);color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;">1</button>`;
      if (startPage > 2) pages += `<span style="padding:0 4px;color:#9ca3af;line-height:34px;">…</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === p;
      pages += `<button onclick="goToOrdersPage(${i})"
        style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid ${isActive?"#16a34a":"#e5e7eb"};
          background:${isActive?"#16a34a":"var(--card)"};color:${isActive?"#fff":"var(--text)"};
          font-size:13px;font-weight:${isActive?"700":"400"};cursor:pointer;font-family:inherit;">
        ${i}
      </button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages += `<span style="padding:0 4px;color:#9ca3af;line-height:34px;">…</span>`;
      pages += `<button onclick="goToOrdersPage(${totalPages})"
        style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;
          background:var(--card);color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;">${totalPages}</button>`;
    }

    // Botón siguiente
    pages += `<button onclick="goToOrdersPage(${Math.min(totalPages, p+1)})"
      style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;
        background:var(--card);color:${p===totalPages?"#d1d5db":"var(--text)"};
        font-size:13px;cursor:pointer;font-family:inherit;"
      ${p===totalPages?"disabled":""}>›</button>`;

    pagination.innerHTML = pages;
  }
}

function goToOrdersPage(page) {
  currentOrdersPage = page;
  renderOrdersPage();
  const table = document.querySelector(".orders-table");
  if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
}
window.goToOrdersPage = goToOrdersPage;

function filterOrders(value) {
  const q = (value || "").toLowerCase();
  if (!q) return renderOrders(allOrders);
  const filtered = allOrders.filter(o =>
    (o.order_number || "").toLowerCase().includes(q) ||
    (o.customer_name || "").toLowerCase().includes(q)
  );
  renderOrders(filtered);
}

function statusClass(s) {
  const map = {
    pendiente: "yellow",
    en_preparacion: "blue",
    enviado: "green",
    en_transito: "blue",
    entregado: "green",
    devuelto: "orange",
    destruido: "red",
    franquicia: "purple",
    cancelado: "red",
  };
  return map[s] || "yellow";
}

function statusLabel(s) {
  const map = {
    pendiente: "Pendiente",
    en_preparacion: "En preparación",
    enviado: "Enviado",
    en_transito: "En tránsito",
    entregado: "Entregado",
    devuelto: "Devuelto",
    destruido: "Destruido",
    franquicia: "Franquicia",
    cancelado: "Cancelado",
  };
  return map[s] || "Pendiente";
}

window.fetchOrders = fetchOrders;
window.filterOrders = filterOrders;

function editStoreName(storeId) {
  const nameEl = document.getElementById(`store-name-${storeId}`);
  if (!nameEl) return;

  const current = nameEl.firstChild?.textContent?.trim() || "";

  const input = document.createElement("input");
  input.type = "text";
  input.value = current;
  input.maxLength = 10;
  input.style.cssText = `
    font-size:16px; font-weight:700; border:none; border-bottom:2px solid var(--green);
    outline:none; background:transparent; width:120px; color:var(--text);
  `;

  nameEl.innerHTML = "";
  nameEl.appendChild(input);
  input.focus();
  input.select();

  async function save() {
    const newName = input.value.trim().slice(0, 10);
    if (!newName) { fetchStores(); return; }

    try {
      const res = await fetch(`${API_BASE}/api/shopify/rename/${storeId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ name: newName }),
      });

      if (res.ok) fetchStores();
      else fetchStores();
    } catch { fetchStores(); }
  }

  input.addEventListener("blur", save);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { fetchStores(); }
  });
}

window.editStoreName = editStoreName;

window.disableStore = disableStore;

function openStoreMenu(e, storeId) {
  e.stopPropagation();

  // Cerrar menú anterior si existe
  const existing = document.getElementById("store-menu-popup");
  if (existing) existing.remove();

  const btn = e.currentTarget || e.target;
  const rect = btn.getBoundingClientRect();

  const popup = document.createElement("div");
  popup.id = "store-menu-popup";
  popup.style.cssText = `
    position:fixed;
    top:${rect.bottom + 4}px;
    left:${rect.left - 120}px;
    background:#fff;
    border:1px solid #e5e7eb;
    border-radius:10px;
    box-shadow:0 4px 16px rgba(0,0,0,0.12);
    z-index:9999;
    min-width:150px;
    overflow:hidden;
  `;

  popup.innerHTML = `
    <div
      onclick="deleteStore(${storeId})"
      style="padding:12px 16px;cursor:pointer;color:#dc2626;font-size:14px;display:flex;align-items:center;gap:8px;"
      onmouseover="this.style.background='#fef2f2'"
      onmouseout="this.style.background=''"
    >
      🗑️ Eliminar tienda
    </div>
  `;

  document.body.appendChild(popup);

  // Cerrar al hacer clic fuera
  setTimeout(() => {
    document.addEventListener("click", function closeMenu() {
      popup.remove();
      document.removeEventListener("click", closeMenu);
    });
  }, 0);
}

async function deleteStore(storeId) {
  const popup = document.getElementById("store-menu-popup");
  if (popup) popup.remove();

  if (!confirm("¿Seguro que quieres eliminar esta tienda? Esta acción no se puede deshacer.")) return;

  const res = await fetch(`${API_BASE}/api/shopify/delete/${storeId}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + localStorage.getItem("token") },
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Error eliminando tienda");
    return;
  }

  setSection("tiendas");
}

window.openStoreMenu = openStoreMenu;
window.deleteStore = deleteStore;

function openReactivateModal(domain, storeId) {
  window.__reactivateShopDomain = domain;
  window.__reactivateShopId = storeId;

  const modal = document.createElement("div");
  modal.className = "modal-bg";

  modal.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <div style="width:36px;height:36px;border-radius:8px;background:#e8f5e9;display:flex;align-items:center;justify-content:center;font-weight:700;color:#16a34a;">
          S
        </div>
        <div>
          <h3 style="margin:0;">Reconectar tienda</h3>
          <div class="muted" style="font-size:13px;">Conexión segura con Shopify</div>
        </div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:16px;background:#f9fafb;">
        <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Tienda Shopify</div>
        <div style="font-weight:600;">${domain}</div>
      </div>

      <label style="font-size:13px;font-weight:500;">Token privado de Shopify</label>

      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding:10px 12px;border:1.5px solid #22c55e;border-radius:10px;background:#f0fdf4;">
        <span style="font-size:16px;">🔑</span>
        <input
          id="reactivate-token"
          placeholder="Pega aquí el token generado en Shopify"
          style="border:none;outline:none;background:transparent;flex:1;font-size:14px;"
        />
      </div>

      <div class="muted" style="font-size:12px;margin-top:6px;">
        🔒 Este token se usa únicamente para autorizar la conexión.
      </div>

      <div style="display:flex;gap:10px;margin-top:20px;">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="reactivateStore()" style="flex:1;">Reconectar tienda</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

async function reactivateStore() {
  const input = document.getElementById("reactivate-token");
  const accessToken = input ? input.value.trim() : "";
  const shop = window.__reactivateShopDomain;
  const storeId = window.__reactivateShopId;

  if (!accessToken || accessToken.length < 10) {
    input.classList.add("input-error");
    input.focus();
    setTimeout(() => input.classList.remove("input-error"), 1200);
    return;
  }

  try {
    const secretRes = await fetch(`${API_BASE}/api/shopify/secret/${storeId}`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
    });
    const secretData = await secretRes.json();
    const appSecret = secretData.app_secret || "";

    const res = await fetch(`${API_BASE}/api/shopify/connect-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({ shop, accessToken, appSecret }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error reactivando tienda");
      return;
    }

    closeModal();
    setSection("tiendas");

  } catch (err) {
    alert("Error de conexión");
  }
}

async function syncAndRefreshOrders() {
  const btn = document.querySelector(".btn-sync");
  if (btn) { btn.disabled = true; btn.style.opacity = "0.6"; }
  try {
    const res = await fetch(`${API_BASE}/api/shopify/sync-orders`, {
      method: "POST",
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
    });
    const data = await res.json();
    await fetchOrders();
    if (btn) { btn.textContent = `✓ ${data.synced || 0} pedidos`; }
    setTimeout(() => {
      if (btn) { btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M1 4v6h6" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke-linecap="round" stroke-linejoin="round"/></svg> Sincronizar`; btn.disabled = false; btn.style.opacity = "1"; }
    }, 2000);
  } catch (e) {
    if (btn) { btn.textContent = "❌ Error"; btn.disabled = false; btn.style.opacity = "1"; }
    setTimeout(() => {
      if (btn) { btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M1 4v6h6" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke-linecap="round" stroke-linejoin="round"/></svg> Sincronizar`; }
    }, 2000);
  }
}

window.syncAndRefreshOrders = syncAndRefreshOrders;
window.openReactivateModal = openReactivateModal;
window.reactivateStore = reactivateStore;

// =========================
// PANEL DE FILTROS PEDIDOS
// =========================
let activeFilters = { status: "", shop: "", dateFrom: "", dateTo: "" };

async function toggleFilterPanel() {
  const existing = document.getElementById("filter-panel");
  if (existing) { existing.remove(); return; }

  // Obtener tiendas para el selector
  let stores = [];
  try {
    const r = await fetch(`${API_BASE}/api/shopify/stores`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
    });
    stores = await r.json();
    if (!Array.isArray(stores)) stores = [];
  } catch {}

  const panel = document.createElement("div");
  panel.id = "filter-panel";
  panel.style.cssText = `
    position:fixed; top:0; right:0; width:300px; height:100vh;
    background:#fff; border-left:1px solid #e5e7eb;
    box-shadow:-4px 0 20px rgba(0,0,0,0.1);
    z-index:999; display:flex; flex-direction:column;
    font-family:inherit;
  `;

  panel.innerHTML = `
    <div style="padding:20px 20px 14px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:16px; font-weight:700;">Filtros</span>
      <span onclick="toggleFilterPanel()" style="cursor:pointer; font-size:20px; color:#6b7280; line-height:1;">×</span>
    </div>

    <div style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:20px;">

      <div>
        <label style="font-size:12px; font-weight:600; color:#374151; display:block; margin-bottom:8px;">Fecha</label>
        <input type="date" id="filter-date-from" value="${activeFilters.dateFrom}"
          style="width:100%; padding:8px 10px; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; margin-bottom:6px;">
        <input type="date" id="filter-date-to" value="${activeFilters.dateTo}"
          style="width:100%; padding:8px 10px; border:1px solid #e5e7eb; border-radius:8px; font-size:13px;">
      </div>

      <div>
        <label style="font-size:12px; font-weight:600; color:#374151; display:block; margin-bottom:8px;">Estado logístico</label>
        <select id="filter-status"
          style="width:100%; padding:8px 10px; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; background:#fff;">
          <option value="">Todos</option>
<option value="pendiente" ${activeFilters.status==="pendiente"?"selected":""}>Pendiente</option>
<option value="entregado" ${activeFilters.status==="entregado"?"selected":""}>Entregado</option>
<option value="en_transito" ${activeFilters.status==="en_transito"?"selected":""}>En tránsito</option>
<option value="devuelto" ${activeFilters.status==="devuelto"?"selected":""}>Devuelto</option>
<option value="destruido" ${activeFilters.status==="destruido"?"selected":""}>Destruido</option>
<option value="franquicia" ${activeFilters.status==="franquicia"?"selected":""}>Franquicia</option>
        </select>
      </div>

      <div>
        <label style="font-size:12px; font-weight:600; color:#374151; display:block; margin-bottom:8px;">Tiendas</label>
        <div style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
          <div
            onclick="selectFilterShop('')"
            id="shop-opt-all"
            style="padding:10px 12px; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:8px;
              background:${!activeFilters.shop ? '#f0fdf4' : '#fff'};
              color:${!activeFilters.shop ? '#16a34a' : '#111827'};
              font-weight:${!activeFilters.shop ? '600' : '400'};"
          >
            <span style="width:16px; height:16px; border-radius:50%; border:2px solid ${!activeFilters.shop ? '#16a34a' : '#d1d5db'};
              background:${!activeFilters.shop ? '#16a34a' : 'transparent'}; display:inline-block; flex-shrink:0;"></span>
            Todas las tiendas
          </div>
          ${stores.map(s => `
            <div
              onclick="selectFilterShop('${s.domain}')"
              id="shop-opt-${s.id}"
              style="padding:10px 12px; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:8px;
                border-top:1px solid #f3f4f6;
                background:${activeFilters.shop===s.domain ? '#f0fdf4' : '#fff'};
                color:${activeFilters.shop===s.domain ? '#16a34a' : '#111827'};
                font-weight:${activeFilters.shop===s.domain ? '600' : '400'};"
              onmouseover="this.style.background='#f9fafb'"
              onmouseout="this.style.background='${activeFilters.shop===s.domain ? '#f0fdf4' : '#fff'}'"
            >
              <span style="width:16px; height:16px; border-radius:50%; border:2px solid ${activeFilters.shop===s.domain ? '#16a34a' : '#d1d5db'};
                background:${activeFilters.shop===s.domain ? '#16a34a' : 'transparent'}; display:inline-block; flex-shrink:0;"></span>
              ${escapeHtml(s.shop_name || s.domain)}
            </div>
          `).join("")}
        </div>
      </div>

    </div>

    <div style="padding:16px 20px; border-top:1px solid #e5e7eb; display:flex; gap:10px;">
      <button onclick="clearFilters()"
        style="flex:1; padding:10px; border:1px solid #e5e7eb; border-radius:8px; background:#fff; font-size:13px; cursor:pointer; font-weight:600;">
        Limpiar
      </button>
      <button onclick="applyFilters()"
        style="flex:1; padding:10px; border:none; border-radius:8px; background:#16a34a; color:#fff; font-size:13px; cursor:pointer; font-weight:700;">
        Aplicar
      </button>
    </div>
  `;

  document.body.appendChild(panel);

  // Cerrar al hacer clic fuera
  setTimeout(() => {
    document.addEventListener("click", function closeFilter(e) {
      const p = document.getElementById("filter-panel");
      if (p && !p.contains(e.target) && !e.target.closest(".btn-secondary")) {
        p.remove();
        document.removeEventListener("click", closeFilter);
      }
    });
  }, 100);
}

function selectFilterShop(domain) {
  activeFilters.shop = domain;
  // Re-render solo los items del selector sin cerrar el panel
  toggleFilterPanel();
  toggleFilterPanel();
}

function applyFilters() {
  activeFilters.status = document.getElementById("filter-status")?.value || "";
  activeFilters.shop = document.getElementById("filter-shop-inline")?.value || activeFilters.shop || "";
  activeFilters.dateFrom = document.getElementById("filter-date-from")?.value || "";
  activeFilters.dateTo = document.getElementById("filter-date-to")?.value || "";

  // ✅ VALIDACIÓN: fecha desde no puede ser mayor que fecha hasta
  if (activeFilters.dateFrom && activeFilters.dateTo) {
    if (activeFilters.dateFrom > activeFilters.dateTo) {
      alert("❌ La fecha de inicio no puede ser mayor que la fecha de fin");
      return;
    }
  }
  console.log("Aplicando filtros:", activeFilters);
  console.log("Total pedidos:", allOrders.length);

  const filtered = allOrders.filter(o => {
    // Filtro estado
    if (activeFilters.status && o.fulfillment_status !== activeFilters.status) return false;

    // Filtro tienda
    if (activeFilters.shop && o.shop_domain !== activeFilters.shop) return false;

    // Filtro fecha desde
    if (activeFilters.dateFrom) {
      const from = new Date(activeFilters.dateFrom + "T00:00:00");
      const orderDate = new Date(o.created_at);
      if (orderDate < from) return false;
    }

    // Filtro fecha hasta
    if (activeFilters.dateTo) {
      const to = new Date(activeFilters.dateTo + "T23:59:59");
      const orderDate = new Date(o.created_at);
      if (orderDate > to) return false;
    }

    return true;
  });

  console.log("Pedidos filtrados:", filtered.length);
  renderOrders(filtered);

  const panel = document.getElementById("filter-panel");
  if (panel) panel.remove();
}

function clearFilters() {
  activeFilters = { status: "", shop: "", dateFrom: "", dateTo: "" };
  renderOrders(allOrders);
  toggleFilterPanel();
}

function clearFiltersInline() {
  activeFilters = { status: "", shop: "", dateFrom: "", dateTo: "" };
  const df = document.getElementById("filter-date-from");
  const dt = document.getElementById("filter-date-to");
  const ss = document.getElementById("filter-status");
  const sh = document.getElementById("filter-shop-inline");
  if (df) df.value = "";
  if (dt) dt.value = "";
  if (ss) ss.value = "";
  if (sh) sh.value = "";
  renderOrders(allOrders);
}
window.clearFiltersInline = clearFiltersInline;

function filterByTab(el, status) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
  if (!status) return renderOrders(allOrders);
  const filtered = allOrders.filter(o => o.fulfillment_status === status);
  renderOrders(filtered);
}
function filterByTabMulti(el, statuses) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
  const filtered = allOrders.filter(o => statuses.includes(o.fulfillment_status));
  renderOrders(filtered);
}
window.filterByTab = filterByTab;
window.filterByTabMulti = filterByTabMulti;



window.toggleFilterPanel = toggleFilterPanel;
window.selectFilterShop = selectFilterShop;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;

function addGastoExtra(shop) {
  if (!gastosExtras[shop]) gastosExtras[shop] = [];
  gastosExtras[shop].push({ nombre: "", valor: 0 });
  loadGastosVarios();
}

function updateGastoExtraNombre(input) {
  const shop = input.dataset.shop;
  const idx  = parseInt(input.dataset.idx);
  if (!gastosExtras[shop]) return;
  gastosExtras[shop][idx].nombre = input.value;
}

async function syncExcelMRW(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  input.value = "";

  try {
    const res = await fetch(`${API_BASE}/api/tracking/sync-excel`, {
      method: "POST",
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
      body: formData,
    });
    const data = await res.json();
    if (data.ok) {
      alert(`✅ ${data.updated} pedidos actualizados de ${data.total} filas`);
      fetchOrders();
    } else {
      alert("❌ Error: " + (data.error || "desconocido"));
    }
  } catch {
    alert("❌ Error de conexión");
  }
}
window.syncExcelMRW = syncExcelMRW; 

function updateGastoExtraValor(input) {
  const shop = input.dataset.shop;
  const idx  = parseInt(input.dataset.idx);
  if (!gastosExtras[shop]) return;
  gastosExtras[shop][idx].valor = parseFloat(input.value)||0;
  loadGastosVarios();
}

window.addGastoExtra          = addGastoExtra;
window.updateGastoExtraNombre = updateGastoExtraNombre;
window.updateGastoExtraValor  = updateGastoExtraValor;

// =========================
// REEMBOLSOS
// =========================
let allReembolsos = [];
let currentReePage = 1;
const REE_PER_PAGE = 20;
let currentReeDisplay = [];

async function loadReembolsos() {
  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const orders = await res.json();
    allReembolsos = Array.isArray(orders) ? orders.filter(o => {
      if (o.fulfillment_status !== "entregado") return false;
      try {
        const raw = o.raw_json ? (typeof o.raw_json === "string" ? JSON.parse(o.raw_json) : o.raw_json) : null;
        const fin = (raw?.financial_status || raw?.payment_status || o.financial_status || o.payment_status || "").toLowerCase().trim();
        return fin === "pending" || fin === "cod" || fin === "pendiente";
      } catch { return false; }
    }) : [];
    renderReembolsos();
  } catch(e) {
    const body = document.getElementById("reeBody");
    if (body) body.innerHTML = `<div style="color:#dc2626;padding:16px;">Error cargando reembolsos</div>`;
  }
}

function renderReembolsos() {
  const dateFrom = document.getElementById("ree-date-from")?.value || "";
  const dateTo   = document.getElementById("ree-date-to")?.value || "";
  const shop     = document.getElementById("ree-shop")?.value || "";

  let filtered = allReembolsos.filter(o => {
    if (shop && o.shop_domain !== shop) return false;
    if (dateFrom) {
      const d = new Date(o.created_at); const from = new Date(dateFrom + "T00:00:00");
      if (d < from) return false;
    }
    if (dateTo) {
      const d = new Date(o.created_at); const to = new Date(dateTo + "T23:59:59");
      if (d > to) return false;
    }
    return true;
  });

  currentReeDisplay = filtered;
  currentReePage = 1;
  renderReePage();
}

function renderReePage() {
  const body = document.getElementById("reeBody");
  const pagination = document.getElementById("reePagination");
  const counter = document.getElementById("ree-counter");
  if (!body) return;

  if (!currentReeDisplay.length) {
    body.innerHTML = `<div class="muted" style="padding:16px;">No hay reembolsos pendientes</div>`;
    if (pagination) pagination.innerHTML = "";
    if (counter) counter.textContent = "";
    return;
  }

  const totalPages = Math.ceil(currentReeDisplay.length / REE_PER_PAGE);
  const start = (currentReePage - 1) * REE_PER_PAGE;
  const pageOrders = currentReeDisplay.slice(start, start + REE_PER_PAGE);

  if (counter) {
    const total = currentReeDisplay.length;
    counter.textContent = `Mostrando ${start + 1}–${Math.min(start + REE_PER_PAGE, total)} de ${total} reembolsos`;
  }

  body.innerHTML = pageOrders.map((o, idx) => {
    const numero = start + idx + 1;
    const estadoPago = localStorage.getItem("ree_estado_" + o.id) || "pendiente";
    const estadoColor = estadoPago === "cobrado" ? "#16a34a" : estadoPago === "no_cobrado" ? "#dc2626" : "#f59e0b";

    return `
    <div class="orders-row" style="display:grid;grid-template-columns:40px 16% 14% 1fr 10% 14%;gap:0;">
      <div style="color:#9ca3af;font-size:12px;display:flex;align-items:center;">${numero}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(o.order_number || "-")}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.created_at ? new Date(o.created_at).toLocaleDateString("es-ES") : "-"}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(o.customer_name || "-")}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.total_price || 0} ${escapeHtml(o.currency || "")}</div>
      <div>
        <select onchange="cambiarEstadoReembolso('${o.id}', this.value)"
          style="padding:4px 8px;border:1px solid ${estadoColor};border-radius:6px;font-size:12px;font-weight:600;color:${estadoColor};background:var(--card);cursor:pointer;font-family:inherit;">
          <option value="pendiente" ${estadoPago==="pendiente"?"selected":""}>⏳ Pendiente</option>
          <option value="cobrado" ${estadoPago==="cobrado"?"selected":""}>✅ Cobrado</option>
          <option value="no_cobrado" ${estadoPago==="no_cobrado"?"selected":""}>❌ No cobrado</option>
        </select>
      </div>
    </div>`;
  }).join("");

  if (pagination) {
    if (totalPages <= 1) { pagination.innerHTML = ""; return; }
    const p = currentReePage;
    const delta = 2;
    let pages = "";
    pages += `<button onclick="goToReePage(${Math.max(1,p-1)})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;background:var(--card);color:${p===1?"#d1d5db":"var(--text)"};font-size:13px;cursor:pointer;font-family:inherit;" ${p===1?"disabled":""}>‹</button>`;
    let sp = Math.max(1,p-delta), ep = Math.min(totalPages,p+delta);
    if (sp > 1) { pages += `<button onclick="goToReePage(1)" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;background:var(--card);color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;">1</button>`; if (sp>2) pages += `<span style="padding:0 4px;color:#9ca3af;line-height:34px;">…</span>`; }
    for (let i=sp;i<=ep;i++) { const a=i===p; pages += `<button onclick="goToReePage(${i})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid ${a?"#16a34a":"#e5e7eb"};background:${a?"#16a34a":"var(--card)"};color:${a?"#fff":"var(--text)"};font-size:13px;font-weight:${a?"700":"400"};cursor:pointer;font-family:inherit;">${i}</button>`; }
    if (ep < totalPages) { if (ep<totalPages-1) pages += `<span style="padding:0 4px;color:#9ca3af;line-height:34px;">…</span>`; pages += `<button onclick="goToReePage(${totalPages})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;background:var(--card);color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;">${totalPages}</button>`; }
    pages += `<button onclick="goToReePage(${Math.min(totalPages,p+1)})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;background:var(--card);color:${p===totalPages?"#d1d5db":"var(--text)"};font-size:13px;cursor:pointer;font-family:inherit;" ${p===totalPages?"disabled":""}>›</button>`;
    pagination.innerHTML = pages;
  }
}

function goToReePage(page) {
  currentReePage = page;
  renderReePage();
}

function cambiarEstadoReembolso(orderId, estado) {
  localStorage.setItem("ree_estado_" + orderId, estado);
  renderReePage();
}

function clearReembolsosFilters() {
  const df = document.getElementById("ree-date-from");
  const dt = document.getElementById("ree-date-to");
  const sh = document.getElementById("ree-shop");
  if (df) df.value = "";
  if (dt) dt.value = "";
  if (sh) sh.value = "";
  renderReembolsos();
}

window.loadReembolsos         = loadReembolsos;
window.renderReembolsos       = renderReembolsos;
window.goToReePage            = goToReePage;
window.cambiarEstadoReembolso = cambiarEstadoReembolso;
window.clearReembolsosFilters = clearReembolsosFilters;