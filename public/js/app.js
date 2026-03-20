const API_BASE = "https://profit-cod.onrender.com";

function getActiveToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("impersonated") === "1"
    ? localStorage.getItem("impersonated_token")
    : localStorage.getItem("token");
}

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

  // Indicador de carga global
  // Sistema de indicador de estado no bloqueante
  window.__loadingCount = 0;

  window.__showLoadingBar = function(msg) {
    window.__loadingCount = (window.__loadingCount || 0) + 1;
    let ind = document.getElementById("__status-indicator");
    if (!ind) {
      ind = document.createElement("div");
      ind.id = "__status-indicator";
      ind.style.cssText = `
        position:fixed;bottom:20px;right:20px;z-index:99999;
        background:#1f2937;color:#fff;
        font-size:12px;font-weight:500;font-family:inherit;
        padding:8px 14px;border-radius:20px;
        display:flex;align-items:center;gap:7px;
        box-shadow:0 4px 12px rgba(0,0,0,0.2);
        opacity:0;transition:opacity 0.2s ease;
        pointer-events:none;
      `;
      document.body.appendChild(ind);
      setTimeout(() => { if (ind) ind.style.opacity = "1"; }, 10);
    }
    if (!document.getElementById("__spin-style")) {
      const s = document.createElement("style");
      s.id = "__spin-style";
      s.textContent = `@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`;
      document.head.appendChild(s);
    }
    ind.innerHTML = `<span style="display:inline-block;animation:spin 0.8s linear infinite;font-size:13px;">⏳</span><span>${msg || "Guardando..."}</span>`;
  };

  window.__hideLoadingBar = function() {
    window.__loadingCount = Math.max(0, (window.__loadingCount || 1) - 1);
    if (window.__loadingCount > 0) return;
    const ind = document.getElementById("__status-indicator");
    if (!ind) return;
    ind.innerHTML = `<span style="font-size:13px;">✅</span><span>Guardado</span>`;
    setTimeout(() => {
      ind.style.opacity = "0";
      setTimeout(() => { if (ind) ind.remove(); }, 300);
    }, 1200);
  };

   // Detectar servidor caído (Render desplegando)
  async function pingServidor() {
    try {
      const r = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: "Bearer " + token } });
      if (r.status === 503 || r.status === 502) {
        window.__showLoadingBar?.("🔄 Actualizando aplicación, espera un momento...");
        setTimeout(pingServidor, 4000);
        return false;
      }
      return true;
    } catch {
      window.__showLoadingBar?.("🔄 Actualizando aplicación, espera un momento...");
      setTimeout(pingServidor, 4000);
      return false;
    }
  }

  fetch(`${API_BASE}/api/auth/me`, {
  headers: {
    Authorization: "Bearer " + token,
  },
})
    .then((res) => {
      if (res.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("impersonated_token");
        window.location.href = "/login.html";
        throw new Error("Cuenta desactivada");
      }
      if (!res.ok) throw new Error("No autorizado");
      return res.json();
    })
    .then((data) => {
      currentUser = {
        id: data.user.id,
        name: data.user.email,
        role: data.user.role === "admin" ? "Administrador" : "Cliente",
        avatar_url: data.user.avatar_url || null,
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
      facturas: "Gastos",
      informes: "Ingresos",
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
      facturas: "Expenses",
      informes: "Income",
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
      facturas: "Gastos",
      informes: "Receitas",
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
      facturas: "Spese",
      informes: "Entrate",
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
      list = [];
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
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px 8px;">
        <span style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${d.ui.notiTitle}</span>
        ${list.length ? `<span style="font-size:11px;color:#6b7280;">${list.length} notificaciones</span>` : ""}
      </div>
      ${
        list.length
          ? `<div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-bottom:8px;">
              ${list.map(n => {
                const es7dias = n.id.startsWith("7dias__");
                let fechaLabel = "";
                if (n.date) {
                  const d = new Date(n.date);
                  const hoy = new Date();
                  const mismodia = d.toDateString() === hoy.toDateString();
                  const hora = d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
                  if (mismodia) {
                    fechaLabel = `Hoy ${hora}`;
                  } else {
                    const dia = d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit" });
                    fechaLabel = `${dia} ${hora}`;
                  }
                }
                return `
                  <div class="notif-row" style="cursor:pointer;margin-bottom:0;">
                    <div onclick="irAPedidoDesdeNotif('${escapeAttr(n.id)}')" style="flex:1;">
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <strong>${escapeHtml(n.title)}</strong>
                        ${fechaLabel ? `<span style="font-size:10px;color:#9ca3af;white-space:nowrap;flex-shrink:0;">${escapeHtml(fechaLabel)}</span>` : ""}
                      </div>
                      <span>${escapeHtml(n.text)}</span>
                    </div>
                    ${es7dias ? `
                    <div style="margin-top:6px;display:flex;gap:6px;">
                      <button onclick="marcarGestionado(event,'${escapeAttr(n.id)}')"
                        style="font-size:11px;padding:3px 8px;border:1px solid #16a34a;border-radius:6px;background:#f0fdf4;color:#16a34a;cursor:pointer;font-family:inherit;">
                        ✓ Gestionado
                      </button>
                    </div>` : ""}
                  </div>`;
              }).join("")}
            </div>
            <div class="drop-item" onclick="clearNotif()" style="justify-content:center;border-top:1px solid var(--border);margin-top:4px;padding-top:10px;color:#dc2626;font-weight:600;font-size:12px;">
              ✓ Marcar todo como leído
            </div>`
          : `<div class="notif-row"><strong>OK</strong><span>No hay notificaciones</span></div>`
      }
    `;
   

   }  // ← cierre correcto de renderNotifPanel

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
  // Manejar retorno de OAuth Shopify
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("shopify") === "connected") {
    history.replaceState({}, "", "/");
    showToast("✅ Tienda conectada", "La tienda Shopify se conectó correctamente", "#16a34a");
    section = "tiendas";
  } else if (urlParams.get("shopify") === "error") {
    history.replaceState({}, "", "/");
    showToast("❌ Error", "No se pudo conectar la tienda Shopify", "#dc2626");
  }

  const d = dict();
  const labels = d.labels;

  const savedLang = localStorage.getItem("lang") || "ES";

  // logo eliminado
  const logo = null;

  const notiList = getNotifications(d);

  appEl.innerHTML = `
  <div class="layout">
    <div class="sidebar" id="sidebar">
      <div class="logo-zone">
        <div class="logo-wrapper">
          <div style="font-size:18px;font-weight:800;color:#16a34a;letter-spacing:1px;cursor:default;">PROFICOD</div>
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

      <div class="toggle">
        <span>${d.ui.night}</span>
        <div class="switch" onclick="toggleTheme()"></div>
      </div>

      <div class="spacer"></div>

      <div style="margin:0 8px 12px;border-top:1px solid #e5e7eb;padding-top:10px;">
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;padding:0 4px 6px;">Pendiente MRW</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 4px;">
          <span style="font-size:12px;color:#6b7280;display:flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:#9ca3af;fill:none;stroke-width:2;flex-shrink:0;"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h6"/></svg>
            Pedidos
          </span>
          <span style="font-size:13px;font-weight:700;color:#374151;" id="sidebar-ree-count">—</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 4px;">
          <span style="font-size:12px;color:#6b7280;display:flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:#9ca3af;fill:none;stroke-width:2;flex-shrink:0;"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6"/></svg>
            Importe
          </span>
          <span style="font-size:13px;font-weight:700;color:#374151;" id="sidebar-ree-total">—</span>
        </div>
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
                <div class="user-avatar" id="header-avatar" style="${currentUser.avatar_url ? `background-image:url('${currentUser.avatar_url}');background-size:cover;background-position:center;` : ""}"></div>

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
    loadSidebarReembolsos();
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
  const savedFrom = localStorage.getItem("met_from") || fmt(firstDay);
  const savedTo   = localStorage.getItem("met_to")   || fmt(now);

  if (box) {
    box.className = "card metricas-box";
    box.innerHTML = `
      <div style="display:flex;gap:20px;align-items:flex-start;">
        <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <h3 style="margin:0;font-size:15px;font-weight:600;">Estadísticas</h3>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1;justify-content:flex-end;">
                    <button onclick="filtroMetricasHoy()"
            id="btn-met-hoy"
            style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#fff;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:#374151;transition:all .15s;"
            onmouseover="this.style.borderColor='#16a34a';this.style.color='#16a34a';this.querySelector('svg').style.stroke='#16a34a';"
            onmouseout="this.style.borderColor='#e5e7eb';this.style.color='#374151';this.querySelector('svg').style.stroke='#6b7280';">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .15s;"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="16" r="1.5" fill="#6b7280" stroke="none"/></svg>
            Hoy
          </button>
          <button onclick="filtroMetricasMes()"
            id="btn-met-mes"
            style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#fff;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:#374151;transition:all .15s;"
            onmouseover="this.style.borderColor='#16a34a';this.style.color='#16a34a';this.querySelector('svg').style.stroke='#16a34a';"
            onmouseout="this.style.borderColor='#e5e7eb';this.style.color='#374151';this.querySelector('svg').style.stroke='#6b7280';">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .15s;"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M7 15h4M7 19h2"/></svg>
            Mes actual
          </button>
          <button onclick="filtroMetricasMesAnterior()"
            id="btn-met-mes-ant"
            style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#fff;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:#374151;transition:all .15s;"
            onmouseover="this.style.borderColor='#16a34a';this.style.color='#16a34a';this.querySelector('svg').style.stroke='#16a34a';"
            onmouseout="this.style.borderColor='#e5e7eb';this.style.color='#374151';this.querySelector('svg').style.stroke='#6b7280';">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .15s;"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M7 15h2M7 19h2"/></svg>
            Mes anterior
          </button>
          <input type="date" id="metrics-date-from" value="${savedFrom}"
            onchange="aplicarFiltroMetricas()"
            style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;color:var(--text);background:var(--card);"/>
          <span style="color:#6b7280;font-size:13px;">—</span>
          <input type="date" id="metrics-date-to" value="${savedTo}"
            onchange="aplicarFiltroMetricas()"
            style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;color:var(--text);background:var(--card);"/>
          <select id="metrics-shop" style="display:none;">
            <option value="">Todas las tiendas</option>
          </select>
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
            <span style="font-size:12px;color:#6b7280;display:flex;flex-direction:column;line-height:1.4;">Enviados<span style="font-size:10px;color:#9ca3af;">(excl. pendientes y cancelados)</span></span>
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
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="stat-label" style="font-weight:600;">Tasa de entrega</span>
            <span id="donut-base" style="font-size:11px;color:#9ca3af;font-weight:400;"></span>
          </div>
          <div style="display:flex;align-items:center;gap:16px;width:100%;">
            <div style="position:relative;width:80px;height:80px;flex-shrink:0;">
              <svg viewBox="0 0 36 36" style="transform:rotate(-90deg);width:80px;height:80px;">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="transparent" stroke-width="3.5"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#16a34a" stroke-width="3.5"
                  stroke-dasharray="0 100" id="donut-entregado" stroke-linecap="butt"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#dc2626" stroke-width="3.5"
                  stroke-dasharray="0 100" id="donut-rojo" stroke-linecap="butt"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" stroke-width="3.5"
                  stroke-dasharray="0 100" id="donut-pendiente" stroke-linecap="butt"/>
              </svg>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:12px;font-weight:700;" id="donut-pct">0%</span>
              </div>
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

    <div class="stat-card">
          <div class="stat-icon" style="background:#0ea5e9;">
            <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-facturacion">0,00 €</span>
            <span class="stat-label">Facturación</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#f97316;">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-cpa">— €</span>
            <span class="stat-label">CPA</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#10b981;">
            <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-roas">—</span>
            <span class="stat-label">ROAS</span>
          </div>
        </div>

    </div>
      <div id="metrics-balance-wrap" style="margin-top:32px;"></div>
      </div>
    </div>
    `;
  }
function filtroMetricasHoy() {
  const hoy = new Date().toISOString().split("T")[0];
  const from = document.getElementById("metrics-date-from");
  const to   = document.getElementById("metrics-date-to");
  if (from) from.value = hoy;
  if (to)   to.value   = hoy;
  localStorage.setItem("met_from", hoy);
  localStorage.setItem("met_to",   hoy);
  loadMetricas();
}
window.filtroMetricasHoy = filtroMetricasHoy;

function filtroMetricasMes() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today    = now.toISOString().split("T")[0];
  const from = document.getElementById("metrics-date-from");
  const to   = document.getElementById("metrics-date-to");
  if (from) from.value = firstDay;
  if (to)   to.value   = today;
  localStorage.setItem("met_from", firstDay);
  localStorage.setItem("met_to",   today);
  loadMetricas();
}
window.filtroMetricasMes = filtroMetricasMes;

function filtroMetricasMesAnterior() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay  = new Date(now.getFullYear(), now.getMonth(), 0);
  const firstStr = firstDay.toISOString().split("T")[0];
  const lastStr  = lastDay.toISOString().split("T")[0];
  const from = document.getElementById("metrics-date-from");
  const to   = document.getElementById("metrics-date-to");
  if (from) from.value = firstStr;
  if (to)   to.value   = lastStr;
  localStorage.setItem("met_from", firstStr);
  localStorage.setItem("met_to",   lastStr);
  loadMetricas();
}
window.filtroMetricasMesAnterior = filtroMetricasMesAnterior;

function aplicarFiltroMetricas() {
  const from = document.getElementById("metrics-date-from")?.value;
  const to   = document.getElementById("metrics-date-to")?.value;

  if (from && to && from > to) {
    alert("❌ La fecha de inicio no puede ser mayor que la fecha de fin");
    return;
  }

  // Guardar fechas en localStorage
  if (from) localStorage.setItem("met_from", from);
  if (to)   localStorage.setItem("met_to", to);

  loadMetricas();
}
window.aplicarFiltroMetricas = aplicarFiltroMetricas;

  loadMetricas();

// Cargar tiendas en el selector de métricas
  fetch(`${API_BASE}/api/shopify/stores`, {
    headers: { Authorization: "Bearer " + getActiveToken() }
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
          "Authorization": "Bearer " + getActiveToken()
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
          <div>Estado</div>
        </div>

        <div id="usersTable"></div>

      </div>
    `;

    const table = document.getElementById("usersTable");

    fetch(`${API_BASE}/api/users`, {
      headers: {
        "Authorization": "Bearer " + getActiveToken()
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

            ${u.role !== "admin" ? `
            <div>
              <label class="user-switch">
                <input type="checkbox" ${u.active !== 0 ? "checked" : ""}
                  onchange="toggleUserStatus('${u.id}', this.checked)">
                <span class="user-slider"></span>
              </label>
            </div>
            ` : `<div style="color:#9ca3af;font-size:12px;text-align:center;">—</div>`}

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
// SECCIÓN PRODUCTOS
// =========================
if (id === "productos") {
  if (t) t.textContent = "Productos";
  if (s) s.textContent = "Catálogo de productos por tienda";
  if (c) c.textContent = "Productos";

  box.className = "card";
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:10px;flex-wrap:wrap;">
      <button onclick="abrirEntradaMercancia()"
        style="padding:7px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
        📦 Entrada de mercancía
      </button>
      <div style="display:flex;align-items:center;gap:10px;">
        <select id="productos-shop-filter" onchange="loadProductos()"
          style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          <option value="">Todas las tiendas</option>
        </select>
        <button onclick="loadProductos()"
          style="padding:7px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
          🔄 Sincronizar productos
        </button>
      </div>
    </div>
    <div id="productos-wrap"><div class="muted" style="padding:16px;">Cargando productos...</div></div>
  `;

  loadProductos();
  // Cargar tiendas en filtro
  fetch(`${API_BASE}/api/shopify/stores`, {
    headers: { Authorization: "Bearer " + getActiveToken() }
  }).then(r => r.json()).then(stores => {
    const sel = document.getElementById("productos-shop-filter");
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
// SECCIÓN PEDIDOS
// =========================
if (id === "pedidos") {

  if (t) t.textContent = "Pedidos";
  if (s) s.textContent = "Gestión de pedidos";
  if (c) c.textContent = "Pedidos";

  box.className = "card";
  box.innerHTML = `
      <div class="orders-header">

       <div class="filters">
          <!-- FILA ÚNICA: Filtros izquierda | Acciones derecha -->
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:10px;width:100%;">

            <!-- IZQUIERDA: filtros -->
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <input type="date" id="filter-date-from" value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]}"
                onchange="applyFilters()"
                style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;color:var(--text);background:var(--card);"/>
              <span style="color:#6b7280;font-size:13px;">—</span>
              <input type="date" id="filter-date-to" value="${new Date().toISOString().split('T')[0]}"
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
                <option value="enviado">Enviado</option>
                <option value="cancelado">Cancelado</option>
              </select>
              <button onclick="clearFiltersInline()" style="padding:7px 14px;background:#fef2f2;border:1px solid #dc2626;border-radius:8px;color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Limpiar</button>
            </div>

            <!-- DERECHA: Sincronizar e Importar -->
            <div style="display:flex;align-items:center;gap:8px;">
              <button id="btn-mrw-integrar" onclick="abrirModalMRW()"
                style="padding:7px 14px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
                🔗 Integrar MRW
              </button>
              <button id="btn-mrw-sync" onclick="sincronizarMRW()" style="display:none;
                padding:7px 14px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                🔄 Sincronizar MRW
              </button>
              <button id="btn-mrw-desintegrar" onclick="desintegrarMRW()" style="display:none;
                padding:7px 14px;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                ✕ Desintegrar MRW
              </button>
               
<button class="btn-sync" onclick="syncAndRefreshOrders()">
                <svg viewBox="0 0 24 24"><path d="M1 4v6h6" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Sincronizar
              </button>
              <label id="btn-importar-excel" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;background:#16a34a;color:#fff;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
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
    checkMRWIntegration();

    // Cargar tiendas en filtro inline
    fetch(`${API_BASE}/api/shopify/stores`, {
      headers: { Authorization: "Bearer " + getActiveToken() }
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

    // Auto-sincronizar MRW cada 15 minutos si está integrado
    if (window.__mrwInterval) clearInterval(window.__mrwInterval);
    window.__mrwInterval = setInterval(async () => {
      try {
        const creds = await fetch(`${API_BASE}/api/tracking/mrw-credentials`, {
          headers: { Authorization: "Bearer " + getActiveToken() }
        }).then(r => r.json());
        if (creds.integrated) await sincronizarMRW();
      } catch(e) {}
    }, 3 * 60 * 1000);

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
  switchFacturasTab("gastos-ads");
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
        </div>
      <div id="ads-table-wrap" style="overflow-x:auto;margin:0 auto;"></div>
    `;
  }

  // Cargar tiendas
  fetch(`${API_BASE}/api/shopify/stores`, {
    headers: { Authorization: "Bearer " + getActiveToken() }
  }).then(r=>r.json()).then(stores => {
    const sel = document.getElementById("ads-shop-sel");
    if (!sel || !Array.isArray(stores)) return;
    sel.innerHTML = stores.map(s =>
      `<option value="${s.domain}">${escapeHtml(s.shop_name || s.domain)}</option>`
    ).join("");
    document.getElementById("ads-shop-sel")?.addEventListener("change", loadAdsTable);
    document.getElementById("ads-month-sel")?.addEventListener("change", loadAdsTable);
    document.getElementById("ads-year-sel")?.addEventListener("change", loadAdsTable);
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
// SECCIÓN INFORMES
// =========================
if (id === "informes") {
  if (t) t.textContent = "Informes";
  if (s) s.textContent = "Resumen de ingresos por tienda";
  if (c) c.textContent = "Informes";
  box.className = "";
  box.removeAttribute("style");
  box.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;">
      <button id="inf-tab-btn-reembolsos" onclick="switchInformesTab('reembolsos')"
        style="padding:8px 18px;border-radius:8px;border:1px solid #16a34a;font-size:13px;font-weight:600;cursor:pointer;background:#16a34a;color:#fff;">
        Reembolsos
      </button>
      <button id="inf-tab-btn-ingresos" onclick="switchInformesTab('ingresos')"
        style="padding:8px 18px;border-radius:8px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;cursor:pointer;background:#fff;color:#374151;">
        Ingresos
      </button>
      <button id="inf-tab-btn-balance" onclick="switchInformesTab('balance')"
        style="padding:8px 18px;border-radius:8px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;cursor:pointer;background:#fff;color:#374151;">
        Balance Final
      </button>
    </div>
    <div id="informes-content"></div>
  `;
  switchInformesTab("reembolsos");
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

if (id === "ayuda") {
  if (t) t.textContent = "Centro de ayuda";
  if (s) s.textContent = "Guías y explicaciones del sistema";
  if (c) c.textContent = "Centro de ayuda";
  box.className = "";
  box.removeAttribute("style");

  box.innerHTML = `
  <style>
    .help-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:28px; }
    .help-tab-btn { padding:9px 20px; border-radius:10px; border:1.5px solid #e5e7eb; font-size:13px; font-weight:600; cursor:pointer; background:var(--card,#fff); color:var(--text,#111827); transition:all .15s; }
    .help-tab-btn.active, .help-tab-btn:hover { background:#16a34a; color:#fff; border-color:#16a34a; }
    .help-panel { display:none; }
    .help-panel.active { display:block; }
    .help-section { background:var(--card,#fff); border:1px solid var(--border,#e5e7eb); border-radius:12px; padding:24px 28px; margin-bottom:18px; }
    .help-section h2 { font-size:17px; font-weight:700; color:var(--text,#111827); margin:0 0 8px 0; }
    .help-section h3 { font-size:14px; font-weight:700; color:#16a34a; margin:18px 0 6px 0; }
    .help-section p, .help-section li { font-size:14px; color:var(--muted,#4b5563); line-height:1.7; margin:0 0 6px 0; }
    .help-section ul { padding-left:20px; margin:0 0 10px 0; }
    .help-tip { background:#f0fdf4; border-left:3px solid #16a34a; border-radius:0 8px 8px 0; padding:10px 16px; font-size:13px; color:#15803d; margin-top:12px; }
    .help-warning { background:#fefce8; border-left:3px solid #ca8a04; border-radius:0 8px 8px 0; padding:10px 16px; font-size:13px; color:#92400e; margin-top:12px; }
  </style>

  <div class="help-tabs">
    <button class="help-tab-btn active" onclick="helpTab(event,'metricas')">📊 Métricas</button>
    <button class="help-tab-btn" onclick="helpTab(event,'tiendas')">🏪 Tiendas</button>
    <button class="help-tab-btn" onclick="helpTab(event,'productos')">📦 Productos</button>
    <button class="help-tab-btn" onclick="helpTab(event,'pedidos')">🛒 Pedidos</button>
    <button class="help-tab-btn" onclick="helpTab(event,'facturas')">🧾 Facturas</button>
    <button class="help-tab-btn" onclick="helpTab(event,'informes')">📈 Informes</button>
  </div>

  <div id="help-panel-metricas" class="help-panel active">
    <div class="help-section">
      <h2>📊 ¿Qué son las Métricas?</h2>
      <p>Las Métricas son el panel principal de control de tu negocio. Te muestran de un solo vistazo cómo están funcionando todos tus pedidos dentro del rango de fechas que tú elijas.</p>
    </div>
    <div class="help-section">
      <h2>📅 Filtro de fechas y tienda</h2>
      <p>En la parte superior encontrarás dos campos de fecha: <strong>Desde</strong> y <strong>Hasta</strong>. Elige cualquier rango y pulsa <strong>Filtrar</strong> para actualizar todos los datos. También puedes filtrar por una tienda específica. Por defecto muestra siempre el mes en curso.</p>
      <div class="help-tip">💡 Por defecto el sistema muestra siempre el mes en curso, desde el día 1 hasta hoy.</div>
    </div>
    <div class="help-section">
      <h2>📦 Tarjetas de estado de pedidos</h2>
      <p>Cada tarjeta representa el estado en que se encuentran tus pedidos:</p>
      <ul>
        <li><strong>Total:</strong> todos los pedidos dentro del rango seleccionado.</li>
        <li><strong>Enviados:</strong> pedidos que ya tienen número de seguimiento MRW asignado.</li>
        <li><strong>Pendientes:</strong> pedidos recibidos pero aún no procesados.</li>
        <li><strong>En tránsito:</strong> pedidos que ya salieron pero no llegaron al cliente.</li>
        <li><strong>Entregados:</strong> pedidos que el cliente recibió correctamente.</li>
        <li><strong>Devueltos:</strong> pedidos que el cliente rechazó o no recogió.</li>
        <li><strong>Destruidos:</strong> pedidos que MRW destruyó tras no poder entregarlos.</li>
      </ul>
      <div class="help-tip">💡 El gráfico circular (donut) muestra el porcentaje de entregados, devueltos+destruidos y en tránsito sobre el total enviado.</div>
    </div>
    <div class="help-section">
      <h2>💰 Balance aproximado por tienda</h2>
      <p>Debajo de las tarjetas está el panel de Balance. El sistema calcula para cada tienda un resumen financiero del período seleccionado.</p>
      <h3>Ingresos que se tienen en cuenta:</h3>
      <ul>
        <li><strong>COD (contra reembolso):</strong> se descuenta automáticamente la comisión MRW (0,67€ por pedido).</li>
        <li><strong>Tarjeta/Online:</strong> se descuenta automáticamente el 4% de comisión bancaria.</li>
        <li><strong>Ingresos manuales:</strong> puedes añadir ingresos adicionales que no vengan de Shopify.</li>
      </ul>
      <h3>Gastos que se tienen en cuenta:</h3>
      <ul>
        <li><strong>Meta Ads y TikTok Ads:</strong> el gasto en publicidad introducido para ese mes.</li>
        <li><strong>Coste de productos:</strong> calculado según el coste de compra × unidades vendidas.</li>
        <li><strong>MRW:</strong> precio por envío × número de envíos + devoluciones.</li>
        <li><strong>Logística:</strong> precio por gestión × número de envíos.</li>
        <li><strong>Shopify:</strong> cuota mensual introducida en Gastos Varios.</li>
        <li><strong>Gastos fijos prorrateados:</strong> divididos entre el número de tiendas activas.</li>
      </ul>
      <div class="help-warning">⚠️ Este balance es una estimación. Para mayor precisión asegúrate de tener bien configurados los costes de productos, gastos fijos y publicidad.</div>
    </div>
  </div>

  <div id="help-panel-tiendas" class="help-panel">
    <div class="help-section">
      <h2>🏪 ¿Qué es la sección Tiendas?</h2>
      <p>Aquí gestionas todas las conexiones entre PROFICOD y tus tiendas de Shopify. Cada tienda conectada sincronizará automáticamente sus pedidos y productos.</p>
    </div>
    <div class="help-section">
      <h2>➕ Conectar una nueva tienda</h2>
      <p>Pulsa <strong>+ Conectar tienda Shopify</strong>. Necesitarás introducir:</p>
      <ul>
        <li><strong>Dominio:</strong> formato tutienda.myshopify.com</li>
        <li><strong>Access Token:</strong> comienza por shpat_, encuéntralo en Shopify → Apps → Tu app → Credenciales API.</li>
        <li><strong>App Secret:</strong> también en la misma pantalla de credenciales de la app.</li>
      </ul>
      <div class="help-tip">💡 PROFICOD nunca te pedirá la contraseña de tu cuenta de Shopify.</div>
    </div>
    <div class="help-section">
      <h2>🔄 Sincronización automática</h2>
      <p>Los pedidos nuevos se sincronizan automáticamente mediante webhooks. Si necesitas forzar una sincronización puedes usar el botón <strong>Sincronizar</strong> en la sección de Pedidos.</p>
    </div>
    <div class="help-section">
      <h2>💸 Gastos Fijos y Gastos Varios</h2>
      <ul>
        <li><strong>Gastos Fijos:</strong> costes fijos mensuales (oficina, herramientas, etc.). Se distribuyen automáticamente entre todas tus tiendas activas.</li>
        <li><strong>Gastos Varios:</strong> costes variables por tienda como la cuota mensual de Shopify. Se asignan individualmente por tienda y por mes.</li>
      </ul>
      <p>Los precios de MRW y Logística se configuran en Gastos Fijos y se aplican automáticamente según los envíos de cada tienda.</p>
    </div>
  </div>

  <div id="help-panel-productos" class="help-panel">
    <div class="help-section">
      <h2>📦 Productos</h2>
      <p>Catálogo completo de artículos sincronizados desde Shopify. Desde aquí puedes:</p>
      <ul>
        <li>Ver el stock disponible por producto y tienda.</li>
        <li>Introducir el <strong>coste de compra</strong> de cada producto (clave para el balance).</li>
        <li>Configurar <strong>unidades por venta</strong> si un pack incluye varias unidades.</li>
        <li>Registrar <strong>entradas de mercancía</strong> cuando recibes nuevo stock.</li>
      </ul>
      <div class="help-tip">💡 Cuanto más exacto sea el coste de compra, más preciso será el cálculo de rentabilidad en Métricas.</div>
    </div>
  </div>

  <div id="help-panel-pedidos" class="help-panel">
    <div class="help-section">
      <h2>🛒 Pedidos</h2>
      <p>Centraliza todos los pedidos de todas tus tiendas en una sola vista. Puedes filtrar por tienda, estado, fecha o buscar por número de pedido o nombre de cliente.</p>
      <h3>Estados de un pedido:</h3>
      <ul>
        <li><strong>Pendiente:</strong> recibido pero sin procesar todavía.</li>
        <li><strong>En preparación / Enviado / En tránsito / Franquicia:</strong> en camino al cliente.</li>
        <li><strong>Entregado:</strong> el cliente lo recibió correctamente.</li>
        <li><strong>Devuelto:</strong> el cliente lo rechazó o no estaba en casa.</li>
        <li><strong>Destruido:</strong> MRW no pudo entregarlo y lo destruyó.</li>
        <li><strong>Cancelado:</strong> el pedido fue anulado.</li>
      </ul>
      <h3>Importar pagados desde PDF de MRW:</h3>
      <p>Si MRW te envía un PDF con los comprobantes de liquidación, súbelo al sistema. PROFICOD extrae automáticamente los números de seguimiento y marca esos pedidos como pagados.</p>
      <div class="help-tip">💡 Los pedidos cancelados y pendientes no se cuentan en el balance de Métricas.</div>
    </div>
  </div>

  <div id="help-panel-facturas" class="help-panel">
    <div class="help-section">
      <h2>🧾 Facturas</h2>
      <p>Gestiona los documentos de facturación. Dentro encontrarás varias pestañas:</p>
      <ul>
        <li><strong>Reembolsos:</strong> pedidos COD entregados pendientes de cobro. Puedes importar el PDF de MRW para marcarlos automáticamente como pagados.</li>
        <li><strong>Gastos Ads:</strong> introduce el gasto diario de Meta y TikTok por tienda.</li>
        <li><strong>Gastos Fijos:</strong> configura los gastos fijos mensuales.</li>
        <li><strong>Gastos por Tienda:</strong> resumen de todos los gastos variables por tienda.</li>
        <li><strong>Nómina:</strong> próximamente.</li>
      </ul>
      <div class="help-tip">💡 Las notificaciones te avisarán cuando tengas reembolsos pendientes de cobro.</div>
    </div>
  </div>

  <div id="help-panel-informes" class="help-panel">
    <div class="help-section">
      <h2>📈 Informes</h2>
      <p>Resúmenes consolidados organizados en dos pestañas:</p>
      <ul>
        <li><strong>Ingresos:</strong> detalle de ingresos por tienda y mes — COD, tarjeta y totales netos tras comisiones.</li>
        <li><strong>Balance Final:</strong> rentabilidad mensual completa por tienda con ingresos, gastos desglosados y resultado final.</li>
      </ul>
      <div class="help-warning">⚠️ Los informes se recalculan automáticamente cada vez que los abres, reflejando los datos actuales del sistema.</div>
    </div>
  </div>
  `;

  window.helpTab = function(event, tab) {
    document.querySelectorAll(".help-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".help-tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("help-panel-" + tab)?.classList.add("active");
    event.target.classList.add("active");
  };

  closeAllDrops();
  closeSearchDrop();
  return;
}

} // fin setSection

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

  // Secciones fijas
  const secciones = [
    { label: "Métricas", section: "metricas" },
    { label: "Tiendas", section: "tiendas" },
    { label: "Pedidos", section: "pedidos" },
    { label: "Facturas", section: "facturas" },
    { label: "Informes", section: "informes" },
  ].filter(s => s.label.toLowerCase().includes(q))
   .map(s => ({ label: `📂 ${s.label}`, section: s.section, type: "seccion" }));

// Productos reales
  const productos = (window.__allProductos || []).filter(p =>
    (p.title || "").toLowerCase().includes(q)
  ).slice(0, 5).map(p => ({
    label: `📦 ${p.title}`,
    section: "productos",
    type: "producto",
    orderNumber: String(p.id)
  }));

  // Pedidos reales
  const pedidos = (allOrders || []).filter(o =>
    (o.order_number || "").toLowerCase().includes(q) ||
    (o.customer_name || "").toLowerCase().includes(q) ||
    (o.tracking_number || "").toLowerCase().includes(q)
  ).slice(0, 8).map(o => ({
    label: `🛍️ ${o.order_number || "-"} — ${o.customer_name || "-"}`,
    section: "pedidos",
    type: "pedido",
    orderNumber: o.order_number || ""
  }));

  const results = [...secciones, ...productos, ...pedidos].slice(0, 12);

  if (results.length === 0) {
    drop.innerHTML = `<div class="search-empty">${d.ui.notFound}</div>`;
    drop.classList.add("open");
    return;
  }

  drop.innerHTML = results.map(r => `
    <div class="search-item" onclick="goToSearch('${escapeAttr(r.section)}','${escapeAttr(r.orderNumber || "")}')">
      ${escapeHtml(r.label)}
    </div>
  `).join("");

  drop.classList.add("open");
}

function closeSearchDrop() {
  const drop = document.getElementById("searchDrop");
  if (drop) {
    drop.classList.remove("open");
    drop.innerHTML = "";
  }
}

function goToSearch(section, orderNumber) {
  closeSearchDrop();
  const searchEl = document.getElementById("search");
  if (searchEl) searchEl.value = "";

if (section === "productos" && orderNumber) {
    window.__pendingProductoId = orderNumber;
    setSection(section);
    return;
  }

  if (section === "pedidos" && orderNumber) {
    window.__pendingSearchNoti = null;
    setSection(section);
    setTimeout(() => {
      filterOrders(orderNumber);
      const searchEl = document.getElementById("search");
      if (searchEl) searchEl.value = orderNumber;
    }, 400);
  } else {
    setSection(section);
  }
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
      <div class="card" style="padding:20px;">
        <div class="orders-header">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:4px;">
            <div class="tabs" style="margin-bottom:0;border-bottom:none;">
              <span class="tab active" onclick="filterReeByTab(this,'')">Todos</span>
              <span class="tab" onclick="filterReeByTab(this,'pendiente')">Pendiente</span>
              <span class="tab" onclick="filterReeByTab(this,'cobrado')">Pagado</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <input type="date" id="ree-date-from" value=""
                  onchange="renderReembolsos()"
                  style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;color:var(--text);background:var(--card);"/>
                <span style="color:#6b7280;font-size:13px;">—</span>
                <input type="date" id="ree-date-to" value=""
                  onchange="renderReembolsos()"
                  style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;color:var(--text);background:var(--card);"/>
                <select id="ree-shop" onchange="renderReembolsos()"
                  style="padding:7px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
                  <option value="">Todas las tiendas</option>
                </select>
                <button onclick="clearReembolsosFilters()" style="padding:7px 14px;background:#fef2f2;border:1px solid #dc2626;border-radius:8px;color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Limpiar</button>
                <label style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#f0fdf4;border:1px solid #16a34a;border-radius:8px;color:#16a34a;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">
                  ✅ Importar Pagados
                  <input type="file" accept=".pdf" multiple style="display:none;" onchange="importarPagadosPDF(this)">
                </label>
              </div>
          </div>
          <div style="border-bottom:1px solid #e5e7eb;margin-bottom:12px;"></div>

          <div id="ree-counter" style="font-size:13px;color:#6b7280;margin-bottom:8px;padding:0 4px;"></div>

          <div class="orders-table">
            <div class="orders-row head" style="display:grid;grid-template-columns:30px 1fr 1fr 1fr 1fr 1fr 1fr;gap:0;">
              <div>#</div>
              <div>Pedido</div>
              <div>Nº seguimiento</div>
              <div>Fecha de creación</div>
              <div>Nombre del cliente</div>
              <div>Costo</div>
              <div>Estado del pago</div>
            </div>
            <div id="reeBody"><div class="muted" style="padding:16px;">Cargando...</div></div>
          </div>

          <div id="reePagination" style="display:flex;justify-content:center;align-items:center;gap:6px;padding:18px 0 4px;flex-wrap:wrap;"></div>
        </div>
      </div>
    `;
    fetch(`${API_BASE}/api/shopify/stores`, {
      headers: { Authorization: "Bearer " + getActiveToken() }
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
              </div>
      <div id="ads-table-wrap" style="overflow-x:auto;"></div>
    `;
    fetch(`${API_BASE}/api/shopify/stores`, {
      headers: { Authorization: "Bearer " + getActiveToken() }
    }).then(r=>r.json()).then(stores => {
      const sel = document.getElementById("ads-shop-sel");
      if (!sel || !Array.isArray(stores)) return;
      sel.innerHTML = stores.map(s=>`<option value="${s.domain}">${escapeHtml(s.shop_name||s.domain)}</option>`).join("");
      document.getElementById("ads-shop-sel")?.addEventListener("change", loadAdsTable);
      document.getElementById("ads-month-sel")?.addEventListener("change", loadAdsTable);
      document.getElementById("ads-year-sel")?.addEventListener("change", loadAdsTable);
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

  if (key === "nomina") {
    content.innerHTML = `<div id="nomina-wrap">Cargando...</div>`;
    loadNomina();
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

// =========================
// NÓMINA
// =========================
async function loadNomina() {
  const wrap = document.getElementById("nomina-wrap");
  if (!wrap) return;

  const now = new Date();
  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
      <select id="nom-month-sel" style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${monthNames.map((m,i)=>`<option value="${i+1}" ${i===now.getMonth()?"selected":""}>${m}</option>`).join("")}
      </select>
      <select id="nom-year-sel" style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===now.getFullYear()?"selected":""}>${y}</option>`).join("")}
      </select>
      <button onclick="loadNominaData()" style="padding:7px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Ver</button>
      <button onclick="openAddTrabajador()" style="padding:7px 16px;background:#fff;color:#16a34a;border:1px solid #16a34a;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">+ Trabajador</button>
    </div>
    <div id="nomina-content">Cargando...</div>
  `;
  await loadNominaData();
}

async function loadNominaData() {
  const content = document.getElementById("nomina-content");
  if (!content) return;

  const month = parseInt(document.getElementById("nom-month-sel")?.value || new Date().getMonth()+1);
  const year  = parseInt(document.getElementById("nom-year-sel")?.value  || new Date().getFullYear());
  const mes   = `${year}-${String(month).padStart(2,"0")}`;

  try {
    const h = { Authorization: "Bearer " + getActiveToken() };
    const [trabajadores, pagos] = await Promise.all([
      cachedFetch(`${API_BASE}/api/nomina/trabajadores`, { headers: h }),
      cachedFetch(`${API_BASE}/api/nomina/pagos?mes=${mes}`, { headers: h })
    ]);

    if (!Array.isArray(trabajadores) || trabajadores.length === 0) {
      content.innerHTML = `<div style="padding:24px;color:#6b7280;font-size:14px;">No hay trabajadores. Pulsa <strong>+ Trabajador</strong> para añadir.</div>`;
      return;
    }

    const pagosMap = {};
    if (Array.isArray(pagos)) pagos.forEach(p => { pagosMap[p.trabajador_id] = p.valor || 0; });

    const fmt = n => (parseFloat(n)||0).toFixed(2);
    const thS = `padding:11px 14px;border:1px solid #d1fae5;font-weight:600;color:#fff;text-align:`;
    const inp = `width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:inherit;background:var(--card);color:var(--text);box-sizing:border-box;`;

    const totalNomina = trabajadores.reduce((s,t) => s + (parseFloat(pagosMap[t.id])||0), 0);

    content.innerHTML = `
      <div style="background:var(--card);border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#16a34a;">
              <th style="${thS}left;">TRABAJADOR</th>
              <th style="${thS}right;">PAGO DEL MES (€)</th>
              <th style="${thS}center;">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            ${trabajadores.map(t => `
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;">${escapeHtml(t.nombre)}</td>
                <td style="padding:8px 14px;border:1px solid #e5e7eb;">
                  <input type="number" step="0.01" min="0"
                    value="${fmt(pagosMap[t.id]||0)}"
                    data-id="${t.id}" data-mes="${mes}"
                    onchange="saveNominaPago(this)"
                    style="${inp}text-align:right;">
                </td>
                <td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:center;">
                  <button onclick="deleteTrabajador(${t.id})"
                    style="padding:4px 12px;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font-size:12px;cursor:pointer;">
                    Eliminar
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr style="background:#f0fdf4;">
              <td style="padding:11px 14px;border:1px solid #e5e7eb;font-weight:700;">TOTAL NÓMINA</td>
              <td style="padding:11px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:700;color:#16a34a;">${fmt(totalNomina)} €</td>
              <td style="border:1px solid #e5e7eb;"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  } catch(e) {
    content.innerHTML = `<div style="color:#dc2626;padding:16px;">Error cargando nómina: ${e.message}</div>`;
  }
}

async function saveNominaPago(input) {
  const trabajador_id = parseInt(input.dataset.id);
  const mes = input.dataset.mes;
  const valor = parseFloat(input.value) || 0;
  try {
    window.__showLoadingBar?.("Guardando nómina...");
    await fetch(`${API_BASE}/api/nomina/pagos`, {
      method: "PUT",
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
      body: JSON.stringify({ trabajador_id, mes, valor })
    });
    window.__hideLoadingBar?.();
    invalidateCache("nomina");
    input.style.borderColor = "#16a34a";
    setTimeout(() => { input.style.borderColor = "#e5e7eb"; }, 1500);
    await loadNominaData();
  } catch(e) { window.__hideLoadingBar?.(); console.error(e); }
}

async function deleteTrabajador(id) {
  if (!confirm("¿Eliminar trabajador y todos sus pagos?")) return;
  try {
    await fetch(`${API_BASE}/api/nomina/trabajadores/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + getActiveToken() }
    });
    await loadNominaData();
  } catch(e) { console.error(e); }
}

function openAddTrabajador() {
  const nombre = prompt("Nombre del trabajador:");
  if (!nombre || !nombre.trim()) return;
  fetch(`${API_BASE}/api/nomina/trabajadores`, {
    method: "POST",
    headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
    body: JSON.stringify({ nombre: nombre.trim() })
  }).then(r => r.json()).then(data => {
    if (data.id) loadNominaData();
    else alert("Error: " + (data.error||"desconocido"));
  }).catch(e => alert("Error: " + e.message));
}

window.loadNomina        = loadNomina;
window.loadNominaData    = loadNominaData;
window.saveNominaPago    = saveNominaPago;
window.deleteTrabajador  = deleteTrabajador;
window.openAddTrabajador = openAddTrabajador;

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

  const inp = (id, ph, type="text") => `<input id="${id}" type="${type}" placeholder="${ph}" style="width:100%;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;box-sizing:border-box;">`;

  if (type === "profile") {
    title.textContent = "Perfil";
    subtitle.textContent = "Datos de la cuenta";
    crumb.textContent = "Perfil";

    box.innerHTML = `<div style="max-width:480px;">
      <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:28px;">
        <div style="position:relative;cursor:pointer;" onclick="document.getElementById('avatar-input').click()">
          <div id="avatar-circle" style="width:96px;height:96px;border-radius:50%;background:linear-gradient(135deg,rgba(22,163,74,.35),rgba(22,163,74,.05));border:2px solid #e5e7eb;overflow:hidden;display:flex;align-items:center;justify-content:center;">
            <svg id="avatar-placeholder-icon" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#9ca3af" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <img id="avatar-img" style="display:none;width:100%;height:100%;object-fit:cover;" />
          </div>
          <div style="position:absolute;bottom:2px;right:2px;background:#16a34a;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>
        </div>
        <input type="file" id="avatar-input" accept="image/*" style="display:none;" onchange="handleAvatarChange(event)">
        <div style="margin-top:12px;font-weight:700;font-size:15px;">${escapeHtml(currentUser.name)}</div>
        <span style="margin-top:4px;padding:3px 14px;background:#dcfce7;color:#16a34a;border-radius:20px;font-size:12px;font-weight:600;">${escapeHtml(currentUser.role)}</span>
      </div>

      <div style="border-top:1px solid #e5e7eb;padding-top:22px;">
        <div style="font-weight:700;font-size:14px;margin-bottom:14px;">Cambiar contraseña</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${inp("curr-pass","Contraseña actual","password")}
          ${inp("new-pass","Nueva contraseña","password")}
          ${inp("confirm-pass","Confirmar nueva contraseña","password")}
        </div>
        <div id="pass-msg" style="margin-top:8px;font-size:12px;min-height:16px;"></div>
        <button onclick="changePassword()" style="margin-top:12px;padding:9px 22px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Actualizar contraseña</button>
      </div>
    </div>`;

    // Cargar avatar guardado
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: "Bearer " + getActiveToken() } })
      .then(r => r.json()).then(data => {
        if (data.user?.avatar_url) {
          document.getElementById("avatar-img").src = data.user.avatar_url;
          document.getElementById("avatar-img").style.display = "block";
          document.getElementById("avatar-placeholder-icon").style.display = "none";
        }
      }).catch(() => {});
  }

  if (type === "settings") {
    title.textContent = "Ajustes";
    subtitle.textContent = "Configuración de la cuenta";
    crumb.textContent = "Ajustes";

    box.innerHTML = `<div style="max-width:520px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:4px;">Datos de facturación</div>
      <div style="color:#6b7280;font-size:13px;margin-bottom:20px;">Información de tu empresa para la facturación</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${inp("bill-name","Nombre o razón social")}
        ${inp("bill-nif","NIF / CIF")}
        ${inp("bill-address","Dirección")}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          ${inp("bill-city","Ciudad")}
          ${inp("bill-zip","Código postal")}
        </div>
        ${inp("bill-country","País")}
      </div>
      <div id="billing-msg" style="margin-top:10px;font-size:12px;min-height:16px;"></div>
      <button onclick="saveBillingData()" style="margin-top:14px;padding:9px 22px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Actualizar datos de facturación</button>

      <div style="border-top:1px solid #fee2e2;margin-top:36px;padding-top:24px;">
        <div style="font-weight:700;font-size:14px;color:#dc2626;margin-bottom:6px;">Zona de peligro</div>
        <div style="color:#6b7280;font-size:13px;margin-bottom:16px;">Al cancelar tu cuenta se eliminarán permanentemente todos tus datos y no podrás recuperarlos.</div>
        <button onclick="showCancelAccount()" style="padding:9px 22px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Cancelar cuenta</button>
      </div>
    </div>`;

    // Cargar datos de facturación guardados
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: "Bearer " + getActiveToken() } })
      .then(r => r.json()).then(data => {
        const u = data.user || {};
        const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
        set("bill-name",    u.billing_name);
        set("bill-nif",     u.billing_nif);
        set("bill-address", u.billing_address);
        set("bill-city",    u.billing_city);
        set("bill-zip",     u.billing_zip);
        set("bill-country", u.billing_country);
      }).catch(() => {});
  }

  closeAllDrops();
}

async function handleAvatarChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    // Mostrar preview
    const img = document.getElementById("avatar-img");
    const icon = document.getElementById("avatar-placeholder-icon");
    if (img) { img.src = dataUrl; img.style.display = "block"; }
    if (icon) icon.style.display = "none";
    // Subir al servidor
    try {
      const res = await fetch(`${API_BASE}/api/auth/avatar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
        body: JSON.stringify({ avatar_url: dataUrl })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Error al guardar la imagen"); }
      else {
        // Actualizar avatar en header
        const headerAvatar = document.querySelector(".user-avatar");
        if (headerAvatar) {
          headerAvatar.style.backgroundImage = `url('${dataUrl}')`;
          headerAvatar.style.backgroundSize = "cover";
          headerAvatar.style.backgroundPosition = "center";
        }
      }
    } catch { alert("Error al guardar la imagen"); }
  };
  reader.readAsDataURL(file);
}

async function changePassword() {
  const curr = document.getElementById("curr-pass")?.value || "";
  const nuevo = document.getElementById("new-pass")?.value || "";
  const confirm = document.getElementById("confirm-pass")?.value || "";
  const msg = document.getElementById("pass-msg");
  if (!curr || !nuevo || !confirm) { if (msg) { msg.style.color="#dc2626"; msg.textContent="Rellena todos los campos."; } return; }
  if (nuevo !== confirm) { if (msg) { msg.style.color="#dc2626"; msg.textContent="Las contraseñas no coinciden."; } return; }
  try {
    const res = await fetch(`${API_BASE}/api/auth/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ current_password: curr, new_password: nuevo })
    });
    const data = await res.json();
    if (!res.ok) { if (msg) { msg.style.color="#dc2626"; msg.textContent=data.error||"Error al cambiar contraseña."; } }
    else {
      if (msg) { msg.style.color="#16a34a"; msg.textContent="Contraseña actualizada correctamente."; }
      document.getElementById("curr-pass").value = "";
      document.getElementById("new-pass").value = "";
      document.getElementById("confirm-pass").value = "";
    }
  } catch { if (msg) { msg.style.color="#dc2626"; msg.textContent="Error de conexión."; } }
}

async function saveBillingData() {
  const msg = document.getElementById("billing-msg");
  const body = {
    billing_name:    document.getElementById("bill-name")?.value    || null,
    billing_nif:     document.getElementById("bill-nif")?.value     || null,
    billing_address: document.getElementById("bill-address")?.value || null,
    billing_city:    document.getElementById("bill-city")?.value    || null,
    billing_zip:     document.getElementById("bill-zip")?.value     || null,
    billing_country: document.getElementById("bill-country")?.value || null,
  };
  try {
    const res = await fetch(`${API_BASE}/api/auth/billing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { if (msg) { msg.style.color="#dc2626"; msg.textContent=data.error||"Error al guardar."; } }
    else { if (msg) { msg.style.color="#16a34a"; msg.textContent="Datos de facturación actualizados."; } }
  } catch { if (msg) { msg.style.color="#dc2626"; msg.textContent="Error de conexión."; } }
}

function showCancelAccount() {
  const box = document.getElementById("cardBox");
  if (!box) return;
  box.innerHTML += `
    <div id="cancel-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;">
      <div style="background:var(--card);border-radius:14px;padding:32px;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="font-weight:700;font-size:16px;color:#dc2626;margin-bottom:8px;">¿Cancelar tu cuenta?</div>
        <div style="color:#6b7280;font-size:13px;margin-bottom:20px;">Esta acción es irreversible. Se eliminarán todos tus datos. Escribe tu contraseña para confirmar.</div>
        <input type="password" id="cancel-pass" placeholder="Tu contraseña" style="width:100%;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;box-sizing:border-box;margin-bottom:8px;">
        <div id="cancel-msg" style="font-size:12px;color:#dc2626;min-height:16px;margin-bottom:14px;"></div>
        <div style="display:flex;gap:10px;">
          <button onclick="confirmCancelAccount()" style="flex:1;padding:9px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Sí, cancelar mi cuenta</button>
          <button onclick="document.getElementById('cancel-overlay').remove()" style="flex:1;padding:9px;background:#e5e7eb;color:#374151;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Volver</button>
        </div>
      </div>
    </div>`;
}

async function confirmCancelAccount() {
  const pass = document.getElementById("cancel-pass")?.value || "";
  const msg = document.getElementById("cancel-msg");
  if (!pass) { if (msg) msg.textContent = "Escribe tu contraseña."; return; }
  try {
    const res = await fetch(`${API_BASE}/api/auth/account`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ password: pass })
    });
    const data = await res.json();
    if (!res.ok) { if (msg) msg.textContent = data.error || "Error al cancelar la cuenta."; }
    else { localStorage.clear(); location.href = "/login.html"; }
  } catch { if (msg) msg.textContent = "Error de conexión."; }
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
window.handleAvatarChange = handleAvatarChange;
window.changePassword = changePassword;
window.saveBillingData = saveBillingData;
window.showCancelAccount = showCancelAccount;
window.confirmCancelAccount = confirmCancelAccount;

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
        Authorization: "Bearer " + getActiveToken(),
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
          Authorization: "Bearer " + getActiveToken(),
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
    const stores = await cachedFetch(`${API_BASE}/api/shopify/stores`, {
      headers: { Authorization: "Bearer " + getActiveToken() }
    });

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
  let shop = document.getElementById("pf-shop-domain")?.value.trim();
  const accessToken = document.getElementById("pf-access-token")?.value.trim();

  if (!shop) { alert("Introduce el dominio de la tienda"); return; }
  if (!accessToken) { alert("Introduce el Access Token"); return; }
  if (!shop.includes(".myshopify.com")) shop = shop + ".myshopify.com";

  try {
    const res = await fetch(`${API_BASE}/api/shopify/connect-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getActiveToken(),
      },
      body: JSON.stringify({ shop, accessToken }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error conectando tienda");
      return;
    }

    closeShopifyStep4();
    setSection("tiendas");
  } catch (err) {
    alert("Error de conexión");
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

async function toggleUserStatus(userId, active) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getActiveToken(),
      },
      body: JSON.stringify({ active: active ? 1 : 0 }),
    });
    if (!res.ok) {
      alert("Error al cambiar estado");
      setSection("gestion-clientes");
    }
  } catch {
    alert("Error de conexión");
  }
}
window.toggleUserStatus = toggleUserStatus;

async function disableStore(storeId) {
  if (!confirm("¿Seguro que quieres deshabilitar esta tienda?")) return;

  const res = await fetch(
    `${API_BASE}/api/shopify/disable/${storeId}`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + getActiveToken(),
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

  // Leer tiendas seleccionadas por checkbox
  const checkboxes = document.querySelectorAll("#metrics-balance-wrap input[type='checkbox'][value]");
  let dominiosFiltro = [];
  if (checkboxes.length > 0) {
    dominiosFiltro = [...checkboxes].filter(c => c.checked).map(c => c.value);
  } else if (shop) {
    try {
      const parsed = JSON.parse(shop);
      dominiosFiltro = Array.isArray(parsed) ? parsed : [shop];
    } catch { dominiosFiltro = [shop]; }
  }

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  try {
    const h = { Authorization: "Bearer " + getActiveToken() };

    // Llamada al nuevo endpoint de stats — toda la lógica queda en el servidor
    const statsParams = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (dominiosFiltro.length > 0) statsParams.set("shops", dominiosFiltro.join(","));
    const statsRes = await fetch(`${API_BASE}/api/metrics/stats?${statsParams}`, { headers: h });
    const stats = await statsRes.json();

    const total      = stats.total      || 0;
    const pendientes = stats.pendientes  || 0;
    const transito   = stats.en_transito || 0;
    const entregados = stats.entregados  || 0;
    const devueltos  = stats.devueltos   || 0;
    const destruidos = stats.destruidos  || 0;
    const enviados   = stats.enviados    || 0;
    const rojos      = devueltos + destruidos;
    const facturacion = parseFloat(stats.facturacion || 0);

    set("stat-total",      total);
    set("stat-enviados",   enviados);
    set("stat-pendientes", pendientes);
    set("stat-transito",   transito);
    set("stat-entregados", entregados);
    set("stat-devueltos",  devueltos);
    set("stat-destruidos", destruidos);

    // Ads: pequeño fetch por mes (pocos KB)
    let gastoAdsTotal = 0;
    try {
      const dStart = dateFrom ? new Date(dateFrom + "T00:00:00") : new Date();
      const dEnd   = dateTo   ? new Date(dateTo   + "T00:00:00") : new Date();
      const mesesRangoAds = [];
      let curAds = new Date(dStart.getFullYear(), dStart.getMonth(), 1);
      while (curAds <= dEnd) {
        mesesRangoAds.push({ m: curAds.getMonth()+1, y: curAds.getFullYear() });
        curAds.setMonth(curAds.getMonth() + 1);
      }
      const allStoresAds = await cachedFetch(`${API_BASE}/api/shopify/stores`, { headers: h }).catch(()=>[]);
      const adsFetches = (Array.isArray(allStoresAds) ? allStoresAds : []).flatMap(store =>
        mesesRangoAds.map(({ m, y }) =>
          cachedFetch(`${API_BASE}/api/ads?shop=${encodeURIComponent(store.domain)}&month=${m}&year=${y}`, { headers: h })
            .then(rows => Array.isArray(rows) ? rows.map(r => ({ ...r, shop_domain: store.domain })) : []).catch(()=>[])
        )
      );
      const allAdsRows = await Promise.all(adsFetches);
      const flatAdsRows = allAdsRows.flat().filter(r => (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo));
      window.__metricasAdsRows = flatAdsRows;
      const filteredForCPA = dominiosFiltro.length > 0
        ? flatAdsRows.filter(r => dominiosFiltro.includes(r.shop_domain))
        : flatAdsRows;
      filteredForCPA.forEach(r => { gastoAdsTotal += (r.meta||0) + (r.tiktok||0); });
    } catch {}

    const pedidosParaCPA = stats.pedidos_activos || 0;
    const cpa  = (gastoAdsTotal > 0 && pedidosParaCPA > 0) ? gastoAdsTotal / pedidosParaCPA : null;
    const roas = (gastoAdsTotal > 0) ? facturacion / gastoAdsTotal : null;
    const fmtEur = n => (parseFloat(n)||0).toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 }) + " €";
    set("stat-facturacion", fmtEur(facturacion));
    set("stat-cpa",  cpa  != null ? fmtEur(cpa)  : "— €");
    set("stat-roas", roas != null ? roas.toFixed(2) : "—");

    const baseCalc     = enviados > 0 ? enviados : 1;
    const pctEntregado = ((entregados / baseCalc) * 100).toFixed(2);
    const pctRojo      = ((rojos      / baseCalc) * 100).toFixed(2);
    const pctPendiente = ((transito   / baseCalc) * 100).toFixed(2);

    set("donut-pct",       pctEntregado + "%");
    set("legend-entregado", `Entregado ${pctEntregado}% (${entregados})`);
    set("legend-rojo",      `Dev+Dest ${pctRojo}% (${rojos})`);
    set("legend-pendiente", `En tránsito ${pctPendiente}% (${transito})`);
    set("donut-base",       `Base: ${enviados} enviados`);

    function setArc(id, pct, off) {
      const el = document.getElementById(id);
      if (!el) return;
      const p = parseFloat(pct) || 0;
      el.setAttribute("stroke-dasharray", `${p} ${100 - p}`);
      el.setAttribute("stroke-dashoffset", String(-(parseFloat(off)||0)));
    }
    let offset = 0;
    const arcE = parseFloat(pctEntregado);
    const arcR = parseFloat(pctRojo);
    const arcP = parseFloat((100 - arcE - arcR).toFixed(2));
    setArc("donut-entregado", arcE, offset); offset += arcE;
    setArc("donut-rojo",      arcR, offset); offset += arcR;
    setArc("donut-pendiente", arcP, offset);

  } catch(e) {
    console.error("Error cargando métricas:", e);
  }

  await loadMetricasBalance(dateFrom, dateTo);
}

async function loadMetricasBalance(dateFrom, dateTo) {
  const wrap = document.getElementById("metrics-balance-wrap");
  if (!wrap) return;
  window.__showLoadingBar?.("Cargando balance...");

  const fmt = n => (parseFloat(n)||0).toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const MRW_COMISION = 0.67;
  const TARJETA_PCT  = 0.04;

  let stores = [], orders = [], manuales = [];
  try {
    const token = getActiveToken();
    const h = { Authorization: "Bearer " + token };
    const _balParams = new URLSearchParams();
    if (dateFrom) _balParams.set("from", dateFrom);
    if (dateTo)   _balParams.set("to",   dateTo);
    [stores, orders] = await Promise.all([
      cachedFetch(`${API_BASE}/api/shopify/stores`, { headers: h }).then(d => Array.isArray(d) ? d : []),
      fetch(`${API_BASE}/api/orders?${_balParams}`, { headers: h }).then(r => r.json()).then(d => Array.isArray(d) ? d : (d?.orders || []))
    ]);
  } catch {}

  // Orders already filtered server-side by dateFrom/dateTo
  const ordersRango = orders;

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmtD = d => d.toISOString().split("T")[0];
  const mesActual = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const mesFrom = dateFrom ? dateFrom.slice(0,7) : mesActual;

  try { 
    const r = await fetch(`${API_BASE}/api/shopify/informes-ingresos?mes=${mesFrom}`, { headers: { Authorization: "Bearer " + getActiveToken() } });
    manuales = await r.json(); 
    if (!Array.isArray(manuales)) manuales = []; 
  } catch {}

  const numTiendas = stores.length || 1;

  // Calcular todos los meses del rango
  const mesesRango = [];
  const dStart = dateFrom ? new Date(dateFrom + "T00:00:00") : new Date();
  const dEnd   = dateTo   ? new Date(dateTo   + "T00:00:00") : new Date();
  let cur = new Date(dStart.getFullYear(), dStart.getMonth(), 1);
  while (cur <= dEnd) {
    mesesRango.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  if (mesesRango.length === 0) mesesRango.push(mesFrom);

  // Gastos fijos, varios, extras, nómina, IVA, stock, variantes — TODO EN PARALELO CON CACHÉ
  let totalOtrosFijos = 0;
  let gastosVarios = {};
  const token2 = getActiveToken();
  const h2 = { Authorization: "Bearer " + token2 };
  await Promise.all(mesesRango.map(async mes => {
    try {
      const gf = await cachedFetch(`${API_BASE}/api/gastos-fijos?mes=${mes}`, { headers: h2 });
      if (Array.isArray(gf)) {
        totalOtrosFijos += gf.filter(g=>!["MRW","LOGÍSTICA"].includes(g.nombre)).reduce((s,g)=>s+(parseFloat(g.valor)||0),0);
      }
    } catch {}
    try {
      const rows = await cachedFetch(`${API_BASE}/api/gastos-varios?mes=${mes}`, { headers: h2 });
      if (Array.isArray(rows)) rows.forEach(r => { gastosVarios[r.shop_domain] = (gastosVarios[r.shop_domain]||0) + (r.shopify||0); });
    } catch {}
  }));
  const fijoXTienda = totalOtrosFijos / numTiendas;

  let gastosExtrasMetricas = {};
  await Promise.all(mesesRango.map(async mes => {
    try {
      const rows = await cachedFetch(`${API_BASE}/api/gastos-varios/extras?mes=${mes}`, { headers: h2 });
      if (Array.isArray(rows)) rows.forEach(r => {
        if (!gastosExtrasMetricas[r.shop_domain]) gastosExtrasMetricas[r.shop_domain] = [];
        gastosExtrasMetricas[r.shop_domain].push(r);
      });
    } catch {}
  }));

  let nominaXTienda = 0;
  try {
    const nominaTotales = await Promise.all(mesesRango.map(mes =>
      cachedFetch(`${API_BASE}/api/nomina/total?mes=${mes}`, { headers: h2 }).catch(()=>({total:0}))
    ));
    nominaTotales.forEach(n => { nominaXTienda += (parseFloat(n.total) || 0) / numTiendas; });
  } catch {}

  // IVA desde base de datos
  let ivaPorcentaje = 0.21;
  try {
    const impData = await cachedFetch(`${API_BASE}/api/impuestos`, { headers: h2 });
    if (Array.isArray(impData) && impData.length > 0) {
      ivaPorcentaje = (impData[0].porcentaje !== null && impData[0].porcentaje !== undefined ? parseFloat(impData[0].porcentaje) : 21) / 100;
    }
  } catch {}

  let preciosGlobales = { precio_mrw: 0, precio_logistica: 0 };
  try { preciosGlobales = await cachedFetch(`${API_BASE}/api/shopify/precios-globales`, { headers: h2 }) || preciosGlobales; } catch {}

    // Ads — EN PARALELO CON CACHÉ
  let adsSpends = {};
  try {
    const token = getActiveToken();
    const adsResults = await Promise.all(
      mesesRango.flatMap(mes => {
        const m = parseInt(mes.split("-")[1]);
        const y = parseInt(mes.split("-")[0]);
        return stores.map(store =>
          cachedFetch(`${API_BASE}/api/ads?shop=${encodeURIComponent(store.domain)}&month=${m}&year=${y}`, {
            headers: { Authorization: "Bearer " + token }
          }).then(rows => ({ domain: store.domain, rows: Array.isArray(rows) ? rows : [] }))
           .catch(() => ({ domain: store.domain, rows: [] }))
        );
      })
    );
    for (const { domain, rows } of adsResults) {
      if (!adsSpends[domain]) adsSpends[domain] = { meta:0, tiktok:0 };
      rows.filter(r => (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo))
        .forEach(r => { adsSpends[domain].meta += r.meta||0; adsSpends[domain].tiktok += r.tiktok||0; });
    }
  } catch {}


  const stockMap = {};
  const variantesMap = {};
  try {
    const [_st, _vr] = await Promise.all([
      cachedFetch(`${API_BASE}/api/shopify/stock`, { headers: h2 }),
      cachedFetch(`${API_BASE}/api/shopify/variantes-config`, { headers: h2 })
    ]);
    if (Array.isArray(_st)) _st.forEach(s => { stockMap[s.product_id] = s.costo_compra||0; });
    if (Array.isArray(_vr)) _vr.forEach(v => { variantesMap[v.variant_id] = v.unidades_por_venta||1; });
  } catch {}

  const estadosEnvioMRW = ["enviado","en_transito","entregado","franquicia","en_preparacion","devuelto","destruido"];
  const pedidosBase = ordersRango.filter(o => !["cancelado","pendiente"].includes(o.fulfillment_status));
  const enviosGlobalesMRW = pedidosBase.filter(o => estadosEnvioMRW.includes(o.fulfillment_status));
  const devueltosTodas = enviosGlobalesMRW.filter(o=>o.fulfillment_status==="devuelto").length;
  const totalEnviosGlobales = enviosGlobalesMRW.length + devueltosTodas;
  const totalPedidosGlobales = pedidosBase.filter(o=>estadosEnvioMRW.includes(o.fulfillment_status)).length;

  const pedidosTarjeta = ordersRango.filter(o => o.fulfillment_status !== "cancelado");

  const balanceData = stores.map(store => {
    const ads = adsSpends[store.domain] || { meta:0, tiktok:0 };
    const shopify = gastosVarios[store.domain] || 0;

    const pedEnt = ordersRango.filter(o => o.shop_domain === store.domain && o.fulfillment_status === "entregado");
    const pedCOD = pedEnt.filter(o => { try { const raw=o.raw_json?(typeof o.raw_json==="string"?JSON.parse(o.raw_json):o.raw_json):null; const fin=(raw?.financial_status||o.financial_status||"").toLowerCase().trim(); return fin==="pending"||fin==="cod"||fin==="pendiente"; } catch{return false;} });
    const pedPag = pedidosTarjeta.filter(o => o.shop_domain === store.domain && (()=>{ try{ const raw=o.raw_json?(typeof o.raw_json==="string"?JSON.parse(o.raw_json):o.raw_json):null; const fin=(raw?.financial_status||o.financial_status||"").toLowerCase().trim(); return fin==="paid"||fin==="pagado"; }catch{return false;} })());
    const tCOD = pedCOD.reduce((s,o)=>s+(parseFloat(o.total_price)||0),0);
    const tPag = pedPag.reduce((s,o)=>s+(parseFloat(o.total_price)||0),0);
    const man1 = manuales.find(m=>m.shop_domain===store.domain&&m.columna===1)||{valor:0};
    const man2 = manuales.find(m=>m.shop_domain===store.domain&&m.columna===2)||{valor:0};
    const totalIngreso = (tCOD - pedCOD.length*MRW_COMISION) + (tPag - tPag*TARJETA_PCT) + (parseFloat(man1.valor)||0) + (parseFloat(man2.valor)||0);

    const pedTienda = pedidosBase.filter(o => o.shop_domain === store.domain);
    let costoProductos = 0;
    pedTienda.filter(o=>!["devuelto","cancelado","pendiente"].includes(o.fulfillment_status)).forEach(o=>{
      try { const raw=o.raw_json?(typeof o.raw_json==="string"?JSON.parse(o.raw_json):o.raw_json):null; if(!raw?.line_items)return; raw.line_items.forEach(item=>{ costoProductos+=(parseFloat(stockMap[String(item.product_id)])||0)*(parseInt(variantesMap[String(item.variant_id)])||1)*(parseInt(item.quantity)||1); }); } catch{}
    });
    const envTienda = pedTienda.filter(o=>estadosEnvioMRW.includes(o.fulfillment_status));
    const devTienda = envTienda.filter(o=>o.fulfillment_status==="devuelto").length;
    // Precio unitario directo × pedidos del rango (no división del mes)
    const precioMRW      = preciosGlobales.precio_mrw      || 0;
    const precioLogistica = preciosGlobales.precio_logistica || 0;
     const mrw      = precioMRW      * (envTienda.length + devTienda);
    const logistica = precioLogistica * envTienda.length;
    const ivaTotal = pedEnt.reduce((s,o) => s + (parseFloat(o.total_price)||0) * ivaPorcentaje, 0);
    const extrasTotal = (gastosExtrasMetricas[store.domain]||[]).reduce((s,g)=>s+(parseFloat(g.valor)||0),0);
    const totalGasto = ads.meta + ads.tiktok + shopify + costoProductos + mrw + logistica + fijoXTienda + nominaXTienda + extrasTotal + ivaTotal;
    const resultado = totalIngreso - totalGasto;
    return { 
      domain: store.domain, name: store.shop_name||store.domain, totalIngreso, totalGasto, resultado, ivaTotal, ivaPorcentaje,
      numCOD: pedCOD.length, brutoCOD: tCOD, descCOD: pedCOD.length*MRW_COMISION, netoCOD: tCOD - pedCOD.length*MRW_COMISION,
      numTarjeta: pedPag.length, brutoTarjeta: tPag, descTarjeta: tPag*TARJETA_PCT, netoTarjeta: tPag - tPag*TARJETA_PCT,
      man1nom: man1.nombre||"", man1val: parseFloat(man1.valor)||0,
      man2nom: man2.nombre||"", man2val: parseFloat(man2.valor)||0,
      meta: ads.meta, tiktok: ads.tiktok, costoProductos, mrw, logistica, shopify,
      fijoXTienda, nominaXTienda, totalOtrosFijos, numTiendas,
      precioMRW, precioLog: precioLogistica,
      enviosMRW: envTienda.length, devMRW: devTienda,
      extras: gastosExtrasMetricas[store.domain] || []
    };
  });

  window.__metricasBalanceData = balanceData;

  const cols = balanceData.map(d => {
    const resColor = d.resultado >= 0 ? "#16a34a" : "#dc2626";
    const resBg    = d.resultado >= 0 ? "#f0fdf4" : "#fef2f2";
    const resBorder= d.resultado >= 0 ? "#bbf7d0" : "#fecaca";
    return `
      <div style="background:var(--card);border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;" data-domain="${d.domain}">
        <div style="background:#16a34a;padding:10px 14px;">
          <div style="font-weight:700;color:#fff;font-size:14px;">${escapeHtml(d.name)}</div>
          <div style="font-size:11px;color:#bbf7d0;">${d.domain}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tbody>
            <tr style="background:#f0fdf4;"><td colspan="2" style="padding:8px 14px;border:1px solid #e5e7eb;font-weight:700;color:#16a34a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">📥 Ingresos</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">COD<div style="font-size:10px;color:#9ca3af;font-weight:400;">${d.numCOD} pedidos — ${fmt(d.brutoCOD)} € bruto</div><div style="font-size:10px;color:#dc2626;">Comisión MRW (${d.numCOD}×0.67€) = −${fmt(d.descCOD)}€</div></td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;color:#374151;font-weight:600;">${fmt(d.netoCOD)} €</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">TARJETA<div style="font-size:10px;color:#9ca3af;font-weight:400;">${d.numTarjeta} pedidos — ${fmt(d.brutoTarjeta)} € bruto</div><div style="font-size:10px;color:#dc2626;">Comisión tarjeta (4%) = −${fmt(d.descTarjeta)}€</div></td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;color:#374151;font-weight:600;">${fmt(d.netoTarjeta)} €</td></tr>
            ${d.man1val > 0 ? `<tr><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">${escapeHtml(d.man1nom||"Extra 1")}</td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;">${fmt(d.man1val)} €</td></tr>` : ""}
            ${d.man2val > 0 ? `<tr style="background:#f9fafb;"><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">${escapeHtml(d.man2nom||"Extra 2")}</td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;">${fmt(d.man2val)} €</td></tr>` : ""}
            <tr style="background:#f0fdf4;"><td style="padding:8px 14px;border:1px solid #bbf7d0;font-weight:700;color:#16a34a;">Total Ingresos</td><td style="padding:8px 14px;border:1px solid #bbf7d0;text-align:right;font-weight:700;color:#16a34a;">${fmt(d.totalIngreso)} €</td></tr>
            <tr style="background:#fef2f2;"><td colspan="2" style="padding:8px 14px;border:1px solid #e5e7eb;font-weight:700;color:#dc2626;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">📤 Gastos</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">Gasto Meta</td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(d.meta)} €</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">Gasto TikTok</td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(d.tiktok)} €</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">Productos<div style="font-size:10px;color:#9ca3af;">costo × uds × qty</div></td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(d.costoProductos)} €</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">MRW<div style="font-size:10px;color:#9ca3af;">${fmt(d.precioMRW)}€/ud × ${d.enviosMRW} envíos + ${d.devMRW} dev.</div></td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(d.mrw)} €</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">Logística<div style="font-size:10px;color:#9ca3af;">${fmt(d.precioLog)}€/ud × ${d.enviosMRW} envíos</div></td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(d.logistica)} €</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">Gastos Fijos<div style="font-size:10px;color:#9ca3af;">${fmt(d.totalOtrosFijos)}€ ÷ ${d.numTiendas} tiendas</div></td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(d.fijoXTienda)} €</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">Nómina<div style="font-size:10px;color:#9ca3af;">Total nómina ÷ ${d.numTiendas} tiendas</div></td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(d.nominaXTienda)} €</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">Shopify</td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(d.shopify)} €</td></tr>
            ${(d.extras||[]).filter(g=>g.nombre||g.valor>0).map(g=>`<tr><td style="padding:8px 14px;border:1px solid #e5e7eb;color:#374151;font-weight:600;">${escapeHtml(g.nombre||'Concepto extra')}</td><td style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(g.valor)} €</td></tr>`).join("")}
            <tr style="background:#fefce8;"><td style="padding:8px 14px;border:1px solid #fef08a;color:#854d0e;font-weight:600;">IVA (${(d.ivaPorcentaje*100).toFixed(0)}%)<div style="font-size:10px;color:#a16207;">${d.numCOD + d.numTarjeta} pedidos entregados × ${(d.ivaPorcentaje*100).toFixed(0)}%</div></td><td style="padding:8px 14px;border:1px solid #fef08a;text-align:right;color:#854d0e;font-weight:600;">${fmt(d.ivaTotal)} €</td></tr>
             <tr style="background:#fef2f2;"><td style="padding:8px 14px;border:1px solid #fecaca;font-weight:700;color:#dc2626;">Total Gastos</td><td style="padding:8px 14px;border:1px solid #fecaca;text-align:right;font-weight:700;color:#dc2626;">− ${fmt(d.totalGasto)} €</td></tr>
            <tr style="background:${resBg};"><td style="padding:12px 14px;border:1px solid ${resBorder};font-weight:700;color:${resColor};font-size:14px;">RESULTADO</td><td style="padding:12px 14px;border:1px solid ${resBorder};text-align:right;font-weight:800;color:${resColor};font-size:16px;">${fmt(d.resultado)} €</td></tr>
          </tbody>
        </table>
      </div>`;       
  }).join("");

  const storeCheckboxes = balanceData.map(d =>
    `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:13px;color:var(--text);border-bottom:1px solid #f3f4f6;">
      <input type="checkbox" checked value="${d.domain}" onchange="recalcMetricasBalance()" style="width:15px;height:15px;accent-color:#16a34a;cursor:pointer;">
      ${escapeHtml(d.name)}
    </label>`
  ).join("");

  wrap.innerHTML = `
    <div style="display:flex;gap:20px;align-items:flex-start;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">📊 Balance por tienda <span style="font-size:11px;font-weight:400;color:#6b7280;font-style:italic;">(Esto es un estimado basado en el rango de fecha seleccionado y los precios Unt de MRW y Logística, tu balance final por mes lo puedes ver en Ingresos - Balance Final)</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;" id="met-bal-cols">${cols}</div>
        <div id="met-bal-sumatoria" style="margin-top:20px;padding:16px 20px;background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;">
          <div style="font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Sumatoria seleccionada</div>
          <div id="met-bal-filas" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;"></div>
          <div style="border-top:2px solid #16a34a;padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:15px;color:#374151;">TOTAL</span>
            <span id="met-bal-total" style="font-weight:800;font-size:22px;"></span>
          </div>
        </div>
      </div>
       <div style="width:200px;flex-shrink:0;background:var(--card);border:1px solid #e5e7eb;border-radius:12px;padding:14px;position:sticky;top:0px;align-self:flex-start;">
        <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Filtrar tiendas</div>
        <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:13px;font-weight:700;color:var(--text);border-bottom:2px solid #e5e7eb;margin-bottom:4px;">
          <input type="checkbox" id="met-bal-check-all" checked onchange="toggleAllMetricasBalance(this.checked)" style="width:15px;height:15px;accent-color:#16a34a;cursor:pointer;">
          Todas las tiendas
        </label>
        ${storeCheckboxes}
      </div>
    </div>
  `;
  recalcMetricasBalance();
  window.__hideLoadingBar?.();
}

function recalcMetricasBalance() {
  const data = window.__metricasBalanceData || [];
  const checks = document.querySelectorAll("#metrics-balance-wrap input[type='checkbox'][value]");
  const sel = new Set([...checks].filter(c=>c.checked).map(c=>c.value));
  const filtradas = data.filter(d=>sel.has(d.domain));
  const fmt = n => (parseFloat(n)||0).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});
  document.querySelectorAll("#met-bal-cols > div[data-domain]").forEach(card => { card.style.display = sel.has(card.dataset.domain) ? "" : "none"; });
  const total = filtradas.reduce((s,d)=>s+d.resultado,0);
  const filasEl = document.getElementById("met-bal-filas");
  const totalEl = document.getElementById("met-bal-total");
  if (filasEl) filasEl.innerHTML = filtradas.map(d => `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:8px 14px;font-size:12px;min-width:140px;"><div style="color:#6b7280;font-weight:600;margin-bottom:4px;">${escapeHtml(d.name)}</div><div style="font-size:11px;color:#9ca3af;">Ingreso: <span style="color:#16a34a;font-weight:600;">${fmt(d.totalIngreso)} €</span></div><div style="font-size:11px;color:#9ca3af;">Gasto: <span style="color:#dc2626;font-weight:600;">${fmt(d.totalGasto)} €</span></div><div style="font-size:13px;font-weight:700;color:${d.resultado>=0?'#16a34a':'#dc2626'};margin-top:4px;border-top:1px solid #f3f4f6;padding-top:4px;">${fmt(d.resultado)} €</div></div>`).join("");
  if (totalEl) { totalEl.textContent = fmt(total) + " €"; totalEl.style.color = total>=0?"#16a34a":"#dc2626"; }
  const allCheck = document.getElementById("met-bal-check-all");
  if (allCheck) allCheck.checked = filtradas.length === data.length;

  // Sincronizar filtro oculto y refrescar métricas
  const shopSeleccionada = filtradas.length === data.length ? "" : filtradas.map(d => d.domain);
  let hiddenInput = document.getElementById("met-bal-shop-filter-val");
  if (!hiddenInput) {
    hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.id = "met-bal-shop-filter-val";
    document.body.appendChild(hiddenInput);
  }
  hiddenInput.value = Array.isArray(shopSeleccionada) ? JSON.stringify(shopSeleccionada) : (shopSeleccionada || "");

  // Cancelar petición anterior si aún estaba en curso
  if (window.__metricasUpdateId) clearTimeout(window.__metricasUpdateId);
  window.__metricasUpdateId = setTimeout(async () => {
    await actualizarMetricasSinBalance();
    window.__metricasUpdateId = null;
  }, 150);
}
window.recalcMetricasBalance = recalcMetricasBalance;

function toggleAllMetricasBalance(checked) {
  document.querySelectorAll("#metrics-balance-wrap input[type='checkbox'][value]").forEach(c=>c.checked=checked);
  recalcMetricasBalance();
}
window.toggleAllMetricasBalance = toggleAllMetricasBalance;
window.loadMetricasBalance = loadMetricasBalance;

async function actualizarMetricasSinBalance() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmtD = d => d.toISOString().split("T")[0];
  const dateFrom = document.getElementById("metrics-date-from")?.value || fmtD(firstDay);
  const dateTo   = document.getElementById("metrics-date-to")?.value   || fmtD(now);
  const shopFiltro = document.getElementById("met-bal-shop-filter-val")?.value || "";

  // Leer checkboxes para filtro de tiendas
  const checkboxesAct = document.querySelectorAll("#metrics-balance-wrap input[type='checkbox'][value]");
  let dominiosAct = [];
  if (checkboxesAct.length > 0) {
    dominiosAct = [...checkboxesAct].filter(c => c.checked).map(c => c.value);
  } else if (shopFiltro) {
    try {
      const parsed = JSON.parse(shopFiltro);
      dominiosAct = Array.isArray(parsed) ? parsed : [shopFiltro];
    } catch { dominiosAct = [shopFiltro]; }
  }
  const shopsFiltered = dominiosAct.length > 0 && dominiosAct.length < checkboxesAct.length ? dominiosAct : [];

  try {
    const h = { Authorization: "Bearer " + getActiveToken() };
    const statsParams = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (shopsFiltered.length > 0) statsParams.set("shops", shopsFiltered.join(","));
    const stats = await fetch(`${API_BASE}/api/metrics/stats?${statsParams}`, { headers: h }).then(r => r.json());

    const total      = stats.total      || 0;
    const pendientes = stats.pendientes  || 0;
    const transito   = stats.en_transito || 0;
    const entregados = stats.entregados  || 0;
    const devueltos  = stats.devueltos   || 0;
    const destruidos = stats.destruidos  || 0;
    const enviados   = stats.enviados    || 0;
    const facturacion = parseFloat(stats.facturacion || 0);
    const rojos      = devueltos + destruidos;
    const baseCalc   = enviados > 0 ? enviados : 1;
    const pctEntregado = ((entregados / baseCalc) * 100).toFixed(2);
    const pctRojo      = ((rojos      / baseCalc) * 100).toFixed(2);
    const pctPendiente = ((transito   / baseCalc) * 100).toFixed(2);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("stat-total",      total);
    set("stat-enviados",   enviados);
    set("stat-pendientes", pendientes);
    set("stat-transito",   transito);
    set("stat-entregados", entregados);
    set("stat-devueltos",  devueltos);
    set("stat-destruidos", destruidos);

    const fmtEurSB = n => (parseFloat(n)||0).toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 }) + " €";
    set("stat-facturacion", fmtEurSB(facturacion));

    // CPA y ROAS usando ads cacheados filtrados por tienda activa
    const adsRowsAll = window.__metricasAdsRows || [];
    const adsFiltered = shopsFiltered.length > 0
      ? adsRowsAll.filter(r => shopsFiltered.includes(r.shop_domain))
      : adsRowsAll;
    const gastoAds = adsFiltered.reduce((s,r) => s + (r.meta||0) + (r.tiktok||0), 0);
    const pedidosActivos = stats.pedidos_activos || 0;
    const cpa  = (gastoAds > 0 && pedidosActivos > 0) ? gastoAds / pedidosActivos : null;
    const roas = (gastoAds > 0) ? facturacion / gastoAds : null;
    set("stat-cpa",  cpa  != null ? fmtEurSB(cpa)  : "— €");
    set("stat-roas", roas != null ? roas.toFixed(2) : "—");

    set("donut-pct",        pctEntregado + "%");
    set("legend-entregado", `Entregado ${pctEntregado}% (${entregados})`);
    set("legend-rojo",      `Dev+Dest ${pctRojo}% (${rojos})`);
    set("legend-pendiente", `En tránsito ${pctPendiente}% (${transito})`);
    set("donut-base",       `Base: ${enviados} enviados`);

    let offset = 0;
    function setArc(id, pct, off) {
      const el = document.getElementById(id);
      if (!el) return;
      const p = parseFloat(pct) || 0;
      el.setAttribute("stroke-dasharray", `${p} ${100 - p}`);
      el.setAttribute("stroke-dashoffset", String(-(parseFloat(off) || 0)));
    }
    const arcE2 = parseFloat(pctEntregado);
    const arcR2 = parseFloat(pctRojo);
    const arcP2 = parseFloat((100 - arcE2 - arcR2).toFixed(2));
    setArc("donut-entregado", arcE2, offset);
    offset += arcE2;
    setArc("donut-rojo",      arcR2, offset);
    offset += arcR2;
    setArc("donut-pendiente", arcP2, offset);
  } catch(e) {
    console.error(e);
  }
}
window.actualizarMetricasSinBalance = actualizarMetricasSinBalance;

async function loadProductos() {
  const wrap = document.getElementById("productos-wrap");
  if (!wrap) return;
  window.__showLoadingBar?.("Cargando productos...");

  try {
    const token = getActiveToken();
    const h = { Authorization: "Bearer " + token };
    const [data, stockData, variantesData] = await Promise.all([
      cachedFetch(`${API_BASE}/api/shopify/products`, { headers: h }),
      cachedFetch(`${API_BASE}/api/shopify/stock`, { headers: h }),
      cachedFetch(`${API_BASE}/api/shopify/variantes-config`, { headers: h })
    ]);

    const variantesMap = {};
    if (Array.isArray(variantesData)) {
      variantesData.forEach(v => { variantesMap[v.variant_id] = v.unidades_por_venta; });
    }

    // Mapa de stock por product_id
    const stockMap = {};
    if (Array.isArray(stockData)) {
      stockData.forEach(s => { stockMap[s.product_id] = s; });
    }

    if (!Array.isArray(data) || data.length === 0) {
      wrap.innerHTML = `<div class="muted" style="padding:16px;">No hay productos activos.</div>`;
      return;
    }

// Guardar productos para el buscador y notificaciones
    window.__allProductos = (data || []).flatMap(s => (s.products || []).map(p => ({ ...p, shop_name: s.shop_name, shop_domain: s.shop_domain })));
    window.__productosNombreMap = {};
    window.__allProductos.forEach(p => { window.__productosNombreMap[String(p.id)] = p.title; });

    // Filtro de tienda seleccionado
    const shopFilter = document.getElementById("productos-shop-filter")?.value || "";

    const filtered = shopFilter ? data.filter(s => s.shop_domain === shopFilter) : data;

    wrap.innerHTML = filtered.map(shop => `
      <div style="margin-bottom:32px;">
        <h3 style="font-size:15px;font-weight:700;color:#16a34a;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
          🏪 ${escapeHtml(shop.shop_name)}
          <span style="font-size:12px;color:#9ca3af;font-weight:400;margin-left:8px;">${shop.products.length} productos</span>
        </h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left;font-weight:600;color:#374151;width:60px;">Imagen</th>
              <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left;font-weight:600;color:#374151;">Producto</th>
              <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left;font-weight:600;color:#374151;">Variantes & SKU</th>
              <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;font-weight:600;color:#374151;width:120px;">Stock</th>
            </tr>
          </thead>
          <tbody>
            ${shop.products.map(p => {
              const pid = String(p.id);
              const stockInfo = stockMap[pid] || { stock: 0, stock_minimo: 5 };
              const stockBajo = stockInfo.stock <= stockInfo.stock_minimo;
              return `
              <tr data-pid="${pid}" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
                <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;">
                  ${p.image
                    ? `<img src="${p.image}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;">`
                    : `<div style="width:48px;height:48px;border-radius:6px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>`
                  }
                </td>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#111827;vertical-align:top;">
                  <span class="producto-nombre">${escapeHtml(p.title)}</span>
                  <div style="margin-top:8px;display:flex;align-items:center;gap:6px;">
                    <span style="font-size:11px;color:#9ca3af;white-space:nowrap;">Costo compra:</span>
                    <input type="number" min="0" step="0.01"
                      value="${stockInfo.costo_compra || ''}"
                      placeholder="0.00"
                      style="width:80px;padding:3px 6px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;text-align:right;font-family:inherit;background:var(--card);color:var(--text);"
                      onchange="guardarCostoCompra('${shop.shop_domain}','${pid}',this.value)"
                      title="Costo de compra del producto">
                    <span style="font-size:11px;color:#9ca3af;">€</span>
                  </div>
                </td>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;vertical-align:top;">
                  ${p.variants.map(v => {
                    const vid = String(v.id);
                    const uds = variantesMap[vid] || 1;
                    return `
                    <div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid #f3f4f6;">
                      <span style="font-size:12px;color:#374151;flex:1;">${escapeHtml(v.title)}</span>
                      <span style="font-size:11px;color:#9ca3af;white-space:nowrap;">uds/venta:</span>
                      <input type="number" min="1" value="${uds}"
                        style="width:52px;padding:3px 6px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;text-align:center;font-family:inherit;background:var(--card);color:var(--text);"
                        onchange="guardarVarianteConfig('${shop.shop_domain}','${vid}',this.value)"
                        title="Unidades reales que consume esta variante">
                    </div>`;
                  }).join("")}
                </td>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;vertical-align:middle;">
                  <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                    <input type="number" min="0" value="${stockInfo.stock}"
                      style="width:70px;padding:4px 8px;border:1px solid ${stockBajo?'#dc2626':'#e5e7eb'};border-radius:6px;font-size:13px;text-align:center;font-family:inherit;background:${stockBajo?'#fef2f2':'var(--card)'};color:var(--text);"
                      onchange="guardarStock('${shop.shop_domain}','${pid}',this.value,${stockInfo.stock_minimo})"
                      title="Stock actual">
                    <div style="display:flex;align-items:center;gap:4px;">
                      <span style="font-size:10px;color:#9ca3af;">mín:</span>
                      <input type="number" min="0" value="${stockInfo.stock_minimo}"
                        style="width:45px;padding:2px 4px;border:1px solid #e5e7eb;border-radius:4px;font-size:11px;text-align:center;font-family:inherit;background:var(--card);color:var(--text);"
                        onchange="guardarStockMinimo('${shop.shop_domain}','${pid}',${stockInfo.stock},this.value)"
                        title="Stock mínimo para alerta">
                    </div>
                    ${stockBajo ? `<span style="font-size:10px;color:#dc2626;font-weight:600;">⚠️ Bajo</span>` : ""}
                  </div>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `).join("");

 // Si venimos de notificación o búsqueda, mostrar solo ese producto
    if (window.__pendingProductoId) {
      const pid = window.__pendingProductoId;
      window.__pendingProductoId = null;
      const productoFiltrado = window.__allProductos?.find(p => String(p.id) === pid);
      if (productoFiltrado) {
        const shopDom = productoFiltrado.shop_domain;
        const shopNom = productoFiltrado.shop_name;
        wrap.innerHTML = `
          <div style="margin-bottom:12px;">
            <button onclick="loadProductos()" style="padding:6px 14px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;">← Volver a todos los productos</button>
          </div>
          <div style="margin-bottom:32px;">
            <h3 style="font-size:15px;font-weight:700;color:#16a34a;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
              🏪 ${escapeHtml(shopNom)}
            </h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left;font-weight:600;color:#374151;width:60px;">Imagen</th>
                  <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left;font-weight:600;color:#374151;">Producto</th>
                  <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left;font-weight:600;color:#374151;">Variantes & SKU</th>
                  <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;font-weight:600;color:#374151;width:120px;">Stock</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  const p = productoFiltrado;
                  const pid2 = String(p.id);
                  const stockInfo = stockMap[pid2] || { stock: 0, stock_minimo: 5 };
                  const stockBajo = stockInfo.stock <= stockInfo.stock_minimo;
                  return `
                  <tr data-pid="${pid2}" style="background:#fef9c3;">
                    <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;">
                      ${p.image ? `<img src="${p.image}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;">` : `<div style="width:48px;height:48px;border-radius:6px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>`}
                    </td>
                    <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#111827;vertical-align:top;">
                      <span class="producto-nombre">${escapeHtml(p.title)}</span>
                      <div style="margin-top:8px;display:flex;align-items:center;gap:6px;">
                        <span style="font-size:11px;color:#9ca3af;white-space:nowrap;">Costo compra:</span>
                        <input type="number" min="0" step="0.01"
                          value="${stockInfo.costo_compra || ''}"
                          placeholder="0.00"
                          style="width:80px;padding:3px 6px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;text-align:right;font-family:inherit;background:var(--card);color:var(--text);"
                          onchange="guardarCostoCompra('${shopDom}','${pid2}',this.value)">
                        <span style="font-size:11px;color:#9ca3af;">€</span>
                      </div>
                    </td>
                    </td>
                    <td style="padding:10px 14px;border:1px solid #e5e7eb;vertical-align:top;">
                      ${p.variants.map(v => {
                        const vid = String(v.id);
                        const uds = variantesMap[vid] || 1;
                        return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid #f3f4f6;">
                          <span style="font-size:12px;color:#374151;flex:1;">${escapeHtml(v.title)}</span>
                          <span style="font-size:11px;color:#9ca3af;white-space:nowrap;">uds/venta:</span>
                          <input type="number" min="1" value="${uds}" style="width:52px;padding:3px 6px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;text-align:center;font-family:inherit;background:var(--card);color:var(--text);" onchange="guardarVarianteConfig('${shopDom}','${vid}',this.value)">
                        </div>`;
                      }).join("")}
                    </td>
                    <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;vertical-align:middle;">
                      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                        <input type="number" min="0" value="${stockInfo.stock}" style="width:70px;padding:4px 8px;border:1px solid ${stockBajo?'#dc2626':'#e5e7eb'};border-radius:6px;font-size:13px;text-align:center;font-family:inherit;background:${stockBajo?'#fef2f2':'var(--card)'};color:var(--text);" onchange="guardarStock('${shopDom}','${pid2}',this.value,${stockInfo.stock_minimo})">
                        <div style="display:flex;align-items:center;gap:4px;">
                          <span style="font-size:10px;color:#9ca3af;">mín:</span>
                          <input type="number" min="0" value="${stockInfo.stock_minimo}" style="width:45px;padding:2px 4px;border:1px solid #e5e7eb;border-radius:4px;font-size:11px;text-align:center;font-family:inherit;background:var(--card);color:var(--text);" onchange="guardarStockMinimo('${shopDom}','${pid2}',${stockInfo.stock},this.value)">
                        </div>
                        ${stockBajo ? `<span style="font-size:10px;color:#dc2626;font-weight:600;">⚠️ Bajo</span>` : ""}
                      </div>
                    </td>
                  </tr>`;
                })()}
              </tbody>
            </table>
          </div>
        `;
        return;
      }
    }

  } catch(e) {
    wrap.innerHTML = `<div style="color:#dc2626;padding:16px;">Error cargando productos</div>`;
  }
  window.__hideLoadingBar?.();
}
window.loadProductos = loadProductos;

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

  window.__showLoadingBar?.("Cargando Gastos Ads...");

  const daysInMonth = new Date(year, month, 0).getDate();
  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const monthName = monthNames[parseInt(month)-1];
  const h = { Authorization: "Bearer " + getActiveToken() };

  let dailyData = {}, spends = {};
  try {
    const [adsTableRows, adsRows] = await Promise.all([
      fetch(`${API_BASE}/api/metrics/ads-table?shop=${encodeURIComponent(shop)}&month=${month}&year=${year}`, { headers: h }).then(r => r.json()),
      cachedFetch(`${API_BASE}/api/ads?shop=${encodeURIComponent(shop)}&month=${month}&year=${year}`, { headers: h })
    ]);
    if (Array.isArray(adsTableRows)) adsTableRows.forEach(r => { dailyData[r.dateStr] = r; });
    if (Array.isArray(adsRows)) adsRows.forEach(r => { spends[r.date] = { meta: r.meta||0, tiktok: r.tiktok||0 }; });
  } catch(e) { console.error(e); }

  let totalFact=0, totalMeta=0, totalTiktok=0, totalPedidos=0;

  const rows = Array.from({length: daysInMonth}, (_,i) => {
    const day     = i+1;
    const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const label   = `${day} de ${monthName} de ${year}`;
    const srv      = dailyData[dateStr] || {};
    const facturacion = parseFloat(srv.facturacion || 0);
    const pedidos     = parseInt(srv.pedidos || 0);
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
  window.__hideLoadingBar?.();
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

  window.__showLoadingBar?.("Cargando gastos fijos...");

  let totalPedidos = 0;
  let devueltosMes = 0;
  try {
    const monthStr = String(month).padStart(2, "0");
    const mesFrom  = `${year}-${monthStr}-01`;
    const mesTo    = `${year}-${monthStr}-${String(new Date(year, month, 0).getDate()).padStart(2,"0")}`;
    const statsGF  = await fetch(`${API_BASE}/api/metrics/stats?from=${mesFrom}&to=${mesTo}`, { headers: { Authorization: "Bearer " + getActiveToken() } }).then(r => r.json());
    totalPedidos = statsGF.pedidos_activos || 0;
    devueltosMes = statsGF.devueltos || 0;
  } catch {}

  let items = [];
  try {
    // Asegurar que las filas base existen
    await fetch(`${API_BASE}/api/gastos-fijos/reset`, {
      method: "POST",
      headers: { "Content-Type":"application/json", Authorization: "Bearer " + getActiveToken() }
    });
    const data = await cachedFetch(`${API_BASE}/api/gastos-fijos?mes=${mes}`, { headers: { Authorization: "Bearer " + getActiveToken() } });
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
          headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
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

let preciosGlobales = { precio_mrw: 0, precio_logistica: 0 };
  try {
    preciosGlobales = await cachedFetch(`${API_BASE}/api/shopify/precios-globales`, { headers: { Authorization: "Bearer " + getActiveToken() } }) || preciosGlobales;
  } catch {}

  // Precargar P.UNIT de MRW y LOGÍSTICA desde precios globales
  if (Array.isArray(items)) {
    items = items.map(item => {
      if (item.nombre === "MRW") return { ...item, precio_unit: preciosGlobales.precio_mrw };
      if (item.nombre === "LOGÍSTICA") return { ...item, precio_unit: preciosGlobales.precio_logistica };
      return item;
    });
  }

  let impuestos = [];
  try {
    const data = await cachedFetch(`${API_BASE}/api/impuestos`, { headers: { Authorization: "Bearer " + getActiveToken() } });
    impuestos = Array.isArray(data) ? data : [];
  } catch {}

  if (impuestos.length === 0) {
    try {
      const r = await fetch(`${API_BASE}/api/impuestos`, {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
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
            let estimado = null;
            if (item.precio_unit != null && (item.nombre === "MRW" || item.nombre === "LOGÍSTICA")) {
              const totalEnvios = totalPedidos + devueltosMes; // +1 por cada devuelto
              estimado = totalEnvios * (parseFloat(item.precio_unit) || 0);
            }
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
    <div style="background:var(--card);border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:16px;">
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
    <div style="background:var(--card);border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#16a34a;">
            <th style="${thStyle}left;">PRECIO UNIT. ENVÍO</th>
            <th style="${thStyle}right;">€</th>
          </tr>
        </thead>
        <tbody>
          <tr onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
            <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;">MRW</td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;">
              <input type="number" min="0" step="0.01" value="${fmt(preciosGlobales.precio_mrw)}"
                id="precio-global-mrw"
                onchange="guardarPreciosGlobales()"
                onkeydown="if(event.key==='Enter'){event.preventDefault();this.dispatchEvent(new Event('change'));}"
                style="${inp}text-align:right;">
            </td>
          </tr>
          <tr onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
            <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;">LOGÍSTICA</td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;">
              <input type="number" min="0" step="0.01" value="${fmt(preciosGlobales.precio_logistica)}"
                id="precio-global-logistica"
                onchange="guardarPreciosGlobales()"
                onkeydown="if(event.key==='Enter'){event.preventDefault();this.dispatchEvent(new Event('change'));}"
                style="${inp}text-align:right;">
            </td>
          </tr>
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
  window.__hideLoadingBar?.();
}

async function updateGastoFijoValor(input) {
  const id    = input.dataset.id;
  const mes   = input.dataset.mes;
  const valor = parseFloat(input.value)||0;
  window.__showLoadingBar?.("Guardando...");
  try {
    const r = await fetch(`${API_BASE}/api/gastos-fijos/${id}/valor`, {
      method: "PUT",
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
      body: JSON.stringify({ mes, valor })
    });
    const data = await r.json();
    window.__hideLoadingBar?.();
    invalidateCache("gastos-fijos");
    if (!data.ok) console.error("Error guardando valor:", data);
  } catch(e) { window.__hideLoadingBar?.(); console.error(e); }
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
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
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
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
      body: JSON.stringify({ nombre:"", precio_unit:null, fijo:0, orden:999 })
    });
    const saved = await r.json();
    if (saved && saved.id) {
      invalidateCache("gastos-fijos");
      await loadGastosFijosData();
    }
  } catch(e) { console.error(e); }
}

async function deleteGastoFijo(id) {
  try {
    await fetch(`${API_BASE}/api/gastos-fijos/${id}`, {
      method: "DELETE",
      headers: { Authorization:"Bearer "+getActiveToken() }
    });
    invalidateCache("gastos-fijos");
    loadGastosFijosData();
  } catch(e) { console.error(e); }
}

async function updateImpuesto(input) {
  const id = input.dataset.id;
  const porcentaje = parseFloat(input.value)||0;
  try {
    await fetch(`${API_BASE}/api/impuestos/${id}`, {
      method: "PUT",
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
      body: JSON.stringify({ nombre:"IVA", porcentaje })
    });
    invalidateCache("impuestos");
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
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
      body: JSON.stringify({ mes, precio_unit })
    });
    input.blur();
    invalidateCache("gastos-fijos");
    invalidateCache("precios-globales");
    input.style.borderColor = "#16a34a";
    setTimeout(() => { input.style.borderColor = "#e5e7eb"; }, 1500);
  } catch(e) { console.error(e); }
}
window.updateGastoFijoPrecio = updateGastoFijoPrecio;

async function guardarPreciosGlobales() {
  const mrw = parseFloat(document.getElementById("precio-global-mrw")?.value) || 0;
  const log = parseFloat(document.getElementById("precio-global-logistica")?.value) || 0;
  try {
    await fetch(`${API_BASE}/api/shopify/precios-globales`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ precio_mrw: mrw, precio_logistica: log })
    });
    // Actualizar automáticamente el P.UNIT de MRW y LOGÍSTICA en la tabla
    const items = document.querySelectorAll("tr[data-id]");
    items.forEach(row => {
      const nameEl = row.querySelector("span");
      if (!nameEl) return;
      const nombre = nameEl.textContent.trim();
      const precioInput = row.querySelector("[data-field='precio_unit']");
      if (!precioInput) return;
      if (nombre === "MRW") {
        precioInput.value = mrw.toFixed(2);
        precioInput.dispatchEvent(new Event("change"));
      }
      if (nombre === "LOGÍSTICA") {
        precioInput.value = log.toFixed(2);
        precioInput.dispatchEvent(new Event("change"));
      }
    });
    invalidateCache("precios-globales");
    invalidateCache("gastos-fijos");
  } catch(e) { console.error(e); }
}
window.guardarPreciosGlobales = guardarPreciosGlobales;

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
        Authorization: "Bearer " + getActiveToken()
      },
      body: JSON.stringify({ shop, date, type, spend })
    });
    invalidateCache("ads");
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
async function loadGastosVarios(forzarMonth, forzarYear) {
  const content = document.getElementById("gv-content");
  const label   = document.getElementById("gv-mes-label");

  const month = forzarMonth || document.getElementById("gv-month-sel")?.value || (new Date().getMonth()+1);
  const year  = forzarYear  || document.getElementById("gv-year-sel")?.value  || new Date().getFullYear();

  if (!content && !forzarMonth) return;
  const mes   = `${year}-${String(month).padStart(2,"0")}`;

  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  if (label) label.textContent = `📅 Trabajando en: ${monthNames[parseInt(month)-1].toUpperCase()} ${year}`;

  window.__showLoadingBar?.("Cargando gastos...");
// Cargar pedidos del mes al cache global (solo el mes seleccionado)
  const _hGV = { Authorization: "Bearer " + getActiveToken() };
  if (!window.__allOrdersCache || window.__allOrdersCacheMes !== mes || window.__allOrdersCache.length === 0) {
    try {
      const _monthStr = String(month).padStart(2,"0");
      const _mesFrom  = `${year}-${_monthStr}-01`;
      const _mesTo    = `${year}-${_monthStr}-${String(new Date(year, month, 0).getDate()).padStart(2,"0")}`;
      const _ordRes   = await fetch(`${API_BASE}/api/orders?from=${_mesFrom}&to=${_mesTo}`, { headers: _hGV }).then(r => r.json());
      window.__allOrdersCache = Array.isArray(_ordRes) ? _ordRes : (_ordRes?.orders || []);
      window.__allOrdersCacheMes = mes;
    } catch {}
  }

  // 1. Tiendas activas
  let stores = [];
  try {
    const all = await cachedFetch(`${API_BASE}/api/shopify/stores`, { headers: _hGV });
    stores = Array.isArray(all) ? all.filter(s => s.active || s.status === "active" || s.is_active) : [];
    if (stores.length === 0) stores = Array.isArray(all) ? all : [];
  } catch {}

  const numTiendas = stores.length || 1;

  // 2. Gastos Ads del mes (Meta y TikTok por tienda) — EN PARALELO
  let adsSpends = {};
  try {
    const token = getActiveToken();
    const adsResults = await Promise.all(stores.map(store =>
      cachedFetch(`${API_BASE}/api/ads?shop=${encodeURIComponent(store.domain)}&month=${month}&year=${year}`, { headers: { Authorization: "Bearer " + token } })
        .then(rows => ({ domain: store.domain, rows: rows || [] }))
    ));
    adsResults.forEach(({ domain, rows }) => {
      let meta = 0, tiktok = 0;
      rows.forEach(r => { meta += r.meta||0; tiktok += r.tiktok||0; });
      adsSpends[domain] = { meta, tiktok };
    });
  } catch {}

  // 3. Cargar todo en paralelo
  const token = getActiveToken();
  const h = { Authorization: "Bearer " + token };
  let gastosFijos = [], gastosVarios = {}, gastosExtrasRaw = [], nominaData = { total: 0 }, impuestosData = [], stockData2 = [], varData2 = [];
  try {
    const [gf, gv, ge, nom, imp, st, vr] = await Promise.all([
      cachedFetch(`${API_BASE}/api/gastos-fijos?mes=${mes}`, { headers: h }),
      cachedFetch(`${API_BASE}/api/gastos-varios?mes=${mes}`, { headers: h }),
      cachedFetch(`${API_BASE}/api/gastos-varios/extras?mes=${mes}`, { headers: h }),
      cachedFetch(`${API_BASE}/api/nomina/total?mes=${mes}`, { headers: h }),
      cachedFetch(`${API_BASE}/api/impuestos`, { headers: h }),
      cachedFetch(`${API_BASE}/api/shopify/stock`, { headers: h }),
      cachedFetch(`${API_BASE}/api/shopify/variantes-config`, { headers: h })
    ]);
    gastosFijos = Array.isArray(gf) ? gf : [];
    if (Array.isArray(gv)) gv.forEach(r => { gastosVarios[r.shop_domain] = r.shopify||0; });
    gastosExtrasRaw = Array.isArray(ge) ? ge : [];
    nominaData = nom || { total: 0 };
    impuestosData = Array.isArray(imp) ? imp : [];
    stockData2 = Array.isArray(st) ? st : [];
    varData2 = Array.isArray(vr) ? vr : [];
  } catch {}

  // Separar MRW/Logística del resto de fijos
  const gastosMRW        = gastosFijos.filter(g => g.nombre === "MRW");
  const gastosLogistica  = gastosFijos.filter(g => g.nombre === "LOGÍSTICA");
  const gastosOtrosFijos = gastosFijos.filter(g => !["MRW","LOGÍSTICA"].includes(g.nombre));

  const totalMRW        = gastosMRW.reduce((s,g) => s+(parseFloat(g.valor)||0), 0);
  const totalLogistica  = gastosLogistica.reduce((s,g) => s+(parseFloat(g.valor)||0), 0);
  const totalOtrosFijos = gastosOtrosFijos.reduce((s,g) => s+(parseFloat(g.valor)||0), 0);
  const fijoXTienda    = totalOtrosFijos / numTiendas;

  // Calcular IVA y nómina desde datos ya cargados en paralelo
  let ivaPorcentaje = 0.21;
  if (impuestosData.length > 0) {
    ivaPorcentaje = (impuestosData[0].porcentaje != null ? parseFloat(impuestosData[0].porcentaje) : 21) / 100;
  }
  const nominaXTienda = (parseFloat(nominaData.total) || 0) / numTiendas;

  // Extras por tienda
  gastosExtras = {};
  gastosExtrasRaw.forEach(r => {
    if (!gastosExtras[r.shop_domain]) gastosExtras[r.shop_domain] = [];
    gastosExtras[r.shop_domain].push(r);
  });

  const fmt = n => (parseFloat(n)||0).toFixed(2);
  const inp = `padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:inherit;background:var(--card);color:var(--text);width:100%;box-sizing:border-box;text-align:right;`;

  // Construir mapas desde datos ya cargados
  const stockMap = {};
  stockData2.forEach(s => { stockMap[s.product_id] = s.costo_compra || 0; });
  const variantesMap = {};
  varData2.forEach(v => { variantesMap[v.variant_id] = v.unidades_por_venta || 1; });

  const cols = stores.map(store => {
    const ads     = adsSpends[store.domain] || { meta: 0, tiktok: 0 };
    const shopify = gastosVarios[store.domain] || 0;
    const allOrders = window.__allOrdersCache || [];
    const pedidosTienda = allOrders.filter(o => {
      if (!o.created_at) return false;
      if (["cancelado", "pendiente"].includes(o.fulfillment_status)) return false;
      const d = new Date(o.created_at).toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).split(" ")[0];
      return d.startsWith(mes) && o.shop_domain === store.domain;
    });

    // Todos los pedidos del mes (todas las tiendas, excl. cancelados y pendientes)
    const pedidosTodas = allOrders.filter(o => {
      if (!o.created_at) return false;
      if (["cancelado", "pendiente"].includes(o.fulfillment_status)) return false;
      const d = new Date(o.created_at).toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).split(" ")[0];
      return d.startsWith(mes);
    });

    let costoProductos = 0;
    pedidosTienda.filter(o => !["devuelto", "cancelado", "pendiente"].includes(o.fulfillment_status)).forEach(o => {
      try {
        const raw = o.raw_json ? (typeof o.raw_json === "string" ? JSON.parse(o.raw_json) : o.raw_json) : null;
        if (!raw?.line_items) return;
        raw.line_items.forEach(item => {
          const costo = parseFloat(stockMap[String(item.product_id)] || 0);
          const uds = parseInt(variantesMap[String(item.variant_id)] || 1);
          const qty = parseInt(item.quantity || 1);
          costoProductos += costo * uds * qty;
        });
      } catch {}
    });

    // MRW: solo enviados + 1 extra por cada devuelto (cancelados y pendientes NO cuentan)
    const estadosEnvioMRW = ["enviado","en_transito","entregado","franquicia","en_preparacion","devuelto","destruido"];
    const enviosGlobalesMRW = pedidosTodas.filter(o => estadosEnvioMRW.includes(o.fulfillment_status));
    const devueltosTodas = enviosGlobalesMRW.filter(o => o.fulfillment_status === "devuelto").length;
    const totalEnviosGlobales = enviosGlobalesMRW.length + devueltosTodas;

    const enviosTiendaMRW = pedidosTienda.filter(o => estadosEnvioMRW.includes(o.fulfillment_status));
    const devueltosTienda = enviosTiendaMRW.filter(o => o.fulfillment_status === "devuelto").length;
    const enviosTienda = enviosTiendaMRW.length + devueltosTienda;

    const mrwUnitario = totalEnviosGlobales > 0 ? totalMRW / totalEnviosGlobales : 0;
    const mrw = mrwUnitario * enviosTienda;

    // Logística: solo enviados (sin extra por devueltos, sin cancelados ni pendientes)
    const enviosGlobalesLog = pedidosTodas.filter(o => estadosEnvioMRW.includes(o.fulfillment_status));
    const totalPedidosGlobales = enviosGlobalesLog.length;
    const logisticaUnitaria = totalPedidosGlobales > 0 ? totalLogistica / totalPedidosGlobales : 0;
    const logistica = logisticaUnitaria * enviosTiendaMRW.length;
    const extrasTotal = (gastosExtras[store.domain]||[]).reduce((s,g) => s+(parseFloat(g.valor)||0), 0);
    const entregadosTienda = pedidosTienda.filter(o => o.fulfillment_status === "entregado");
    const ivaTotal = entregadosTienda.reduce((s,o) => s + (parseFloat(o.total_price)||0) * ivaPorcentaje, 0);
    const total = ads.meta + ads.tiktok + shopify + costoProductos + mrw + logistica + fijoXTienda + nominaXTienda + extrasTotal + ivaTotal;
    if (!window.__gastosPorTienda) window.__gastosPorTienda = {};
    window.__gastosPorTienda[store.domain] = total;

    return `
      <div style="background:var(--card);border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;min-width:220px;flex:1;">
        <div style="background:#16a34a;padding:12px 16px;">
          <div style="font-weight:700;color:#fff;font-size:14px;">${escapeHtml(store.shop_name||store.domain)}</div>
          <div style="font-size:11px;color:#bbf7d0;margin-top:2px;">${store.domain}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tbody>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Gasto Meta</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(ads.meta)} €</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Gasto TikTok</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(ads.tiktok)} €</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Productos</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(costoProductos)} €
                <div style="font-size:10px;color:#9ca3af;">costo × uds × cantidad por pedido</div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">MRW</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(mrw)} €
                <div style="font-size:10px;color:#9ca3af;">${fmt(totalMRW)}€ ÷ ${totalEnviosGlobales} envíos globales (${enviosTiendaMRW.length} salidas + ${devueltosTienda} dev. esta tienda)</div>
              </td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Logística</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(logistica)} €
                <div style="font-size:10px;color:#9ca3af;">${fmt(totalLogistica)}€ ÷ ${totalPedidosGlobales} envíos × ${enviosTiendaMRW.length} esta tienda</div>
              </td>
            </tr>
            <tr>
              <tr>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Gastos Fijos</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(fijoXTienda)} €
                <div style="font-size:10px;color:#9ca3af;">${fmt(totalOtrosFijos)}€ ÷ ${numTiendas} tiendas</div>
              </td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Nómina</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;">${fmt(nominaXTienda)} €
                <div style="font-size:10px;color:#9ca3af;">Total nómina ÷ ${numTiendas} tiendas</div>
              </td>
            </tr>
            <tr style="background:#fefce8;">
              <td style="padding:10px 14px;border:1px solid #fef08a;font-weight:600;color:#854d0e;">IVA (${(ivaPorcentaje*100).toFixed(0)}%)</td>
              <td style="padding:10px 14px;border:1px solid #fef08a;text-align:right;color:#854d0e;font-weight:600;">${fmt(ivaTotal)} €
                <div style="font-size:10px;color:#a16207;">${entregadosTienda.length} pedidos entregados × ${(ivaPorcentaje*100).toFixed(0)}%</div>
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
            ${(gastosExtras[store.domain]||[]).map((g) => `
            <tr style="background:#eff6ff;">
              <td style="padding:7px 14px;border:1px solid #bfdbfe;">
                <input type="text" value="${escapeHtml(g.nombre||'')}" placeholder="Concepto..."
                  data-id="${g.id}" data-shop="${store.domain}" data-mes="${mes}"
                  onchange="updateGastoExtraNombre(this)"
                  style="border:none;outline:none;background:transparent;width:100%;font-size:13px;color:#2563eb;font-family:inherit;">
              </td>
              <td style="padding:7px 14px;border:1px solid #bfdbfe;display:flex;align-items:center;gap:6px;">
                <input type="number" min="0" step="0.01" value="${fmt(g.valor||0)}" placeholder="0.00"
                  data-id="${g.id}" data-shop="${store.domain}" data-mes="${mes}"
                  onchange="updateGastoExtraValor(this)"
                  style="${inp}background:#eff6ff;color:#2563eb;font-weight:600;flex:1;">
                <button onclick="deleteGastoExtra(${g.id})"
                  style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:14px;font-weight:700;padding:0;flex-shrink:0;">✕</button>
              </td>
            </tr>`).join("")}
            <tr style="background:#eff6ff;">
              <td colspan="2" style="padding:6px 14px;border:1px solid #bfdbfe;">
                <button onclick="addGastoExtra('${store.domain}','${mes}')"
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

  if (content) {
    content.innerHTML = `
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:start;">
        ${cols || `<div style="color:#6b7280;padding:16px;">No hay tiendas activas.</div>`}
      </div>
    `;
  }
  window.__hideLoadingBar?.();
}

async function saveGastoVarioShopify(input) {
  const shop    = input.dataset.shop;
  const mes     = input.dataset.mes;
  const shopify = parseFloat(input.value)||0;
  try {
    window.__showLoadingBar?.("Guardando Shopify...");
    await fetch(`${API_BASE}/api/gastos-varios/shopify`, {
      method: "PUT",
      headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
      body: JSON.stringify({ shop_domain: shop, mes, shopify })
    });
   window.__hideLoadingBar?.();
    invalidateCache("gastos");
    await loadGastosVarios();
  } catch(e) { window.__hideLoadingBar?.(); console.error(e); }
}

window.loadGastosVarios      = loadGastosVarios;
window.saveGastoVarioShopify = saveGastoVarioShopify;

// =========================
// INFORMES
// =========================
async function switchInformesTab(tab) {
  ["reembolsos","ingresos","balance"].forEach(k => {
    const btn = document.getElementById(`inf-tab-btn-${k}`);
    if (!btn) return;
    if (k === tab) {
      btn.style.background = "#16a34a"; btn.style.color = "#fff"; btn.style.borderColor = "#16a34a";
    } else {
      btn.style.background = "#fff"; btn.style.color = "#374151"; btn.style.borderColor = "#e5e7eb";
    }
  });
  const content = document.getElementById("informes-content");
  if (!content) return;
  if (tab === "reembolsos") {
    content.innerHTML = `
      <div class="card" style="padding:20px;">
        <div class="orders-header">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:4px;">
            <div class="tabs" style="margin-bottom:0;border-bottom:none;">
              <span class="tab active" onclick="filterReeByTab(this,'')">Todos</span>
              <span class="tab" onclick="filterReeByTab(this,'pendiente')">Pendiente</span>
              <span class="tab" onclick="filterReeByTab(this,'cobrado')">Pagado</span>
            </div>
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
              <label style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#f0fdf4;border:1px solid #16a34a;border-radius:8px;color:#16a34a;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">
                ✅ Importar Pagados
                <input type="file" accept=".pdf" multiple style="display:none;" onchange="importarPagadosPDF(this)">
              </label>
            </div>
          </div>
          <div style="border-bottom:1px solid #e5e7eb;margin-bottom:12px;"></div>
          <div id="ree-counter" style="font-size:13px;color:#6b7280;margin-bottom:8px;padding:0 4px;"></div>
          <div class="orders-table">
            <div class="orders-row head" style="display:grid;grid-template-columns:30px 1fr 1fr 1fr 1fr 1fr 1fr;gap:0;">
              <div>#</div><div>Pedido</div><div>Nº seguimiento</div><div>Fecha</div><div>Cliente</div><div>Costo</div><div>Estado pago</div>
            </div>
            <div id="reeBody"><div class="muted" style="padding:16px;">Cargando...</div></div>
          </div>
          <div id="reePagination" style="display:flex;justify-content:center;align-items:center;gap:6px;padding:18px 0 4px;flex-wrap:wrap;"></div>
        </div>
      </div>
    `;
    fetch(`${API_BASE}/api/shopify/stores`, {
      headers: { Authorization: "Bearer " + getActiveToken() }
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
  if (tab === "ingresos") await loadInformesIngresos();
  else await loadInformesBalance();
}
window.switchInformesTab = switchInformesTab;

async function loadInformesIngresos() {
  const content = document.getElementById("informes-content");
  if (!content) return;

  const now = new Date();
  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
      <select id="inf-month-sel" onchange="renderInformesIngresos()"
        style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${monthNames.map((m,i)=>`<option value="${i+1}" ${i===now.getMonth()?"selected":""}>${m}</option>`).join("")}
      </select>
      <select id="inf-year-sel" onchange="renderInformesIngresos()"
        style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===now.getFullYear()?"selected":""}>${y}</option>`).join("")}
      </select>
    </div>
    <div id="inf-ingresos-wrap"></div>
  `;
  await renderInformesIngresos();
}

async function renderInformesIngresos() {
  const wrap = document.getElementById("inf-ingresos-wrap");
  if (!wrap) return;
  window.__showLoadingBar?.("Cargando ingresos...");

  const month = document.getElementById("inf-month-sel")?.value || (new Date().getMonth()+1);
  const year  = document.getElementById("inf-year-sel")?.value  || new Date().getFullYear();
  const mes   = `${year}-${String(month).padStart(2,"0")}`;
  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const mesLabel = monthNames[parseInt(month)-1].toUpperCase() + " " + year;

  let stores = [], orders = [], manuales = [];
  const _hInf = { Authorization: "Bearer " + getActiveToken() };
  try {
    const _monthStr = String(month).padStart(2,"0");
    const _mesFrom  = `${year}-${_monthStr}-01`;
    const _mesTo    = `${year}-${_monthStr}-${String(new Date(year, month, 0).getDate()).padStart(2,"0")}`;
    const [_s, _o, _m] = await Promise.all([
      cachedFetch(`${API_BASE}/api/shopify/stores`, { headers: _hInf }),
      fetch(`${API_BASE}/api/orders?from=${_mesFrom}&to=${_mesTo}`, { headers: _hInf }).then(r => r.json()),
      cachedFetch(`${API_BASE}/api/shopify/informes-ingresos?mes=${mes}`, { headers: _hInf })
    ]);
    stores = Array.isArray(_s) ? _s : [];
    orders = Array.isArray(_o) ? _o : (_o?.orders || []);
    manuales = Array.isArray(_m) ? _m : [];
  } catch {}

  const pedidosMes     = orders.filter(o => o.fulfillment_status === "entregado");
  const pedidosMesTarjeta = orders.filter(o => o.fulfillment_status !== "cancelado");

  const fmt = n => (parseFloat(n)||0).toFixed(2);
  const inp = `padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:inherit;background:var(--card);color:var(--text);width:100%;box-sizing:border-box;`;
  const MRW_COMISION = 0.67;
  const TARJETA_PCT  = 0.04;

  let grandTotal = 0;
  const totalPedidosEntregados = pedidosMes.length;

  const cols = stores.map(store => {
    const pedidosTienda = pedidosMes.filter(o => o.shop_domain === store.domain);

    const pedidosCOD = pedidosTienda.filter(o => {
      try {
        const raw = o.raw_json ? (typeof o.raw_json === "string" ? JSON.parse(o.raw_json) : o.raw_json) : null;
        const fin = (raw?.financial_status || o.financial_status || "").toLowerCase().trim();
        return fin === "pending" || fin === "cod" || fin === "pendiente";
      } catch { return false; }
    });

    const pedidosTiendaTarjeta = pedidosMesTarjeta.filter(o => o.shop_domain === store.domain);
    const pedidosPagado = pedidosTiendaTarjeta.filter(o => {
      try {
        const raw = o.raw_json ? (typeof o.raw_json === "string" ? JSON.parse(o.raw_json) : o.raw_json) : null;
        const fin = (raw?.financial_status || o.financial_status || "").toLowerCase().trim();
        return fin === "paid" || fin === "pagado";
      } catch { return false; }
    });

    const totalCOD    = pedidosCOD.reduce((s,o) => s+(parseFloat(o.total_price)||0), 0);
    const totalPagado = pedidosPagado.reduce((s,o) => s+(parseFloat(o.total_price)||0), 0);
    const descCOD     = pedidosCOD.length * MRW_COMISION;
    const descPagado  = totalPagado * TARJETA_PCT;
    const netoCOD     = totalCOD - descCOD;
    const netoPagado  = totalPagado - descPagado;

    const man1 = manuales.find(m => m.shop_domain === store.domain && m.columna === 1) || { nombre: "", valor: 0 };
    const man2 = manuales.find(m => m.shop_domain === store.domain && m.columna === 2) || { nombre: "", valor: 0 };
    const totalManual = (parseFloat(man1.valor)||0) + (parseFloat(man2.valor)||0);
    const totalTienda = netoCOD + netoPagado + totalManual;
    grandTotal += totalTienda;

    return `
      <div style="background:var(--card);border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#16a34a;padding:10px 14px;">
          <div style="font-weight:700;color:#fff;font-size:14px;">${escapeHtml(store.shop_name||store.domain)}</div>
          <div style="font-size:11px;color:#bbf7d0;">${store.domain}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tbody>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">
                COD
                <div style="font-size:10px;color:#9ca3af;font-weight:400;">${fmt(totalCOD)} € — ${pedidosCOD.length} pedidos</div>
                <div style="font-size:10px;color:#dc2626;">Comisión MRW (${pedidosCOD.length}×0.67€) = −${fmt(descCOD)}€</div>
              </td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:600;color:#374151;">${fmt(netoCOD)} €</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">
                TARJETA
                <div style="font-size:10px;color:#9ca3af;font-weight:400;">${fmt(totalPagado)} € — ${pedidosPagado.length} pedidos</div>
                <div style="font-size:10px;color:#dc2626;">Comisión tarjeta (4%) = −${fmt(descPagado)}€</div>
              </td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:600;color:#374151;">${fmt(netoPagado)} €</td>
            </tr>
            <tr style="background:#eff6ff;">
              <td style="padding:8px 14px;border:1px solid #bfdbfe;">
                <input type="text" value="${escapeHtml(man1.nombre||'')}" placeholder="Nombre ingreso extra 1..."
                  data-shop="${store.domain}" data-mes="${mes}" data-col="1" data-field="nombre"
                  onchange="guardarIngresoManual(this)"
                  style="${inp}background:#eff6ff;color:#2563eb;font-weight:600;margin-bottom:4px;">
              </td>
              <td style="padding:8px 14px;border:1px solid #bfdbfe;">
                <input type="number" min="0" step="0.01" value="${fmt(man1.valor)}" placeholder="0.00"
                  data-shop="${store.domain}" data-mes="${mes}" data-col="1" data-field="valor"
                  onchange="guardarIngresoManual(this)"
                  style="${inp}text-align:right;background:#eff6ff;color:#2563eb;font-weight:600;">
              </td>
            </tr>
            <tr style="background:#eff6ff;">
              <td style="padding:8px 14px;border:1px solid #bfdbfe;">
                <input type="text" value="${escapeHtml(man2.nombre||'')}" placeholder="Nombre ingreso extra 2..."
                  data-shop="${store.domain}" data-mes="${mes}" data-col="2" data-field="nombre"
                  onchange="guardarIngresoManual(this)"
                  style="${inp}background:#eff6ff;color:#2563eb;font-weight:600;margin-bottom:4px;">
              </td>
              <td style="padding:8px 14px;border:1px solid #bfdbfe;">
                <input type="number" min="0" step="0.01" value="${fmt(man2.valor)}" placeholder="0.00"
                  data-shop="${store.domain}" data-mes="${mes}" data-col="2" data-field="valor"
                  onchange="guardarIngresoManual(this)"
                  style="${inp}text-align:right;background:#eff6ff;color:#2563eb;font-weight:600;">
              </td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:700;color:#16a34a;">TOTAL</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:700;color:#16a34a;">${fmt(totalTienda)} €</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join("");

  wrap.innerHTML = `
    <div style="margin-bottom:16px;padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#16a34a;font-weight:600;">
      📅 ${mesLabel} — ${totalPedidosEntregados} pedidos entregados — Total ingresos: ${fmt(grandTotal)} €
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
      ${cols || `<div style="color:#6b7280;padding:16px;">No hay tiendas activas.</div>`}
    </div>
    </div>
  `;
  window.__hideLoadingBar?.();
}

async function guardarIngresoManual(input) {
  const shop  = input.dataset.shop;
  const mes   = input.dataset.mes;
  const col   = parseInt(input.dataset.col);
  const field = input.dataset.field;

  const rows = input.closest("tr");
  const inputs = rows ? rows.querySelectorAll("input") : [];
  let nombre = "", valor = 0;
  inputs.forEach(inp => {
    if (inp.dataset.field === "nombre") nombre = inp.value;
    if (inp.dataset.field === "valor") valor = parseFloat(inp.value)||0;
  });

  try {
    await fetch(`${API_BASE}/api/shopify/informes-ingresos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ shop_domain: shop, mes, columna: col, nombre, valor })
    });
    invalidateCache("informes-ingresos");

    // Recalcular totales en pantalla sin recargar
    const wrap = input.closest("div[style*='border-radius:12px']");
    if (!wrap) return;

    // Recoger todos los inputs de valor de esta tienda
    const allValorInputs = wrap.querySelectorAll("input[data-field='valor']");
    let totalCOD = 0, totalPagado = 0, totalManual = 0;

    // Leer COD y TARJETA de las celdas de texto (no editables)
    const tds = wrap.querySelectorAll("td");
    tds.forEach(td => {
      const txt = td.textContent.trim();
      if (td.previousElementSibling?.textContent?.includes("COD") && txt.includes("€")) {
        totalCOD = parseFloat(txt.replace("€","").trim()) || 0;
      }
      if (td.previousElementSibling?.textContent?.includes("TARJETA") && txt.includes("€")) {
        totalPagado = parseFloat(txt.replace("€","").trim()) || 0;
      }
    });

    allValorInputs.forEach(inp => {
      totalManual += parseFloat(inp.value) || 0;
    });

    const totalTienda = totalCOD + totalPagado + totalManual;
    const totalEl = wrap.querySelector("tr[style*='#f0fdf4'] td:last-child");
    if (totalEl) totalEl.textContent = totalTienda.toFixed(2) + " €";

    // Actualizar el gran total del banner
    const allCards = document.querySelectorAll("#inf-ingresos-wrap div[style*='border-radius:12px']");
    let grandTotal = 0;
    allCards.forEach(card => {
      const totEl = card.querySelector("tr[style*='#f0fdf4'] td:last-child");
      if (totEl) grandTotal += parseFloat(totEl.textContent) || 0;
    });
    const bannerEl = document.querySelector("#inf-ingresos-wrap div[style*='bbf7d0']");
    if (bannerEl) {
      const mesLabel = bannerEl.textContent.replace(/📅/g,"").split("—")[0].trim();
      bannerEl.textContent = `📅 ${mesLabel} — Total ingresos: ${grandTotal.toFixed(2)} €`;
    }

  } catch(e) { console.error(e); }
}
window.guardarIngresoManual = guardarIngresoManual;

async function loadInformesBalance() {
  const content = document.getElementById("informes-content");
  if (!content) return;

  const now = new Date();
  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
      <select id="inf-bal-month-sel" onchange="renderInformesBalance()"
        style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${monthNames.map((m,i)=>`<option value="${i+1}" ${i===now.getMonth()?"selected":""}>${m}</option>`).join("")}
      </select>
      <select id="inf-bal-year-sel" onchange="renderInformesBalance()"
        style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===now.getFullYear()?"selected":""}>${y}</option>`).join("")}
      </select>
    </div>
    <div id="inf-balance-wrap"></div>
  `;
  await renderInformesBalance();
}

async function renderInformesBalance() {
  const wrap = document.getElementById("inf-balance-wrap");
  if (!wrap) return;
  window.__showLoadingBar?.("Cargando balance...");

  const month = document.getElementById("inf-bal-month-sel")?.value || (new Date().getMonth()+1);
  const year  = document.getElementById("inf-bal-year-sel")?.value  || new Date().getFullYear();
  const mes   = `${year}-${String(month).padStart(2,"0")}`;
  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const mesLabel = monthNames[parseInt(month)-1].toUpperCase() + " " + year;
  const fmt = n => (parseFloat(n)||0).toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const MRW_COMISION = 0.67;
  const TARJETA_PCT  = 0.04;
  const h = { Authorization: "Bearer " + getActiveToken() };

  // ── 1. Cargar datos base ──────────────────────────────────
  let stores = [], orders = [], manuales = [];
  try {
    const _monthStr = String(month).padStart(2,"0");
    const _mesFrom  = `${year}-${_monthStr}-01`;
    const _mesTo    = `${year}-${_monthStr}-${String(new Date(year, month, 0).getDate()).padStart(2,"0")}`;
    const [_s, _o, _m] = await Promise.all([
      cachedFetch(`${API_BASE}/api/shopify/stores`, { headers: h }),
      fetch(`${API_BASE}/api/orders?from=${_mesFrom}&to=${_mesTo}`, { headers: h }).then(r => r.json()),
      cachedFetch(`${API_BASE}/api/shopify/informes-ingresos?mes=${mes}`, { headers: h })
    ]);
    stores = Array.isArray(_s) ? _s : [];
    orders = Array.isArray(_o) ? _o : (_o?.orders || []);
    manuales = Array.isArray(_m) ? _m : [];
  } catch(e) {
    wrap.innerHTML = `<div style="color:#dc2626;padding:16px;">Error cargando datos</div>`;
    window.__hideLoadingBar?.();
    return;
  }

  // ── 2. Calcular gastos por tienda ─────────────────────────
  // Siempre recalcular al cambiar de mes; pasar los pedidos ya cargados para evitar doble fetch
  window.__allOrdersCache = orders;
  window.__allOrdersCacheMes = `${year}-${String(month).padStart(2,"0")}`;
  window.__gastosPorTienda = {};
  await loadGastosVarios(parseInt(month), parseInt(year));

  // ── 3. Calcular ingresos por tienda (igual que pestaña Ingresos) ──
  const pedidosEntregados = orders.filter(o => o.fulfillment_status === "entregado");
  const pedidosTarjeta    = orders.filter(o => o.fulfillment_status !== "cancelado");

  // ── 4. Construir balanceData ──────────────────────────────
  const balanceData = stores.map(store => {
    const pedEnt = pedidosEntregados.filter(o => o.shop_domain === store.domain);

    const pedCOD = pedEnt.filter(o => {
      try {
        const raw = o.raw_json ? (typeof o.raw_json === "string" ? JSON.parse(o.raw_json) : o.raw_json) : null;
        const fin = (raw?.financial_status || o.financial_status || "").toLowerCase().trim();
        return fin === "pending" || fin === "cod" || fin === "pendiente";
      } catch { return false; }
    });

    const pedPag = pedidosTarjeta.filter(o => {
      if (o.shop_domain !== store.domain) return false;
      try {
        const raw = o.raw_json ? (typeof o.raw_json === "string" ? JSON.parse(o.raw_json) : o.raw_json) : null;
        const fin = (raw?.financial_status || o.financial_status || "").toLowerCase().trim();
        return fin === "paid" || fin === "pagado";
      } catch { return false; }
    });

    const tCOD = pedCOD.reduce((s,o) => s + (parseFloat(o.total_price)||0), 0);
    const tPag = pedPag.reduce((s,o) => s + (parseFloat(o.total_price)||0), 0);
    const man1 = manuales.find(m => m.shop_domain === store.domain && m.columna === 1) || { nombre:"", valor:0 };
    const man2 = manuales.find(m => m.shop_domain === store.domain && m.columna === 2) || { nombre:"", valor:0 };

    const totalIngreso = (tCOD - pedCOD.length * MRW_COMISION)
                       + (tPag - tPag * TARJETA_PCT)
                       + (parseFloat(man1.valor)||0)
                       + (parseFloat(man2.valor)||0);

    const totalGasto = window.__gastosPorTienda[store.domain] || 0;
    const resultado  = totalIngreso - totalGasto;

    return { domain: store.domain, name: store.shop_name || store.domain, totalIngreso, totalGasto, resultado };
  });

  window.__balanceData = balanceData;

  // ── 5. Render HTML ────────────────────────────────────────
  const cols = balanceData.map(d => {
    const resColor = d.resultado >= 0 ? "#16a34a" : "#dc2626";
    const resBg    = d.resultado >= 0 ? "#f0fdf4" : "#fef2f2";
    const resBorder= d.resultado >= 0 ? "#bbf7d0" : "#fecaca";
    return `
      <div style="background:var(--card);border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;" data-domain="${d.domain}">
        <div style="background:#16a34a;padding:10px 14px;">
          <div style="font-weight:700;color:#fff;font-size:14px;">${escapeHtml(d.name)}</div>
          <div style="font-size:11px;color:#bbf7d0;">${d.domain}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tbody>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Total Ingreso</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:600;color:#16a34a;">${fmt(d.totalIngreso)} €</td>
            </tr>
            <tr style="background:#fef2f2;">
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Total Gasto</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:600;color:#dc2626;">− ${fmt(d.totalGasto)} €</td>
            </tr>
            <tr style="background:${resBg};">
              <td style="padding:12px 14px;border:1px solid ${resBorder};font-weight:700;color:${resColor};font-size:14px;">RESULTADO</td>
              <td style="padding:12px 14px;border:1px solid ${resBorder};text-align:right;font-weight:800;color:${resColor};font-size:16px;">${fmt(d.resultado)} €</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }).join("");

  const storeCheckboxes = balanceData.map(d =>
    `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:13px;color:var(--text);border-bottom:1px solid #f3f4f6;">
      <input type="checkbox" checked value="${d.domain}" onchange="recalcBalanceSuma()" style="width:15px;height:15px;accent-color:#16a34a;cursor:pointer;">
      ${escapeHtml(d.name)}
    </label>`
  ).join("");

  wrap.innerHTML = `
    <div style="margin-bottom:16px;padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#16a34a;font-weight:600;">
      📅 ${mesLabel}
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
      <div style="display:flex;gap:20px;align-items:flex-start;">
        <div style="flex:1;min-width:0;">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;" id="bal-cols">
            ${cols || `<div style="color:#6b7280;padding:16px;">No hay tiendas activas.</div>`}
          </div>
          <div id="bal-sumatoria" style="margin-top:24px;padding:18px 22px;background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;">
            <div style="font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Sumatoria seleccionada</div>
            <div id="bal-suma-filas" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;"></div>
            <div style="border-top:2px solid #16a34a;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;font-size:15px;color:#374151;">TOTAL</span>
              <span id="bal-suma-total" style="font-weight:800;font-size:24px;"></span>
            </div>
          </div>
        </div>
        <div style="width:200px;flex-shrink:0;background:var(--card);border:1px solid #e5e7eb;border-radius:12px;padding:14px;position:sticky;top:80px;">
          <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Filtrar tiendas</div>
          <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:13px;font-weight:700;color:var(--text);border-bottom:2px solid #e5e7eb;margin-bottom:4px;">
            <input type="checkbox" id="bal-check-all" checked onchange="toggleAllBalanceShops(this.checked)" style="width:15px;height:15px;accent-color:#16a34a;cursor:pointer;">
            Todas las tiendas
          </label>
          ${storeCheckboxes}
        </div>
      </div>
    </div>
  `;

  recalcBalanceSuma();
  window.__hideLoadingBar?.();
}

function recalcBalanceSuma() {
  const data = window.__balanceData || [];
  const checks = document.querySelectorAll("#inf-balance-wrap input[type='checkbox'][value]");
  const seleccionadas = new Set([...checks].filter(c => c.checked).map(c => c.value));
  const filtradas = data.filter(d => seleccionadas.has(d.domain));
  const fmt = n => (parseFloat(n)||0).toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 });

  // Mostrar/ocultar tarjetas
  document.querySelectorAll("#bal-cols > div[data-domain]").forEach(card => {
    card.style.display = seleccionadas.has(card.dataset.domain) ? "" : "none";
  });

  const totalResultado = filtradas.reduce((s,d) => s + d.resultado, 0);
  const filasEl = document.getElementById("bal-suma-filas");
  const totalEl = document.getElementById("bal-suma-total");

  if (filasEl) filasEl.innerHTML = filtradas.map(d =>
    `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:8px 14px;font-size:12px;min-width:140px;">
      <div style="color:#6b7280;font-weight:600;margin-bottom:4px;">${escapeHtml(d.name)}</div>
      <div style="font-size:11px;color:#9ca3af;">Ingreso: <span style="color:#16a34a;font-weight:600;">${fmt(d.totalIngreso)} €</span></div>
      <div style="font-size:11px;color:#9ca3af;">Gasto: <span style="color:#dc2626;font-weight:600;">${fmt(d.totalGasto)} €</span></div>
      <div style="font-size:13px;font-weight:700;color:${d.resultado>=0?'#16a34a':'#dc2626'};margin-top:4px;border-top:1px solid #f3f4f6;padding-top:4px;">${fmt(d.resultado)} €</div>
    </div>`
  ).join("");

  if (totalEl) { totalEl.textContent = fmt(totalResultado) + " €"; totalEl.style.color = totalResultado >= 0 ? "#16a34a" : "#dc2626"; }

  const allCheck = document.getElementById("bal-check-all");
  if (allCheck) allCheck.checked = filtradas.length === data.length;
}
window.recalcBalanceSuma = recalcBalanceSuma;


function toggleAllBalanceShops(checked) {
  const checks = document.querySelectorAll("#inf-balance-wrap input[type='checkbox'][value]");
  checks.forEach(c => c.checked = checked);
  recalcBalanceSuma();
}
window.toggleAllBalanceShops = toggleAllBalanceShops;

async function calcularGastosPorTienda(mes, month, year, stores) {
  const h = { Authorization: "Bearer " + getActiveToken() };
  const numTiendas = stores.length || 1;

  let adsSpends = {};
  try {
    const adsResults = await Promise.all(stores.map(store =>
      cachedFetch(`${API_BASE}/api/ads?shop=${encodeURIComponent(store.domain)}&month=${month}&year=${year}`, { headers: h })
        .then(rows => ({ domain: store.domain, rows: rows || [] }))
    ));
    adsResults.forEach(({ domain, rows }) => {
      let meta = 0, tiktok = 0;
      rows.forEach(r => { meta += r.meta||0; tiktok += r.tiktok||0; });
      adsSpends[domain] = { meta, tiktok };
    });
  } catch {}

  let gastosFijos = [], gastosVarios = {}, gastosExtrasRaw = [], nominaData = { total: 0 }, impuestosData = [], stockData2 = [], varData2 = [];
  try {
    const [gf, gv, ge, nom, imp, st, vr] = await Promise.all([
      cachedFetch(`${API_BASE}/api/gastos-fijos?mes=${mes}`, { headers: h }),
      cachedFetch(`${API_BASE}/api/gastos-varios?mes=${mes}`, { headers: h }),
      cachedFetch(`${API_BASE}/api/gastos-varios/extras?mes=${mes}`, { headers: h }),
      cachedFetch(`${API_BASE}/api/nomina/total?mes=${mes}`, { headers: h }),
      cachedFetch(`${API_BASE}/api/impuestos`, { headers: h }),
      cachedFetch(`${API_BASE}/api/shopify/stock`, { headers: h }),
      cachedFetch(`${API_BASE}/api/shopify/variantes-config`, { headers: h })
    ]);
    gastosFijos = Array.isArray(gf) ? gf : [];
    if (Array.isArray(gv)) gv.forEach(r => { gastosVarios[r.shop_domain] = r.shopify||0; });
    gastosExtrasRaw = Array.isArray(ge) ? ge : [];
    nominaData = nom || { total: 0 };
    impuestosData = Array.isArray(imp) ? imp : [];
    stockData2 = Array.isArray(st) ? st : [];
    varData2 = Array.isArray(vr) ? vr : [];
  } catch {}

  const gastosMRW = gastosFijos.filter(g => g.nombre === "MRW");
  const gastosLogistica = gastosFijos.filter(g => g.nombre === "LOGÍSTICA");
  const gastosOtrosFijos = gastosFijos.filter(g => !["MRW","LOGÍSTICA"].includes(g.nombre));
  const totalMRW = gastosMRW.reduce((s,g) => s+(parseFloat(g.valor)||0), 0);
  const totalLogistica = gastosLogistica.reduce((s,g) => s+(parseFloat(g.valor)||0), 0);
  const totalOtrosFijos = gastosOtrosFijos.reduce((s,g) => s+(parseFloat(g.valor)||0), 0);
  const fijoXTienda = totalOtrosFijos / numTiendas;

  let ivaPorcentaje = 0.21;
  if (impuestosData.length > 0) ivaPorcentaje = (parseFloat(impuestosData[0].porcentaje)||21) / 100;
  const nominaXTienda = (parseFloat(nominaData.total)||0) / numTiendas;

  const gastosExtras = {};
  gastosExtrasRaw.forEach(r => {
    if (!gastosExtras[r.shop_domain]) gastosExtras[r.shop_domain] = [];
    gastosExtras[r.shop_domain].push(r);
  });

  const stockMap = {};
  stockData2.forEach(s => { stockMap[s.product_id] = s.costo_compra||0; });
  const variantesMap = {};
  varData2.forEach(v => { variantesMap[v.variant_id] = v.unidades_por_venta||1; });

  const allOrdersCache = window.__allOrdersCache || [];
  const estadosEnvioMRW = ["enviado","en_transito","entregado","franquicia","en_preparacion","devuelto","destruido"];

  const pedidosTodas = allOrdersCache.filter(o => {
    if (!o.created_at) return false;
    if (["cancelado","pendiente"].includes(o.fulfillment_status)) return false;
    const d = new Date(o.created_at).toLocaleString("sv-SE",{timeZone:"Europe/Madrid"}).split(" ")[0];
    return d.startsWith(mes);
  });

  const enviosGlobalesMRW = pedidosTodas.filter(o => estadosEnvioMRW.includes(o.fulfillment_status));
  const devueltosTodas = enviosGlobalesMRW.filter(o => o.fulfillment_status === "devuelto").length;
  const totalEnviosGlobales = enviosGlobalesMRW.length + devueltosTodas;
  const totalPedidosGlobales = pedidosTodas.filter(o => estadosEnvioMRW.includes(o.fulfillment_status)).length;

  if (!window.__gastosPorTienda) window.__gastosPorTienda = {};

  stores.forEach(store => {
    const ads = adsSpends[store.domain] || { meta:0, tiktok:0 };
    const shopify = gastosVarios[store.domain] || 0;

    const pedidosTienda = pedidosTodas.filter(o => o.shop_domain === store.domain);
    let costoProductos = 0;
    pedidosTienda.filter(o=>!["devuelto","cancelado","pendiente"].includes(o.fulfillment_status)).forEach(o=>{
      try { const raw=o.raw_json?(typeof o.raw_json==="string"?JSON.parse(o.raw_json):o.raw_json):null; if(!raw?.line_items)return; raw.line_items.forEach(item=>{ costoProductos+=(parseFloat(stockMap[String(item.product_id)])||0)*(parseInt(variantesMap[String(item.variant_id)])||1)*(parseInt(item.quantity)||1); }); } catch{}
    });

    const enviosTiendaMRW = pedidosTienda.filter(o => estadosEnvioMRW.includes(o.fulfillment_status));
    const devTienda = enviosTiendaMRW.filter(o => o.fulfillment_status === "devuelto").length;
    const enviosTienda = enviosTiendaMRW.length + devTienda;
    const mrwUnitario = totalEnviosGlobales > 0 ? totalMRW / totalEnviosGlobales : 0;
    const mrw = mrwUnitario * enviosTienda;
    const logisticaUnitaria = totalPedidosGlobales > 0 ? totalLogistica / totalPedidosGlobales : 0;
    const logistica = logisticaUnitaria * enviosTiendaMRW.length;
    const extrasTotal = (gastosExtras[store.domain]||[]).reduce((s,g)=>s+(parseFloat(g.valor)||0),0);
    const entregadosTienda = pedidosTienda.filter(o => o.fulfillment_status === "entregado");
    const ivaTotal = entregadosTienda.reduce((s,o) => s+(parseFloat(o.total_price)||0)*ivaPorcentaje, 0);

    window.__gastosPorTienda[store.domain] = ads.meta + ads.tiktok + shopify + costoProductos + mrw + logistica + fijoXTienda + nominaXTienda + extrasTotal + ivaTotal;
  });
}

window.loadInformesIngresos  = loadInformesIngresos;window.renderInformesIngresos = renderInformesIngresos;
window.loadInformesBalance   = loadInformesBalance;
window.renderInformesBalance = renderInformesBalance;

async function copiarMesAnteriorGF() {
  const month = document.getElementById("gf-month-sel")?.value;
  const year  = document.getElementById("gf-year-sel")?.value;
  const mes   = `${year}-${String(month).padStart(2,"0")}`;

  const prevDate = new Date(parseInt(year), parseInt(month)-2, 1);
  const prevMes  = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,"0")}`;

  try {
    const r = await fetch(`${API_BASE}/api/gastos-fijos?mes=${prevMes}`, {
      headers: { Authorization: "Bearer " + getActiveToken() }
    });
    const prevItems = await r.json();
    if (!Array.isArray(prevItems)) return;

    for (const prev of prevItems) {
      if ((parseFloat(prev.valor)||0) > 0) {
        await fetch(`${API_BASE}/api/gastos-fijos/${prev.id}/valor`, {
          method: "PUT",
          headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
          body: JSON.stringify({ mes, valor: prev.valor })
        });
      }
      if ((parseFloat(prev.precio_unit)||0) > 0) {
        await fetch(`${API_BASE}/api/gastos-fijos/${prev.id}/precio`, {
          method: "PUT",
          headers: { "Content-Type":"application/json", Authorization:"Bearer "+getActiveToken() },
          body: JSON.stringify({ mes, precio_unit: prev.precio_unit })
        });
      }
    }
    invalidateCache("gastos-fijos");
    loadGastosFijosData();
  } catch(e) { console.error(e); }
}
window.copiarMesAnteriorGF = copiarMesAnteriorGF;


// =========================
// CARGAR PEDIDOS REALES
// =========================
let allOrders = [];

// ===== CACHÉ GLOBAL DE DATOS =====
const __cache = {};
const __cacheTime = {};
const CACHE_TTL = 60000; // 1 minuto

async function cachedFetch(url, opts = {}) {
  const now = Date.now();
  if (__cache[url] && (now - (__cacheTime[url]||0)) < CACHE_TTL) return __cache[url];
  try {
    const r = await fetch(url, opts);
    const data = await r.json();
    __cache[url] = data;
    __cacheTime[url] = now;
    return data;
  } catch { return null; }
}

function invalidateCache(pattern) {
  Object.keys(__cache).forEach(k => { if (k.includes(pattern)) { delete __cache[k]; delete __cacheTime[k]; } });
}
window.invalidateCache = invalidateCache;

// ===== ACTUALIZACIÓN EN SEGUNDO PLANO =====
async function refreshCacheBackground() {
  const token = getActiveToken();
  if (!token) return;
  const h = { Authorization: "Bearer " + token };
  const now = new Date();
  const mes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  const urls = [
    `${API_BASE}/api/shopify/stores`,
    `${API_BASE}/api/shopify/stock`,
    `${API_BASE}/api/shopify/variantes-config`,
    `${API_BASE}/api/shopify/products`,
    `${API_BASE}/api/impuestos`,
    `${API_BASE}/api/shopify/precios-globales`,
    `${API_BASE}/api/gastos-fijos?mes=${mes}`,
    `${API_BASE}/api/gastos-varios?mes=${mes}`,
    `${API_BASE}/api/gastos-varios/extras?mes=${mes}`,
    `${API_BASE}/api/nomina/total?mes=${mes}`,
    `${API_BASE}/api/nomina/trabajadores`,
    `${API_BASE}/api/orders/reembolso-estado`,
  ];

  // Actualiza en paralelo sin bloquear nada
  Promise.all(urls.map(async url => {
    try {
      const r = await fetch(url, { headers: h });
      const data = await r.json();
      __cache[url] = data;
      __cacheTime[url] = Date.now();
    } catch {}
  }));
}

// Arrancar refresco en segundo plano cada 55 segundos
// (5 segundos antes de que expire el caché de 1 minuto)
setInterval(refreshCacheBackground, 55000);

// Estado de filtros de pedidos (server-side)
let ordersState = { q: "", status: "", shop: "", dateFrom: "", dateTo: "", page: 1 };
let ordersTotal = 0, ordersPages = 0;
let __ordersFetchId = 0;

async function fetchOrdersFiltered() {
  const body = document.getElementById("ordersBody");
  if (!body) return;

  const fetchId = ++__ordersFetchId;
  body.style.opacity = "0.5";

  const params = new URLSearchParams({ page: ordersState.page, limit: 50 });
  if (ordersState.q)        params.set("q",       ordersState.q);
  if (ordersState.status)   params.set("status",   ordersState.status);
  if (ordersState.shop)     params.set("shop",     ordersState.shop);
  if (ordersState.dateFrom) params.set("from",     ordersState.dateFrom);
  if (ordersState.dateTo)   params.set("to",       ordersState.dateTo);

  try {
    const res = await fetch(`${API_BASE}/api/orders?${params}`, {
      headers: { Authorization: "Bearer " + getActiveToken() }
    });
    if (fetchId !== __ordersFetchId) return; // respuesta obsoleta
    const data = await res.json();
    const orders = data.orders || [];
    ordersTotal = data.total || 0;
    ordersPages = data.pages || 1;
    renderOrders(orders, ordersTotal, ordersState.page, ordersPages);
  } catch (e) {
    if (fetchId !== __ordersFetchId) return;
    body.innerHTML = `<div style="color:#dc2626;padding:16px;">Error cargando pedidos</div>`;
  } finally {
    body.style.opacity = "1";
  }
}

async function fetchOrders() {
  const body = document.getElementById("ordersBody");
  if (!body) return;

  // Si venimos de una notificación, buscar ese pedido directamente
  if (window.__pendingSearchNoti) {
    const orderId = window.__pendingSearchNoti;
    window.__pendingSearchNoti = null;
    try {
      const res = await fetch(`${API_BASE}/api/orders?q=${encodeURIComponent(orderId)}&page=1&limit=1`, {
        headers: { Authorization: "Bearer " + getActiveToken() }
      });
      const data = await res.json();
      const order = (data.orders || [])[0];
      if (order) {
        const q = order.order_number || "";
        const searchEl = document.getElementById("search");
        if (searchEl) searchEl.value = q;
        ordersState = { ...ordersState, q, page: 1 };
        await fetchOrdersFiltered();
        return;
      }
    } catch {}
  }

  ordersState = { q: "", status: "", shop: "", dateFrom: "", dateTo: "", page: 1 };
  await fetchOrdersFiltered();
}

let currentDisplayOrders = [];

function renderOrders(orders, total, page, pages) {
  currentDisplayOrders = orders;
  renderOrdersPage(orders, total || orders.length, page || 1, pages || 1);
}

function renderOrdersPage(pageOrders, total, page, totalPages) {
  if (!pageOrders) { pageOrders = currentDisplayOrders; }
  if (!total)      { total = pageOrders.length; }
  if (!page)       { page = ordersState.page || 1; }
  if (!totalPages) { totalPages = ordersPages || 1; }

  const body = document.getElementById("ordersBody");
  const pagination = document.getElementById("ordersPagination");
  if (!body) return;

  if (!pageOrders.length) {
    body.innerHTML = `<div class="muted" style="padding:16px;">No hay pedidos todavía</div>`;
    if (pagination) pagination.innerHTML = "";
    return;
  }

  const ORDERS_PER_PAGE = 50;
  const start = (page - 1) * ORDERS_PER_PAGE;

  const counter = document.getElementById("orders-counter");
  if (counter) {
    const desde = total === 0 ? 0 : start + 1;
    const hasta = Math.min(start + pageOrders.length, total);
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
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.created_at ? new Date(o.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day:"2-digit", month:"2-digit", year:"numeric" }) : "-"}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.tracking_number ? `<a href="https://www.mrw.es/seguimiento_envios/MRW_historico_nacional.asp?enviament=${encodeURIComponent(o.tracking_number)}" target="_blank" style="color:#16a34a;text-decoration:none;font-weight:500;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(o.tracking_number)}</a>` : "-"}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span class="status ${statusClass(o.fulfillment_status)}">${statusLabel(o.fulfillment_status)}</span></div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(o.customer_name || "-")}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.total_price || 0} ${escapeHtml(o.currency || "")}</div>
    </div>`;
  }).join("");

if (pagination) {
    if (totalPages < 1) { pagination.innerHTML = ""; return; }
    const p = page;
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
  ordersState = { ...ordersState, page };
  fetchOrdersFiltered();
  const table = document.querySelector(".orders-table");
  if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
}
window.goToOrdersPage = goToOrdersPage;

let __filterOrdersTimer = null;
function filterOrders(value) {
  ordersState = { ...ordersState, q: (value || "").trim(), page: 1 };
  clearTimeout(__filterOrdersTimer);
  __filterOrdersTimer = setTimeout(fetchOrdersFiltered, 300);
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
          Authorization: "Bearer " + getActiveToken(),
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
    headers: { Authorization: "Bearer " + getActiveToken() },
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
      headers: { Authorization: "Bearer " + getActiveToken() },
    });
    const secretData = await secretRes.json();
    const appSecret = secretData.app_secret || "";

    const res = await fetch(`${API_BASE}/api/shopify/connect-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getActiveToken(),
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
    window.__showLoadingBar?.("Sincronizando pedidos...");
    const res = await fetch(`${API_BASE}/api/shopify/sync-orders`, {
      method: "POST",
      headers: { Authorization: "Bearer " + getActiveToken() },
    });
    const data = await res.json();
    window.__hideLoadingBar?.();
    // Esperar 8 segundos para que el background sync termine antes de recargar
    setTimeout(async () => {
      await fetchOrders();
      await checkNotificaciones();
    }, 8000);
    // Auto-sincronizar MRW si está integrado
    try {
      const creds = await fetch(`${API_BASE}/api/tracking/mrw-credentials`, {
        headers: { Authorization: "Bearer " + getActiveToken() }
      }).then(r => r.json());
      if (creds.integrated) await sincronizarMRW();
    } catch(e) {}
    if (btn) { btn.textContent = `✓ ${data.synced || 0} pedidos`; }
    setTimeout(() => {
      if (btn) { btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M1 4v6h6" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke-linecap="round" stroke-linejoin="round"/></svg> Sincronizar`; btn.disabled = false; btn.style.opacity = "1"; }
    }, 2000);
  } catch (e) {
    window.__hideLoadingBar?.();
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
      headers: { Authorization: "Bearer " + getActiveToken() },
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
  const status   = document.getElementById("filter-status")?.value || "";
  const shop     = document.getElementById("filter-shop-inline")?.value || "";
  const dateFrom = document.getElementById("filter-date-from")?.value || "";
  const dateTo   = document.getElementById("filter-date-to")?.value || "";

  if (dateFrom && dateTo && dateFrom > dateTo) {
    alert("❌ La fecha de inicio no puede ser mayor que la fecha de fin");
    return;
  }

  ordersState = { ...ordersState, status, shop, dateFrom, dateTo, page: 1 };
  fetchOrdersFiltered();
}

function clearFilters() {
  ordersState = { q: "", status: "", shop: "", dateFrom: "", dateTo: "", page: 1 };
  fetchOrdersFiltered();
  toggleFilterPanel();
}

function clearFiltersInline() {
  ordersState = { q: "", status: "", shop: "", dateFrom: "", dateTo: "", page: 1 };
  const df = document.getElementById("filter-date-from");
  const dt = document.getElementById("filter-date-to");
  const ss = document.getElementById("filter-status");
  const sh = document.getElementById("filter-shop-inline");
  if (df) df.value = "";
  if (dt) dt.value = "";
  if (ss) ss.value = "";
  if (sh) sh.value = "";
  fetchOrdersFiltered();
}
window.clearFiltersInline = clearFiltersInline;

function filterByTab(el, status) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
  ordersState = { ...ordersState, status: status || "", page: 1 };
  fetchOrdersFiltered();
}
function filterByTabMulti(el, statuses) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
  ordersState = { ...ordersState, status: statuses.join(","), page: 1 };
  fetchOrdersFiltered();
}
window.filterByTab = filterByTab;
window.filterByTabMulti = filterByTabMulti;



window.toggleFilterPanel = toggleFilterPanel;
window.selectFilterShop = selectFilterShop;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;

async function addGastoExtra(shop, mes) {
  if (!mes) {
    const m = document.getElementById("gv-month-sel")?.value || (new Date().getMonth()+1);
    const y = document.getElementById("gv-year-sel")?.value || new Date().getFullYear();
    mes = `${y}-${String(m).padStart(2,"0")}`;
  }
  try {
    await fetch(`${API_BASE}/api/gastos-varios/extras`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ shop_domain: shop, mes, nombre: "", valor: 0 })
    });
    await loadGastosVarios();
  } catch(e) { console.error(e); }
}

async function updateGastoExtraNombre(input) {
  const id  = input.dataset.id;
  const val = parseFloat(input.closest("tr")?.querySelector("input[type='number']")?.value) || 0;
  if (!id) return;
  try {
    await fetch(`${API_BASE}/api/gastos-varios/extras/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ nombre: input.value, valor: val })
    });
  } catch(e) { console.error(e); }
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
      headers: { Authorization: "Bearer " + getActiveToken() },
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

async function updateGastoExtraValor(input) {
  const id  = input.dataset.id;
  const nom = input.closest("tr")?.querySelector("input[type='text']")?.value || "";
  if (!id) return;
  try {
    await fetch(`${API_BASE}/api/gastos-varios/extras/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ nombre: nom, valor: parseFloat(input.value) || 0 })
    });
    invalidateCache("gastos-varios");
    await loadGastosVarios();
  } catch(e) { console.error(e); }
}

async function deleteGastoExtra(id) {
  try {
    await fetch(`${API_BASE}/api/gastos-varios/extras/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + getActiveToken() }
    });
    invalidateCache("gastos-varios");
    await loadGastosVarios();
  } catch(e) { console.error(e); }
}

window.addGastoExtra          = addGastoExtra;
window.updateGastoExtraNombre = updateGastoExtraNombre;
window.updateGastoExtraValor  = updateGastoExtraValor;
window.deleteGastoExtra       = deleteGastoExtra;

// =========================
// REEMBOLSOS
// =========================
let reembolsosState = { shop: "", from: "", to: "", page: 1 };

async function loadReembolsos() {
  try {
    const h = { Authorization: "Bearer " + getActiveToken() };
    const estadosData = await cachedFetch(`${API_BASE}/api/orders/reembolso-estado`, { headers: h });
    window.__reembolsosEstados = {};
    if (Array.isArray(estadosData)) {
      estadosData.forEach(e => { window.__reembolsosEstados[e.order_id] = e.estado; });
    }
  } catch(e) { /* ignore */ }
  reembolsosState.page = 1;
  await fetchReembolsosFiltered();
}

function renderReembolsos() {
  reembolsosState = {
    shop: document.getElementById("ree-shop")?.value || "",
    from: document.getElementById("ree-date-from")?.value || "",
    to:   document.getElementById("ree-date-to")?.value || "",
    page: 1
  };
  fetchReembolsosFiltered();
}

async function fetchReembolsosFiltered() {
  const h = { Authorization: "Bearer " + getActiveToken() };
  const params = new URLSearchParams({ page: reembolsosState.page, limit: 50 });
  if (reembolsosState.shop) params.set("shop", reembolsosState.shop);
  if (reembolsosState.from) params.set("from", reembolsosState.from);
  if (reembolsosState.to)   params.set("to",   reembolsosState.to);
  // Pasar filtro de tab al servidor para que pagine correctamente
  const tabFilter = window.__reeTabFilter || "";
  if (tabFilter) params.set("estado", tabFilter);

  const body       = document.getElementById("reeBody");
  const pagination = document.getElementById("reePagination");
  const counter    = document.getElementById("ree-counter");
  try {
    const data    = await fetch(`${API_BASE}/api/orders/reembolsos?${params}`, { headers: h }).then(r => r.json());
    const orders  = data.orders || [];
    const total   = data.total  || 0;
    const page    = data.page   || 1;
    const pages   = data.pages  || 1;

    if (counter) counter.textContent = total ? `Mostrando ${(page-1)*50+1}–${Math.min(page*50, total)} de ${total} reembolsos` : "";

    if (!orders.length) {
      if (body) body.innerHTML = `<div class="muted" style="padding:16px;">No hay reembolsos pendientes</div>`;
      if (pagination) pagination.innerHTML = "";
      return;
    }

    if (body) {
      body.innerHTML = orders.map((o, idx) => {
        const numero     = (page-1)*50 + idx + 1;
        // El servidor devuelve estado_pago directamente
        const estadoPago = o.estado_pago || (window.__reembolsosEstados || {})[o.id] || "pendiente";
        return `
        <div class="orders-row" style="display:grid;grid-template-columns:30px 1fr 1fr 1fr 1fr 1fr 1fr;gap:0;">
          <div style="color:#9ca3af;font-size:12px;display:flex;align-items:center;">${numero}</div>
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(o.order_number || "-")}</div>
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.tracking_number ? `<a href="https://www.mrw.es/seguimiento_envios/MRW_historico_nacional.asp?enviament=${encodeURIComponent(o.tracking_number)}" target="_blank" style="color:#16a34a;text-decoration:none;font-weight:500;font-size:12px;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(o.tracking_number)}</a>` : "-"}</div>
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.created_at ? new Date(o.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day:"2-digit", month:"2-digit", year:"numeric" }) : "-"}</div>
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${escapeHtml(o.customer_name || "-")}</div>
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.total_price || 0} ${escapeHtml(o.currency || "")}</div>
          <div style="display:flex;align-items:center;">
            ${estadoPago === "cobrado"
              ? `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;background:#dcfce7;border:1px solid #86efac;border-radius:999px;font-size:12px;font-weight:600;color:#16a34a;">✅ Pagado</span>`
              : `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;background:#fef9c3;border:1px solid #fde047;border-radius:999px;font-size:12px;font-weight:600;color:#92400e;">⏳ Pendiente</span>`
            }
          </div>
        </div>`;
      }).join("");
    }

    if (pagination) {
      if (pages <= 1) { pagination.innerHTML = ""; return; }
      const p = page;
      const delta = 2;
      let pagesHtml = "";
      pagesHtml += `<button onclick="goToReePage(${Math.max(1,p-1)})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;background:var(--card);color:${p===1?"#d1d5db":"var(--text)"};font-size:13px;cursor:pointer;font-family:inherit;" ${p===1?"disabled":""}>‹</button>`;
      let sp = Math.max(1,p-delta), ep = Math.min(pages,p+delta);
      if (sp > 1) { pagesHtml += `<button onclick="goToReePage(1)" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;background:var(--card);color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;">1</button>`; if (sp>2) pagesHtml += `<span style="padding:0 4px;color:#9ca3af;line-height:34px;">…</span>`; }
      for (let i=sp;i<=ep;i++) { const a=i===p; pagesHtml += `<button onclick="goToReePage(${i})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid ${a?"#16a34a":"#e5e7eb"};background:${a?"#16a34a":"var(--card)"};color:${a?"#fff":"var(--text)"};font-size:13px;font-weight:${a?"700":"400"};cursor:pointer;font-family:inherit;">${i}</button>`; }
      if (ep < pages) { if (ep<pages-1) pagesHtml += `<span style="padding:0 4px;color:#9ca3af;line-height:34px;">…</span>`; pagesHtml += `<button onclick="goToReePage(${pages})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;background:var(--card);color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;">${pages}</button>`; }
      pagesHtml += `<button onclick="goToReePage(${Math.min(pages,p+1)})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #e5e7eb;background:var(--card);color:${p===pages?"#d1d5db":"var(--text)"};font-size:13px;cursor:pointer;font-family:inherit;" ${p===pages?"disabled":""}>›</button>`;
      pagination.innerHTML = pagesHtml;
    }
  } catch(e) {
    if (body) body.innerHTML = `<div style="color:#dc2626;padding:16px;">Error cargando reembolsos</div>`;
  }
}

function goToReePage(page) {
  reembolsosState = { ...reembolsosState, page };
  fetchReembolsosFiltered();
}

async function cambiarEstadoReembolso(orderId, estado) {
  try {
    await fetch(`${API_BASE}/api/orders/reembolso-estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ order_id: String(orderId), estado })
    });
    if (!window.__reembolsosEstados) window.__reembolsosEstados = {};
    window.__reembolsosEstados[orderId] = estado;
  } catch(e) { console.error(e); }
  await fetchReembolsosFiltered();
  loadSidebarReembolsos();
}

function clearReembolsosFilters() {
  const df = document.getElementById("ree-date-from");
  const dt = document.getElementById("ree-date-to");
  const sh = document.getElementById("ree-shop");
  if (df) df.value = "";
  if (dt) dt.value = "";
  if (sh) sh.value = "";
  window.__reeTabFilter = "";
  renderReembolsos();
}

function filterReeByTab(el, estado) {
  document.querySelectorAll(".tabs .tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
  window.__reeTabFilter = estado;
  renderReembolsos();
}

window.loadReembolsos         = loadReembolsos;
window.renderReembolsos       = renderReembolsos;
window.fetchReembolsosFiltered = fetchReembolsosFiltered;
window.goToReePage            = goToReePage;
window.cambiarEstadoReembolso = cambiarEstadoReembolso;
window.clearReembolsosFilters = clearReembolsosFilters;
window.filterReeByTab         = filterReeByTab;

// =========================
// SIDEBAR CONTADOR REEMBOLSOS
// =========================
async function loadSidebarReembolsos() {
  try {
    const h = { Authorization: "Bearer " + getActiveToken() };
    // Pedir solo 1 fila — solo necesitamos total y total_amount de los pendientes
    const reeData = await fetch(`${API_BASE}/api/orders/reembolsos?limit=1&page=1&estado=pendiente`, { headers: h }).then(r => r.json());

    const countEl = document.getElementById("sidebar-ree-count");
    const totalEl = document.getElementById("sidebar-ree-total");
    if (countEl) countEl.textContent = reeData.total || 0;
    if (totalEl) totalEl.textContent = parseFloat(reeData.total_amount || 0).toFixed(2) + " €";
  } catch(e) {
    console.error("Error sidebar reembolsos:", e);
  }
}
window.loadSidebarReembolsos = loadSidebarReembolsos;

// =========================
// NOTIFICACIONES REALES
// =========================
async function checkNotificaciones() {
  try {
    const ahora60 = new Date(); ahora60.setDate(ahora60.getDate() - 60);
    const desde60 = ahora60.toISOString().split("T")[0];
    const res = await fetch(`${API_BASE}/api/orders?from=${desde60}&light=1&page=1&limit=1000`, {
      headers: { Authorization: "Bearer " + getActiveToken() }
    });
    const raw = await res.json();
    const orders = Array.isArray(raw) ? raw : (raw?.orders || []);
    if (!Array.isArray(orders) || !orders.length) return;

    const ahora = new Date();
    const sietesDias = 7 * 24 * 60 * 60 * 1000;

    // Estados que guardamos para detectar cambios
    const estadosGuardados = JSON.parse(localStorage.getItem("orders_estados") || "{}");
    const nuevosEstados = {};
    const notisActuales = JSON.parse(localStorage.getItem("notifications") || "[]");
    const notisIds = new Set(notisActuales.map(n => n.id));
    const nuevasNotis = [...notisActuales];

    for (const o of orders) {
      const id = String(o.id || o.order_id);
      const estado = o.fulfillment_status;
      const nombre = o.order_number || id;
      nuevosEstados[id] = estado;

      const estadoAnterior = estadosGuardados[id];

      const ahoraISO = new Date().toISOString();
      const ahoraMadrid = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const horaDetectada = ahoraMadrid; // "20/03/2026, 14:35"

      // 1. Entregado
      if (estado === "entregado" && estadoAnterior && estadoAnterior !== "entregado") {
        const notiId = `entregado_${id}`;
        if (!notisIds.has(notiId)) {
          const txt = `${nombre} — ${o.customer_name || ""} · Su pedido fue entregado a las ${horaDetectada}`;
          nuevasNotis.unshift({ id: notiId, title: "✅ Pedido entregado", text: txt, date: ahoraISO });
          notisIds.add(notiId);
          showToast("✅ Pedido entregado", txt, "#16a34a");
        }
      }

      // 2. Franquicia
      if (estado === "franquicia" && estadoAnterior && estadoAnterior !== "franquicia") {
        const notiId = `franquicia_${id}`;
        if (!notisIds.has(notiId)) {
          const txt = `${nombre} — ${o.customer_name || ""} · Dejado en franquicia a las ${horaDetectada}. Llamar al cliente.`;
          nuevasNotis.unshift({ id: notiId, title: "🏪 Pedido en franquicia", text: txt, date: ahoraISO });
          notisIds.add(notiId);
          showToast("🏪 Pedido en franquicia", txt, "#f59e0b");
        }
      }

      // 3. Más de 7 días sin resolver
      const estadosSinResolver = ["en_transito", "franquicia", "enviado", "en_preparacion"];
      if (estadosSinResolver.includes(estado) && o.created_at) {
        const fechaPedido = new Date(o.created_at);
        const diasTranscurridos = Math.floor((ahora - fechaPedido) / (1000 * 60 * 60 * 24));
        if (diasTranscurridos >= 7) {
          const notiId = `7dias__${id}`;
          const gestionados = JSON.parse(localStorage.getItem("notis_gestionadas") || "[]");
          if (!notisIds.has(notiId) && !gestionados.includes(notiId)) {
            const txt = `${nombre} — ${o.customer_name || ""} (${estado})`;
            nuevasNotis.unshift({ id: notiId, title: `⚠️ ${diasTranscurridos} días sin resolver`, text: txt, date: ahoraISO });
            notisIds.add(notiId);
            showToast(`⚠️ ${diasTranscurridos} días sin resolver`, txt, "#f59e0b");
          }
        }
      }
    }

    localStorage.setItem("orders_estados", JSON.stringify(nuevosEstados));
    localStorage.setItem("notifications", JSON.stringify(nuevasNotis));

    const panel = document.getElementById("notifPanel");
    const d = dict();
    if (panel) renderNotifPanel(panel, nuevasNotis, d);
    updateNotifBadge(nuevasNotis.length);

  } catch(e) {
    console.error("Error checkNotificaciones:", e);
  }
}

function showToast(title, text, color) {
  const id = "toast_" + Date.now();
  const toast = document.createElement("div");
  toast.id = id;
  toast.style.cssText = `
    position:fixed;
    bottom:24px;
    right:24px;
    background:#fff;
    border:1px solid #e5e7eb;
    border-left:4px solid ${color || "#16a34a"};
    border-radius:10px;
    box-shadow:0 4px 20px rgba(0,0,0,0.12);
    padding:14px 18px;
    max-width:320px;
    z-index:99999;
    font-family:inherit;
    display:flex;
    align-items:flex-start;
    gap:10px;
    opacity:1;
    transition:opacity 0.6s ease, transform 0.6s ease;
    transform:translateY(0);
  `;
  toast.innerHTML = `
    <div style="flex:1;">
      <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:3px;">${escapeHtml(title)}</div>
      <div style="font-size:12px;color:#6b7280;">${escapeHtml(text)}</div>
    </div>
    <div onclick="document.getElementById('${id}')?.remove()" style="cursor:pointer;color:#9ca3af;font-size:16px;line-height:1;flex-shrink:0;">×</div>
  `;
  document.body.appendChild(toast);

  // Desvanece después de 4 segundos
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(16px)";
    setTimeout(() => toast.remove(), 700);
  }, 4000);
}
window.showToast = showToast;
window.checkNotificaciones = checkNotificaciones;

function irAPedidoDesdeNotif(notiId) {
  closeAllDrops();

  if (notiId.startsWith("stock_bajo__")) {
    const productId = notiId.replace("stock_bajo__", "");
    window.__pendingProductoId = productId;
    setSection("productos");
    return;
  }

  const orderId = notiId.includes("__") ? notiId.split("__")[1] : notiId.split("_").pop();
  window.__pendingSearchNoti = orderId;
  setSection("pedidos");
}

function marcarGestionado(event, notiId) {
  event.stopPropagation();
  // Guardar en lista de gestionados para no volver a notificar
  const gestionados = JSON.parse(localStorage.getItem("notis_gestionadas") || "[]");
  if (!gestionados.includes(notiId)) gestionados.push(notiId);
  localStorage.setItem("notis_gestionadas", JSON.stringify(gestionados));

  // Eliminar de la lista de notificaciones
  const list = JSON.parse(localStorage.getItem("notifications") || "[]");
  const next = list.filter(n => n.id !== notiId);
  localStorage.setItem("notifications", JSON.stringify(next));

  const d = dict();
  const panel = document.getElementById("notifPanel");
  renderNotifPanel(panel, next, d);
  updateNotifBadge(next.length);
}
window.irAPedidoDesdeNotif = irAPedidoDesdeNotif;
window.marcarGestionado = marcarGestionado;

// =========================
// IMPORTAR PAGADOS DESDE PDF MRW
// =========================
async function importarPagadosPDF(input) {
  const files = Array.from(input.files);
  input.value = "";
  if (!files.length) return;

  // Cargar pdf.js una sola vez antes de procesar todos
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  let totalActualizados = 0;
  let totalSeguimientos = 0;
  let errores = 0;

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(" ") + " ";
    }

    // Extraer todos los números de seguimiento que empiezan por 04700
    const matches = [...new Set(fullText.match(/04700[A-Z0-9]{6,12}/g) || [])];

    if (matches.length === 0) {
      alert("❌ No se encontraron números de seguimiento 04700 en el PDF");
      return;
    }

    // Cargar todos los reembolsos para cruzar con los tracking del PDF
    const reeH = { Authorization: "Bearer " + getActiveToken() };
    const reeData = await fetch(`${API_BASE}/api/orders/reembolsos?limit=500&page=1`, { headers: reeH }).then(r => r.json()).catch(() => ({ orders: [] }));
    const todosReembolsos = reeData.orders || [];

    // Marcar como cobrados los pedidos que coincidan
    let actualizados = 0;
    for (const o of todosReembolsos) {
      const tracking = (o.tracking_number || "").trim().toUpperCase();
      if (matches.some(m => m.toUpperCase() === tracking)) {
        await fetch(`${API_BASE}/api/orders/reembolso-estado`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
          body: JSON.stringify({ order_id: String(o.id), tracking_number: (o.tracking_number || "").trim().toUpperCase() || null, estado: "cobrado" })
        });
        if (!window.__reembolsosEstados) window.__reembolsosEstados = {};
        window.__reembolsosEstados[o.id] = "cobrado";
        actualizados++;
      }
    }

    totalActualizados += actualizados;
      totalSeguimientos += matches.length;

    } catch(e) {
      console.error("Error en archivo " + file.name + ":", e);
      errores++;
    }
  } // fin bucle archivos

  let msg = `✅ ${totalActualizados} reembolsos marcados como Pagados\n(${totalSeguimientos} seguimientos encontrados en ${files.length} PDF${files.length > 1 ? "s" : ""})`;
  if (errores > 0) msg += `\n⚠️ ${errores} archivo${errores > 1 ? "s" : ""} no se pudieron leer`;
  alert(msg);
  renderReembolsos();
  loadSidebarReembolsos();
}

async function guardarStock(shopDomain, productId, stock, stockMinimo) {
  const stockNum = parseInt(stock)||0;
  const minimoNum = parseInt(stockMinimo)||5;
  try {
    await fetch(`${API_BASE}/api/shopify/stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ shop_domain: shopDomain, product_id: productId, stock: stockNum, stock_minimo: minimoNum })
    });

    // Notificación campanita si stock bajo
    if (stockNum <= minimoNum) {
      const notiId = `stock_bajo__${productId}`;
      const notis = JSON.parse(localStorage.getItem("notifications") || "[]");
      const yaExiste = notis.find(n => n.id === notiId);
      if (!yaExiste) {

        const productoNombre = (window.__productosNombreMap && window.__productosNombreMap[productId]) || document.querySelector(`tr[data-pid="${productId}"] .producto-nombre`)?.textContent || productId;
        notis.unshift({ id: notiId, title: "📦 Stock bajo", text: `${productoNombre} — quedan ${stockNum} uds (mín: ${minimoNum})` });
        localStorage.setItem("notifications", JSON.stringify(notis));
        showToast("📦 Stock bajo", `${productoNombre} — quedan ${stockNum} uds (mín: ${minimoNum})`, "#dc2626");
        const panel = document.getElementById("notifPanel");
        const d = dict();
        if (panel) renderNotifPanel(panel, notis, d);
        updateNotifBadge(notis.length);
      }
    } else {
      // Si sube el stock, eliminar la notificación de stock bajo
      const notiId = `stock_bajo__${productId}`;
      const notis = JSON.parse(localStorage.getItem("notifications") || "[]");
      const next = notis.filter(n => n.id !== notiId);
      if (next.length !== notis.length) {
        localStorage.setItem("notifications", JSON.stringify(next));
        const panel = document.getElementById("notifPanel");
        const d = dict();
        if (panel) renderNotifPanel(panel, next, d);
        updateNotifBadge(next.length);
      }
    }

    // Recargar solo el input de stock sin recargar toda la tabla
    invalidateCache("stock");
    const inputStock = document.querySelector(`tr[data-pid="${productId}"] input[title="Stock actual"]`);
    if (inputStock) inputStock.style.borderColor = stockNum <= minimoNum ? "#dc2626" : "#e5e7eb";
  } catch(e) { console.error(e); }
}

async function guardarCostoCompra(shopDomain, productId, costo) {
  try {
    await fetch(`${API_BASE}/api/shopify/stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ shop_domain: shopDomain, product_id: productId, costo_compra: parseFloat(costo)||0 })
    });
    invalidateCache("stock");
  } catch(e) { console.error(e); }
}
window.guardarCostoCompra = guardarCostoCompra;

async function guardarStockMinimo(shopDomain, productId, stock, stockMinimo) {
  try {
    await fetch(`${API_BASE}/api/shopify/stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ shop_domain: shopDomain, product_id: productId, stock: parseInt(stock)||0, stock_minimo: parseInt(stockMinimo)||5 })
    });
  } catch(e) { console.error(e); }
}

async function guardarVarianteConfig(shopDomain, variantId, unidades) {
  try {
    await fetch(`${API_BASE}/api/shopify/variantes-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ shop_domain: shopDomain, variant_id: variantId, unidades_por_venta: parseInt(unidades)||1 })
    });
  } catch(e) { console.error(e); }
}

async function abrirEntradaMercancia() {
  const modal = document.createElement("div");
  modal.className = "modal-bg";
  modal.id = "modal-entrada-mercancia";
  modal.innerHTML = `
    <div class="modal" style="max-width:700px;width:95%;max-height:85vh;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="margin:0;font-size:16px;font-weight:700;">📦 Entrada de mercancía</h3>
        <span onclick="closeModal()" style="cursor:pointer;font-size:20px;color:#6b7280;">×</span>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button onclick="switchEntradaTab('nueva')" id="tab-nueva"
          style="padding:7px 16px;border-radius:8px;border:1px solid #16a34a;background:#16a34a;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">
          Nueva entrada
        </button>
        <button onclick="switchEntradaTab('historial')" id="tab-historial"
          style="padding:7px 16px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">
          Historial
        </button>
      </div>

      <div id="entrada-content" style="overflow-y:auto;flex:1;">
        <div class="muted" style="padding:16px;">Cargando productos...</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  await cargarTabNuevaEntrada();
}

async function switchEntradaTab(tab) {
  const btnNueva = document.getElementById("tab-nueva");
  const btnHist = document.getElementById("tab-historial");
  if (tab === "nueva") {
    btnNueva.style.background = "#16a34a"; btnNueva.style.color = "#fff"; btnNueva.style.borderColor = "#16a34a";
    btnHist.style.background = "#fff"; btnHist.style.color = "#374151"; btnHist.style.borderColor = "#e5e7eb";
    await cargarTabNuevaEntrada();
  } else {
    btnHist.style.background = "#16a34a"; btnHist.style.color = "#fff"; btnHist.style.borderColor = "#16a34a";
    btnNueva.style.background = "#fff"; btnNueva.style.color = "#374151"; btnNueva.style.borderColor = "#e5e7eb";
    await cargarTabHistorial();
  }
}

async function cargarTabNuevaEntrada() {
  const content = document.getElementById("entrada-content");
  if (!content) return;

  const productos = window.__allProductos || [];
  const stockData = await fetch(`${API_BASE}/api/shopify/stock`, {
    headers: { Authorization: "Bearer " + getActiveToken() }
  }).then(r => r.json()).catch(() => []);

  const stockMap = {};
  if (Array.isArray(stockData)) stockData.forEach(s => { stockMap[s.product_id] = s.stock || 0; });

  if (!productos.length) {
    content.innerHTML = `<div class="muted" style="padding:16px;">Primero sincroniza los productos desde la sección Productos.</div>`;
    return;
  }

  content.innerHTML = `
    <div style="margin-bottom:16px;">
      <input id="entrada-search" type="text" placeholder="🔍 Buscar producto por nombre..."
        oninput="filtrarProductosEntrada()"
        style="width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--card);color:var(--text);">
      <div id="entrada-search-results" style="margin-top:8px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;display:none;"></div>
    </div>
    <div id="entrada-producto-seleccionado" style="display:none;">
      <div id="entrada-producto-card"></div>
    </div>
    <div id="entrada-placeholder" style="padding:32px;text-align:center;color:#9ca3af;font-size:13px;">
      Busca y selecciona un producto para registrar la entrada
    </div>
  `;

  window.__entradaStockMap = stockMap;
  window.__entradaProductos = productos;
}

async function cargarTabHistorial() {
  const content = document.getElementById("entrada-content");
  if (!content) return;
  window.__showLoadingBar?.("Cargando historial...");

  try {
    const rows = await fetch(`${API_BASE}/api/shopify/entradas-mercancia`, {
      headers: { Authorization: "Bearer " + getActiveToken() }
    }).then(r => r.json());

    if (!Array.isArray(rows) || !rows.length) {
      content.innerHTML = `<div class="muted" style="padding:16px;">No hay entradas registradas.</div>`;
      return;
    }

    content.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left;font-weight:600;color:#374151;">Fecha</th>
            <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left;font-weight:600;color:#374151;">Producto</th>
            <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left;font-weight:600;color:#374151;width:80px;">Tienda</th>
            <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;font-weight:600;color:#374151;width:80px;">Cantidad</th>
            <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;font-weight:600;color:#374151;width:80px;">Anterior</th>
            <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;font-weight:600;color:#374151;width:80px;">Nuevo</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
          <tr onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
            <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;white-space:nowrap;">
              ${r.created_at ? new Date(r.created_at).toLocaleString("es-ES") : "-"}
            </td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#111827;">
              ${escapeHtml(r.product_name)}
            </td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:11px;color:#6b7280;">
              ${escapeHtml(r.shop_domain)}
            </td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;font-weight:700;color:#16a34a;">+${r.cantidad}</td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;color:#6b7280;">${r.stock_anterior}</td>
            <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;font-weight:700;color:#16a34a;">${r.stock_nuevo}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    `;
  } catch(e) {
    content.innerHTML = `<div style="color:#dc2626;padding:16px;">Error cargando historial</div>`;
  }
  window.__hideLoadingBar?.();
}

function filtrarProductosEntrada() {
  const q = (document.getElementById("entrada-search")?.value || "").toLowerCase().trim();
  const resultsEl = document.getElementById("entrada-search-results");
  if (!resultsEl) return;

  if (!q) { resultsEl.style.display = "none"; resultsEl.innerHTML = ""; return; }

  const productos = window.__entradaProductos || [];
  const matches = productos.filter(p => (p.title || "").toLowerCase().includes(q)).slice(0, 8);

  if (!matches.length) {
    resultsEl.style.display = "block";
    resultsEl.innerHTML = `<div style="padding:12px 14px;color:#6b7280;font-size:13px;">No se encontraron productos</div>`;
    return;
  }

  resultsEl.style.display = "block";
  resultsEl.innerHTML = matches.map(p => `
    <div onclick="seleccionarProductoEntrada('${String(p.id)}')"
      style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:10px;"
      onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
      ${p.image ? `<img src="${p.image}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0;">` : `<div style="width:32px;height:32px;border-radius:4px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">📦</div>`}
      <div>
        <div style="font-weight:600;color:#111827;">${escapeHtml(p.title)}</div>
        <div style="font-size:11px;color:#9ca3af;">${escapeHtml(p.shop_name || p.shop_domain)}</div>
      </div>
    </div>
  `).join("");
}

function seleccionarProductoEntrada(pid) {
  const productos = window.__entradaProductos || [];
  const p = productos.find(x => String(x.id) === pid);
  if (!p) return;

  const stockActual = (window.__entradaStockMap || {})[pid] || 0;

  const resultsEl = document.getElementById("entrada-search-results");
  const searchEl = document.getElementById("entrada-search");
  if (resultsEl) { resultsEl.style.display = "none"; resultsEl.innerHTML = ""; }
  if (searchEl) searchEl.value = p.title;

  const placeholder = document.getElementById("entrada-placeholder");
  const card = document.getElementById("entrada-producto-seleccionado");
  const cardContent = document.getElementById("entrada-producto-card");
  if (placeholder) placeholder.style.display = "none";
  if (card) card.style.display = "block";

  cardContent.innerHTML = `
    <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#16a34a;padding:14px 18px;display:flex;align-items:center;gap:12px;">
        ${p.image ? `<img src="${p.image}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:2px solid rgba(255,255,255,0.3);">` : `<div style="width:48px;height:48px;border-radius:8px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:22px;">📦</div>`}
        <div>
          <div style="font-weight:700;color:#fff;font-size:14px;">${escapeHtml(p.title)}</div>
          <div style="font-size:12px;color:#bbf7d0;">${escapeHtml(p.shop_name || p.shop_domain)}</div>
        </div>
      </div>
      <div style="padding:20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;align-items:end;">
        <div style="text-align:center;">
          <div style="font-size:11px;color:#6b7280;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Stock actual</div>
          <div style="font-size:28px;font-weight:700;color:#374151;">${stockActual}</div>
          <div style="font-size:11px;color:#9ca3af;">unidades</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:11px;color:#6b7280;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Cantidad a ingresar</div>
          <input type="number" min="1" id="entrada-qty-selected" placeholder="0"
            oninput="actualizarPreviewNuevo(${stockActual})"
            style="width:100%;padding:10px;border:2px solid #16a34a;border-radius:8px;font-size:18px;text-align:center;font-family:inherit;font-weight:700;color:#16a34a;background:var(--card);">
        </div>
        <div style="text-align:center;">
          <div style="font-size:11px;color:#6b7280;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Stock nuevo</div>
          <div style="font-size:28px;font-weight:700;color:#16a34a;" id="entrada-preview-nuevo">${stockActual}</div>
          <div style="font-size:11px;color:#9ca3af;">unidades</div>
        </div>
      </div>
      <div style="padding:0 20px 20px;">
        <button onclick="confirmarEntradaSeleccionada('${pid}','${escapeAttr(p.title)}','${p.shop_domain}',${stockActual})"
          style="width:100%;padding:12px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">
          ✓ Registrar entrada de mercancía
        </button>
      </div>
    </div>
  `;
}

function actualizarPreviewNuevo(stockActual) {
  const qty = parseInt(document.getElementById("entrada-qty-selected")?.value) || 0;
  const el = document.getElementById("entrada-preview-nuevo");
  if (el) {
    el.textContent = stockActual + qty;
    el.style.color = qty > 0 ? "#16a34a" : "#9ca3af";
  }
}

async function confirmarEntradaSeleccionada(productId, productName, shopDomain, stockAnterior) {
  const qty = parseInt(document.getElementById("entrada-qty-selected")?.value) || 0;
  if (qty <= 0) { alert("Ingresa una cantidad mayor a 0"); return; }

  try {
    const res = await fetch(`${API_BASE}/api/shopify/entrada-mercancia`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ shop_domain: shopDomain, product_id: productId, product_name: productName, cantidad: qty, stock_anterior: stockAnterior })
    });
    const data = await res.json();
    if (data.ok) {
      showToast("✅ Entrada registrada", `${productName} — +${qty} uds (stock: ${data.stock_nuevo})`, "#16a34a");
      await cargarTabNuevaEntrada();
      loadProductos();
    }
  } catch(e) { alert("Error registrando entrada"); }
}

window.abrirEntradaMercancia = abrirEntradaMercancia;
window.switchEntradaTab = switchEntradaTab;
window.filtrarProductosEntrada = filtrarProductosEntrada;
window.seleccionarProductoEntrada = seleccionarProductoEntrada;
window.actualizarPreviewNuevo = actualizarPreviewNuevo;
window.confirmarEntradaSeleccionada = confirmarEntradaSeleccionada;
window.guardarVarianteConfig = guardarVarianteConfig;
window.guardarStock = guardarStock;
window.guardarStockMinimo = guardarStockMinimo;
window.importarPagadosPDF = importarPagadosPDF;

// =========================
// INTEGRACIÓN MRW API
// =========================
async function checkMRWIntegration() {
  try {
    const res = await fetch(`${API_BASE}/api/tracking/mrw-credentials`, {
      headers: { Authorization: "Bearer " + getActiveToken() }
    });
    const data = await res.json();
    const btnIntegrar = document.getElementById("btn-mrw-integrar");
    const btnSync = document.getElementById("btn-mrw-sync");
    const btnDesintegrar = document.getElementById("btn-mrw-desintegrar");
    const btnExcel = document.getElementById("btn-importar-excel");
    if (data.integrated) {
      if (btnIntegrar) btnIntegrar.style.display = "none";
      if (btnSync) btnSync.style.display = "";
      if (btnDesintegrar) btnDesintegrar.style.display = "";
      if (btnExcel) btnExcel.style.display = "none";
    } else {
      if (btnIntegrar) btnIntegrar.style.display = "";
      if (btnSync) btnSync.style.display = "none";
      if (btnDesintegrar) btnDesintegrar.style.display = "none";
      if (btnExcel) btnExcel.style.display = "";
    }
  } catch(e) { console.error(e); }
}

function abrirModalMRW() {
  const modal = document.createElement("div");
  modal.className = "modal-bg";
  modal.id = "modal-mrw";
  modal.innerHTML = `
    <div class="modal" style="max-width:460px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        <div style="width:40px;height:40px;border-radius:10px;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-size:20px;">🚚</div>
        <div>
          <h3 style="margin:0;font-size:16px;font-weight:700;">Integrar MRW Webservice</h3>
          <div style="font-size:12px;color:#6b7280;">Sincronización automática de estados de envío</div>
        </div>
      </div>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;font-size:13px;color:#1e40af;margin-bottom:16px;">
        💡 Necesitas las credenciales SAGEC de MRW (Login y Contraseña del WebService TrackingServices)
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Login SAGEC *</label>
          <input id="mrw-login" type="text" placeholder="Ej: CD01234Ejemplo"
            style="width:100%;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--card);color:var(--text);">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Contraseña SAGEC *</label>
          <input id="mrw-pass" type="password" placeholder="Contraseña"
            style="width:100%;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--card);color:var(--text);">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Franquicia</label>
            <input id="mrw-franquicia" type="text" placeholder="Ej: 01234"
              style="width:100%;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--card);color:var(--text);">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Abonado</label>
            <input id="mrw-abonado" type="text" placeholder="Ej: 603835"
              style="width:100%;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--card);color:var(--text);">
          </div>
        </div>
        <div id="mrw-modal-msg" style="font-size:13px;min-height:18px;"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button onclick="closeModal()" style="flex:1;padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;font-weight:600;">Cancelar</button>
        <button onclick="guardarCredencialesMRW()" style="flex:1;padding:10px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:700;">
          ✓ Conectar MRW
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function guardarCredencialesMRW() {
  const login = document.getElementById("mrw-login")?.value.trim();
  const pass  = document.getElementById("mrw-pass")?.value.trim();
  const franquicia = document.getElementById("mrw-franquicia")?.value.trim();
  const abonado    = document.getElementById("mrw-abonado")?.value.trim();
  const msg = document.getElementById("mrw-modal-msg");
  if (!login || !pass) { if (msg) { msg.style.color = "#dc2626"; msg.textContent = "Login y contraseña son obligatorios"; } return; }
  if (msg) { msg.style.color = "#6b7280"; msg.textContent = "Guardando..."; }
  try {
    const res = await fetch(`${API_BASE}/api/tracking/mrw-credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ login, pass, franquicia, abonado })
    });
    const data = await res.json();
    if (data.ok) {
      closeModal();
      showToast("✅ MRW integrado", "La sincronización automática está activa", "#16a34a");
      checkMRWIntegration();
    } else {
      if (msg) { msg.style.color = "#dc2626"; msg.textContent = data.error || "Error guardando"; }
    }
  } catch(e) { if (msg) { msg.style.color = "#dc2626"; msg.textContent = "Error de conexión"; } }
}

function mostrarBarraProgresoMRW(done, total) {
  let bar = document.getElementById("mrw-progress-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "mrw-progress-bar";
    bar.style.cssText = `position:fixed;bottom:20px;right:20px;background:#1e293b;color:#fff;padding:14px 20px;border-radius:12px;font-size:13px;z-index:9999;min-width:260px;box-shadow:0 4px 20px rgba(0,0,0,0.3);`;
    document.body.appendChild(bar);
  }
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  bar.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px;">🔄 Sincronizando MRW...</div>
    <div style="background:#374151;border-radius:6px;overflow:hidden;height:8px;margin-bottom:6px;">
      <div style="background:#16a34a;height:8px;width:${pct}%;transition:width 0.3s;border-radius:6px;"></div>
    </div>
    <div style="color:#9ca3af;font-size:12px;">${done} de ${total} pedidos (${pct}%)</div>
  `;
}

function ocultarBarraProgresoMRW() {
  const bar = document.getElementById("mrw-progress-bar");
  if (bar) bar.remove();
}

async function sincronizarMRW() {
  const btn = document.getElementById("btn-mrw-sync");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Sincronizando..."; }

  // Iniciar polling de progreso
  let pollingInterval = setInterval(async () => {
    try {
      const status = await fetch(`${API_BASE}/api/tracking/mrw-sync-status`, {
        headers: { Authorization: "Bearer " + getActiveToken() }
      }).then(r => r.json());
      if (status.total > 1) mostrarBarraProgresoMRW(status.done, status.total);
    } catch(e) {}
  }, 800);

  try {
    const res = await fetch(`${API_BASE}/api/tracking/mrw-sync`, {
      method: "POST",
      headers: { Authorization: "Bearer " + getActiveToken() }
    });
    const data = await res.json();
    clearInterval(pollingInterval);
    ocultarBarraProgresoMRW();
        if (data.ok) {
      showToast("✅ MRW sincronizado", `${data.updated} pedidos actualizados de ${data.total} consultados`, "#16a34a");
      invalidateCache("orders");
      allOrders = [];
      await fetchOrders();
    } else {
      showToast("❌ Error MRW", data.error || "Error desconocido", "#dc2626");
    }
  } catch(e) {
    clearInterval(pollingInterval);
    ocultarBarraProgresoMRW();
    showToast("❌ Error", "No se pudo conectar con MRW", "#dc2626");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "🔄 Sincronizar MRW"; }
  }
}

async function desintegrarMRW() {
  if (!confirm("⚠️ ¿Estás seguro de que quieres desintegrar MRW?\n\nEsto dejará de sincronizar el estado de tus pedidos automáticamente. Podrás volver a integrar en cualquier momento.")) return;
  try {
    const res = await fetch(`${API_BASE}/api/tracking/mrw-credentials`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + getActiveToken() }
    });
    const data = await res.json();
    if (data.ok) {
      showToast("MRW desintegrado", "Ya no se sincronizarán estados automáticamente", "#f59e0b");
      checkMRWIntegration();
    }
  } catch(e) { console.error(e); }
}

window.abrirModalMRW         = abrirModalMRW;
window.guardarCredencialesMRW = guardarCredencialesMRW;
window.sincronizarMRW        = sincronizarMRW;
window.desintegrarMRW        = desintegrarMRW;
window.checkMRWIntegration   = checkMRWIntegration;