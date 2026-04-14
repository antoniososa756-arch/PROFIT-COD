const API_BASE = "https://profit-cod.onrender.com";

function getActiveToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("impersonated") === "1"
    ? localStorage.getItem("impersonated_token")
    : localStorage.getItem("token");
}

console.log("🟢 app.js cargado");

// Estilo para selección de celdas tipo Excel
if (!document.getElementById("__ads-sel-style")) {
  const s = document.createElement("style");
  s.id = "__ads-sel-style";
  s.textContent = `td.ads-sel { outline: 2px solid #2563eb !important; background: #dbeafe !important; }`;
  document.head.appendChild(s);
}
// ─── Global Dark Date Picker Factory ─────────────────────────────────────────
window.__DPF = (function () {
  const MN  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MNl = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function fmtD(d) {
    if (!d) return '—';
    const [y,m,day] = d.split('-');
    return `${parseInt(day)} de ${MNl[parseInt(m)-1]} de ${y}`;
  }
  function renderMonth(s, year, month) {
    const dim  = new Date(year, month, 0).getDate();
    const fdow = new Date(year, month-1, 1).getDay();
    const today = new Date().toISOString().split('T')[0];
    const p = s._prefix;
    let cells = [];
    for (let i=0;i<fdow;i++) cells.push(null);
    for (let d=1;d<=dim;d++) cells.push(d);
    while (cells.length%7!==0) cells.push(null);
    let rows='';
    for (let i=0;i<cells.length;i+=7) {
      let row='<tr>';
      for (let j=0;j<7;j++) {
        const day=cells[i+j];
        if (!day) { row+='<td style="width:36px;height:36px;"></td>'; continue; }
        const ds=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isS=ds===s.startDate, isE=ds===s.endDate;
        const hi=s.selecting&&s.startDate&&s.hoverDate&&ds>s.startDate&&ds<=s.hoverDate;
        const inR=s.startDate&&s.endDate&&ds>s.startDate&&ds<s.endDate;
        const isT=ds===today;
        let bg='transparent',col='var(--pk-day-text)',fw='400',br='6px',tdBg='transparent';
        if (isS||isE) { bg='#22c55e';col='#fff';fw='700'; }
        else if (inR) { tdBg='rgba(34,197,94,.15)';col='#86efac';fw='500';br='0'; }
        else if (hi)  { tdBg='rgba(34,197,94,.08)';col='#86efac';br='0'; }
        if (isT&&!isS&&!isE) { fw='700';col=inR||hi?col:'#4ade80'; }
        row+=`<td style="width:36px;height:36px;text-align:center;padding:0;background:${tdBg};">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;background:${bg};color:${col};border-radius:${br};font-size:13px;font-weight:${fw};cursor:pointer;transition:all .12s;"
            onclick="window.__DPF.pDay('${p}','${ds}')" onmouseover="window.__DPF.pHover('${p}','${ds}')"
            onmouseenter="if(!${isS||isE})this.style.background='var(--pk-hover)';"
            onmouseleave="if(!${isS||isE})this.style.background='transparent';"
          >${day}</span></td>`;
      }
      row+='</tr>'; rows+=row;
    }
    return `<div>
      <div style="text-align:center;font-size:13px;font-weight:700;color:var(--pk-text);padding-bottom:10px;letter-spacing:.3px;">${MN[month-1]} ${year}</div>
      <table style="border-collapse:collapse;"><thead><tr>${['do','lu','ma','mi','ju','vi','sá'].map(d=>`<th style="width:36px;font-size:10px;color:var(--pk-text3);font-weight:600;text-align:center;padding-bottom:8px;text-transform:uppercase;letter-spacing:.6px;">${d}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }
  function reposition(p) {
    const panel = document.getElementById(`${p}-picker-panel`); if (!panel) return;
    // On very narrow screens: fixed centered modal
    if (window.innerWidth < 600) {
      panel.style.position='fixed';
      panel.style.left='8px'; panel.style.right='8px';
      panel.style.top='50%'; panel.style.bottom='';
      panel.style.transform='translateY(-50%)';
      panel.style.maxHeight='90vh'; panel.style.overflowY='auto';
      panel.style.zIndex='3000';
      return;
    }
    // Desktop: keep absolute positioning, only adjust alignment to prevent overflow
    panel.style.position='absolute';
    panel.style.transform=''; panel.style.maxHeight=''; panel.style.overflowY='';
    panel.style.top='calc(100% + 6px)'; panel.style.bottom='';
    panel.style.right='0'; panel.style.left='';
    const rect = panel.getBoundingClientRect();
    if (rect.left < 8) { panel.style.right='auto'; panel.style.left='0'; }
    else if (rect.right > window.innerWidth - 8) { panel.style.left='auto'; panel.style.right='0'; }
    if (rect.bottom > window.innerHeight - 8) { panel.style.top='auto'; panel.style.bottom='calc(100% + 6px)'; }
  }
  function render(p) {
    const panel = document.getElementById(`${p}-picker-panel`); if (!panel) return;
    const s = window.__DPF._inst[p];
    const vy=s.viewYear, vm=s.viewMonth;
    const lm=vm===1?12:vm-1, ly=vm===1?vy-1:vy;
    const narrow = window.innerWidth < 680;
    const PRESETS=[{key:'hoy',label:'Hoy'},{key:'ayer',label:'Ayer'},{key:'mes',label:'Este mes'},{key:'mes-ant',label:'Mes anterior'},{key:'personalizado',label:'Rango personalizado'}];
    const sidebar=PRESETS.map(q=>{
      const act=s.preset===q.key;
      return `<div onclick="window.__DPF.pPreset('${p}','${q.key}')"
        style="padding:9px 14px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:${act?'600':'400'};color:${act?'#22c55e':'var(--pk-text2)'};background:${act?'rgba(34,197,94,.12)':'transparent'};border-left:${act?'3px solid #22c55e':'3px solid transparent'};transition:all .12s;"
        onmouseover="if(!${act})this.style.background='var(--pk-hover)';" onmouseout="this.style.background='${act?'rgba(34,197,94,.12)':'transparent'}';">${q.label}</div>`;
    }).join('');
    const dateBox=(d,ph)=>`<div style="flex:1;display:flex;align-items:center;gap:7px;padding:9px 13px;border:1.5px solid ${d?'#22c55e':'var(--pk-border2)'};border-radius:9px;background:${d?'rgba(34,197,94,.08)':'var(--pk-input)'};">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="${d?'#22c55e':'var(--pk-text3)'}" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
      <span style="font-size:12.5px;color:${d?'#86efac':'var(--pk-text2)'};font-weight:${d?'500':'400'};white-space:nowrap;">${d?fmtD(d):ph}</span></div>`;
    const navBtn=(dir,lbl)=>`<button onclick="window.__DPF.pNav('${p}',${dir})" style="width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;background:var(--pk-btn-bg);border:1px solid var(--pk-border2);border-radius:7px;cursor:pointer;font-size:15px;color:var(--pk-text2);font-weight:700;transition:all .12s;" onmouseover="this.style.color='var(--pk-text)';this.style.borderColor='var(--pk-border)';" onmouseout="this.style.color='var(--pk-text2)';this.style.borderColor='var(--pk-border2)';">${lbl}</button>`;
    const calSection = narrow
      ? `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">${navBtn(-1,'‹')}<span></span>${navBtn(1,'›')}</div>
         ${renderMonth(s,vy,vm)}`
      : `<div style="display:flex;gap:28px;align-items:flex-start;">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">${navBtn(-1,'‹')}<span></span></div>
            ${renderMonth(s,ly,lm)}
          </div>
          <div style="width:1px;background:var(--pk-border);align-self:stretch;margin-top:42px;"></div>
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><span></span>${navBtn(1,'›')}</div>
            ${renderMonth(s,vy,vm)}
          </div>
        </div>`;
    const sidebarSection = narrow ? '' :
      `<div style="width:176px;padding:18px 10px;background:var(--pk-sidebar);border-right:1px solid var(--pk-border);display:flex;flex-direction:column;gap:2px;">
        <div style="font-size:9.5px;font-weight:700;color:var(--pk-text3);text-transform:uppercase;letter-spacing:.8px;padding:0 8px 10px;">Período</div>
        ${sidebar}
      </div>`;
    const presetMobile = narrow
      ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">${PRESETS.map(q=>{const act=s.preset===q.key;return `<button onclick="window.__DPF.pPreset('${p}','${q.key}')" style="padding:5px 12px;border-radius:999px;font-size:12px;font-weight:${act?'700':'400'};cursor:pointer;background:${act?'#22c55e':'var(--pk-btn-bg)'};color:${act?'#052e16':'var(--pk-text2)'};border:1px solid ${act?'#22c55e':'var(--pk-border2)'};font-family:inherit;">${q.label}</button>`;}).join('')}</div>`
      : '';
    panel.innerHTML=`<div class="dpf-panel" style="display:flex;box-shadow:var(--pk-shadow);border-radius:14px;overflow:hidden;background:var(--pk-bg);border:1px solid var(--pk-border);">
      ${sidebarSection}
      <div style="padding:${narrow?'16px':'20px 26px'};">
        ${presetMobile}
        <div style="display:flex;align-items:center;gap:${narrow?'6px':'10px'};margin-bottom:${narrow?'14px':'20px'};">
          ${dateBox(s.startDate,'Fecha inicio')}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--pk-text3)" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          ${dateBox(s.endDate,'Fecha fin')}
        </div>
        ${calSection}
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:${narrow?'14px':'20px'};padding-top:${narrow?'12px':'16px'};border-top:1px solid var(--pk-border);">
          <button onclick="window.__DPF.pClose('${p}')" style="padding:8px 18px;background:transparent;border:1.5px solid var(--pk-border2);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:var(--pk-text2);transition:all .12s;font-family:inherit;" onmouseover="this.style.borderColor='var(--pk-border)';this.style.color='var(--pk-text)';" onmouseout="this.style.borderColor='var(--pk-border2)';this.style.color='var(--pk-text2)';">Cancelar</button>
          <button onclick="window.__DPF.pApply('${p}')" style="padding:8px 22px;background:#22c55e;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;color:#052e16;box-shadow:0 0 20px rgba(34,197,94,.3);transition:all .12s;font-family:inherit;" onmouseover="this.style.background='#16a34a';this.style.boxShadow='0 0 28px rgba(34,197,94,.5)';" onmouseout="this.style.background='#22c55e';this.style.boxShadow='0 0 20px rgba(34,197,94,.3)';">Aplicar</button>
        </div>
      </div>
    </div>`;
    reposition(p);
  }
  return {
    _inst: {},
    create: function(prefix, from, to, preset, presetLabel, fromKey, toKey, applyFn) {
      const ref = to || new Date().toISOString().split('T')[0];
      const [ry,rm] = ref.split('-').map(Number);
      this._inst[prefix] = { _prefix:prefix, _fromKey:fromKey, _toKey:toKey, _applyFn:applyFn,
        open:false, startDate:from||null, endDate:to||null, hoverDate:null, selecting:false,
        viewYear:ry, viewMonth:rm, preset:preset||'personalizado', presetLabel:presetLabel||'Personalizado' };
      document.removeEventListener('click', this._inst[prefix]._outsideHandler);
      const self = this;
      this._inst[prefix]._outsideHandler = function(e) {
        const s = self._inst[prefix]; if (!s||!s.open) return;
        if (!e.target.isConnected) return;
        const wrap = document.getElementById(`${prefix}-picker-wrap`);
        if (wrap && !wrap.contains(e.target)) self.pClose(prefix);
      };
      document.addEventListener('click', this._inst[prefix]._outsideHandler);
    },
    triggerBtn: function(prefix, label) {
      return `<div style="position:relative;" id="${prefix}-picker-wrap">
        <button onclick="window.__DPF.pToggle('${prefix}')"
          style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:var(--pk-bg);border:1.5px solid var(--pk-border2);border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--pk-text);transition:all .15s;"
          onmouseover="this.style.borderColor='var(--pk-border)';this.style.background='var(--pk-input)';" onmouseout="this.style.borderColor='var(--pk-border2)';this.style.background='var(--pk-bg)';">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          <span id="${prefix}-picker-label">${label}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--pk-text3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div id="${prefix}-picker-panel" style="display:none;position:absolute;right:0;top:calc(100% + 6px);z-index:2000;"></div>
      </div>`;
    },
    pToggle: function(p) {
      const s=this._inst[p], panel=document.getElementById(`${p}-picker-panel`); if(!panel) return;
      if (s.open) { panel.style.display='none'; s.open=false; }
      else {
        const ref=s.endDate||new Date().toISOString().split('T')[0];
        const [ry,rm]=ref.split('-').map(Number); s.viewYear=ry; s.viewMonth=rm;
        panel.style.display='block'; s.open=true; render(p);
      }
    },
    pPreset: function(p, key) {
      const s=this._inst[p]; s.preset=key; s.selecting=false;
      const n=new Date(), fmt=d=>d.toISOString().split('T')[0];
      if (key==='hoy')     { const d=fmt(n); s.startDate=d; s.endDate=d; s.presetLabel='Hoy'; }
      else if (key==='ayer'){ const d=fmt(new Date(n-864e5)); s.startDate=d; s.endDate=d; s.presetLabel='Ayer'; }
      else if (key==='mes') { s.startDate=fmt(new Date(n.getFullYear(),n.getMonth(),1)); s.endDate=fmt(n); s.presetLabel='Este mes'; }
      else if (key==='mes-ant') { s.startDate=fmt(new Date(n.getFullYear(),n.getMonth()-1,1)); s.endDate=fmt(new Date(n.getFullYear(),n.getMonth(),0)); s.presetLabel='Mes anterior'; }
      else if (key==='personalizado') { s.presetLabel='Personalizado'; }
      if (s.endDate) { const [ry,rm]=s.endDate.split('-').map(Number); s.viewYear=ry; s.viewMonth=rm; }
      render(p);
    },
    pNav: function(p, dir) {
      const s=this._inst[p]; s.viewMonth+=dir;
      if (s.viewMonth>12){s.viewMonth=1;s.viewYear++;} if (s.viewMonth<1){s.viewMonth=12;s.viewYear--;}
      render(p);
    },
    pDay: function(p, ds) {
      const s=this._inst[p]; s.preset='personalizado'; s.presetLabel='Personalizado';
      if (!s.selecting||!s.startDate) { s.startDate=ds; s.endDate=null; s.selecting=true; }
      else { if (ds<s.startDate){s.endDate=s.startDate;s.startDate=ds;}else{s.endDate=ds;} s.selecting=false; }
      render(p);
    },
    pHover: function(p, ds) {
      const s=this._inst[p];
      if (s.selecting && s.hoverDate!==ds) { s.hoverDate=ds; render(p); }
    },
    pClose: function(p) {
      const panel=document.getElementById(`${p}-picker-panel`);
      if (panel) panel.style.display='none';
      if (this._inst[p]) this._inst[p].open=false;
    },
    pApply: function(p) {
      const s=this._inst[p]; if (!s.startDate) return;
      if (!s.endDate) s.endDate=s.startDate; s.selecting=false;
      if (s._fromKey) localStorage.setItem(s._fromKey, s.startDate);
      if (s._toKey)   localStorage.setItem(s._toKey,   s.endDate);
      const fi=document.getElementById(`${p}-date-from`), ti=document.getElementById(`${p}-date-to`);
      if (fi) fi.value=s.startDate; if (ti) ti.value=s.endDate;
      const lbl=document.getElementById(`${p}-picker-label`); if (lbl) lbl.textContent=s.presetLabel;
      this.pClose(p);
      if (typeof s._applyFn==='function') s._applyFn();
    }
  };
})();
// ─────────────────────────────────────────────────────────────────────────────

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
        name: data.user.display_name || data.user.email,
        email: data.user.email,
        display_name: data.user.display_name || "",
        role: data.user.role === "admin" ? "Administrador" : "Cliente",
        avatar_url: data.user.avatar_url || null,
      };

      // 🎨 CLASE DE ROL EN EL BODY (ADMIN / CLIENTE)
      document.body.classList.remove("role-admin", "role-client");
      document.body.classList.add(
        data.user.role === "admin" ? "role-admin" : "role-client"
      );

      // Cargar estado del plan para clientes
      window.__userPlan = {};
      if (data.user.role !== "admin") {
        fetch(`${API_BASE}/api/billing/plan`, { headers: { Authorization: "Bearer " + token } })
          .then(r => r.json()).then(p => {
            window.__userPlan = p;
            updateOrderLimitBanner();
            // Si el plan es válido recargar la sección actual (puede estar bloqueada por timing)
            const planOk = p.plan && p.plan !== "free"
              && (p.status === "active" || p.status === "trial")
              && (!p.expires_at || new Date(p.expires_at) > new Date());
            if (planOk) {
              const cur = localStorage.getItem("section") || "metricas";
              if (cur !== "plan") setSection(cur);
            }
          }).catch(() => {});
      } else {
        window.__userPlan = { plan: "admin", status: "active", expires_at: null };
      }

      // 🚀 Cargar app UNA sola vez
      // Detectar retorno del flujo OAuth de Gmail
      const _hash = window.location.hash;
      if (_hash.includes("integraciones")) {
        localStorage.setItem("section", "tiendas"); // iremos a integraciones
        const _gmailStatus = new URLSearchParams(_hash.replace("#","?")).get("gmail");
        loadApp("tiendas");
        setTimeout(() => {
          if (typeof window.switchIntegracionesTab === "function") {
            window.switchIntegracionesTab("reembolsos");
            if (_gmailStatus === "ok") {
              setTimeout(() => { if (typeof window.cargarConfigGmail === "function") window.cargarConfigGmail(); }, 500);
            }
          }
        }, 800);
        history.replaceState(null, "", "/");
      } else {
        loadApp(localStorage.getItem("section") || "metricas");
      }
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
      <rect x="3" y="3" width="7" height="9" rx="1.5"/>
      <rect x="14" y="3" width="7" height="5" rx="1.5"/>
      <rect x="14" y="12" width="7" height="9" rx="1.5"/>
      <rect x="3" y="16" width="7" height="5" rx="1.5"/>
    </svg>
  `,
  rentabilidad: `
    <svg viewBox="0 0 24 24">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="16 7 22 7 22 13" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
  tiendas: `
    <svg viewBox="0 0 24 24">
      <path d="M3 9h18" stroke-linecap="round"/>
      <path d="M4.5 5h15l1.5 4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" stroke-linecap="round"/>
      <path d="M10 20v-5a2 2 0 0 1 4 0v5" stroke-linecap="round"/>
      <path d="M9 9v1a3 3 0 0 1-6 0V9" stroke-linecap="round"/>
      <path d="M15 9v1a3 3 0 0 0 6 0V9" stroke-linecap="round"/>
    </svg>
  `,
  productos: `
    <svg viewBox="0 0 24 24">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="12" y1="22.08" x2="12" y2="12" stroke-linecap="round"/>
    </svg>
  `,
  pedidos: `
    <svg viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="9" y="3" width="6" height="4" rx="1.5"/>
      <line x1="9" y1="12" x2="15" y2="12" stroke-linecap="round"/>
      <line x1="9" y1="16" x2="12" y2="16" stroke-linecap="round"/>
    </svg>
  `,
  facturas: `
    <svg viewBox="0 0 24 24">
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="9" y1="8" x2="15" y2="8" stroke-linecap="round"/>
      <line x1="9" y1="12" x2="15" y2="12" stroke-linecap="round"/>
      <line x1="9" y1="16" x2="12" y2="16" stroke-linecap="round"/>
    </svg>
  `,
  informes: `
    <svg viewBox="0 0 24 24">
      <line x1="18" y1="20" x2="18" y2="4" stroke-linecap="round"/>
      <line x1="12" y1="20" x2="12" y2="10" stroke-linecap="round"/>
      <line x1="6" y1="20" x2="6" y2="14" stroke-linecap="round"/>
      <line x1="3" y1="20" x2="21" y2="20" stroke-linecap="round"/>
    </svg>
  `,
  ayuda: `
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="17" r=".5" fill="currentColor"/>
    </svg>
  `,
  plan: `
    <svg viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
      <line x1="7" y1="15" x2="7.5" y2="15" stroke-linecap="round" stroke-width="3"/>
      <line x1="11" y1="15" x2="14" y2="15" stroke-linecap="round"/>
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
      rentabilidad: "Rentabilidad",
      tiendas: "Integraciones",
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
  function getNotifKey() {
    return "notifications_" + (currentUser?.id || "anon");
  }

  function getNotifications(d) {
    let list = null;
    try {
      list = JSON.parse(localStorage.getItem(getNotifKey()) || "null");
    } catch (e) {
      list = null;
    }
    if (!Array.isArray(list)) {
      list = [];
      localStorage.setItem(getNotifKey(), JSON.stringify(list));
    }
    return list;
  }

  function setNotifications(list) {
    localStorage.setItem(getNotifKey(), JSON.stringify(list || []));
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
    showToast("✅ Tienda conectada", "La tienda Shopify se conectó correctamente", "#22c55e");
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
    <div id="sidebar-backdrop" onclick="closeSidebarMobile()"></div>
    <div class="sidebar" id="sidebar">
      <div class="logo-zone">
        <div class="logo-wrapper">
          <div style="cursor:default;display:flex;flex-direction:column;align-items:center;gap:4px;">
            <!-- Laptop icon -->
            <svg width="48" height="34" viewBox="0 0 48 34" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="lg-screen" x1="0" y1="0" x2="48" y2="34" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#059669"/>
                  <stop offset="100%" stop-color="#10b981"/>
                </linearGradient>
              </defs>
              <!-- Base -->
              <rect x="1" y="28" width="46" height="4" rx="2" fill="#d1d5db"/>
              <rect x="8" y="27" width="32" height="2" rx="1" fill="#e5e7eb"/>
              <!-- Tapa/cuerpo -->
              <rect x="5" y="3" width="38" height="26" rx="4" fill="#1e293b"/>
              <rect x="7" y="5" width="34" height="22" rx="3" fill="#0f172a"/>
              <!-- Pantalla -->
              <rect x="8" y="6" width="32" height="20" rx="2" fill="url(#lg-screen)" opacity="0.15"/>
              <!-- Barra top verde -->
              <rect x="8" y="6" width="32" height="4" rx="2" fill="#10b981"/>
              <!-- Dashboard mini lines -->
              <rect x="10" y="13" width="12" height="1.5" rx="0.75" fill="#10b981" opacity="0.8"/>
              <rect x="10" y="16" width="8" height="1.5" rx="0.75" fill="#334155"/>
              <rect x="10" y="19" width="10" height="1.5" rx="0.75" fill="#334155"/>
              <!-- Mini bar chart -->
              <rect x="26" y="19" width="3" height="4" rx="1" fill="#10b981" opacity="0.5"/>
              <rect x="30" y="16" width="3" height="7" rx="1" fill="#10b981" opacity="0.7"/>
              <rect x="34" y="17" width="3" height="6" rx="1" fill="#10b981" opacity="0.9"/>
            </svg>
            <!-- Texto con gradiente -->
            <svg width="110" height="22" viewBox="0 0 110 22" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="lg-text" x1="0" y1="0" x2="110" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#059669"/>
                  <stop offset="55%" stop-color="#10b981"/>
                  <stop offset="100%" stop-color="#34d399"/>
                </linearGradient>
              </defs>
              <text x="55" y="17" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="16" font-weight="800" letter-spacing="2" fill="url(#lg-text)">PROFITCOD</text>
            </svg>
          </div>
        </div>
      </div>

      ${menuItem("metricas", labels)}
      ${menuItem("rentabilidad", labels)}
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

            <div class="menu-item" data-id="pagos-config">
              💳 Configuración de pagos
            </div>
          `
          : ""
      }

      <div class="divider"></div>

      ${menuItem("plan", labels)}

      <div class="spacer"></div>

      <div style="margin:0 8px 14px;border-top:1px solid var(--border);padding-top:12px;">
        <div style="display:flex;align-items:center;gap:6px;padding:0 4px 10px;">
          <span style="display:inline-block;width:3px;height:14px;background:#22c55e;border-radius:2px;flex-shrink:0;"></span>
          <span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;">Pendiente MRW</span>
        </div>
        <div style="background:var(--input);border-radius:10px;padding:4px 2px;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;gap:8px;">
            <span style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:7px;flex-shrink:0;">
              <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:var(--muted);fill:none;stroke-width:1.8;flex-shrink:0;stroke-linecap:round;stroke-linejoin:round;"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1.5"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></svg>
              Pedidos
            </span>
            <span style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;flex-shrink:0;" id="sidebar-ree-count">—</span>
          </div>
          <div style="height:1px;background:var(--border);margin:0 10px;"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;gap:8px;">
            <span style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:7px;flex-shrink:0;">
              <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:var(--muted);fill:none;stroke-width:1.8;flex-shrink:0;stroke-linecap:round;stroke-linejoin:round;"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M16 14h2"/></svg>
              Importe
            </span>
            <span style="font-size:13px;font-weight:700;color:#22c55e;white-space:nowrap;flex-shrink:0;" id="sidebar-ree-total">—</span>
          </div>
        </div>
      </div>
      <div style="padding:8px 4px;border-top:1px solid #f3f4f6;text-align:center;font-size:10px;color:#d1d5db;line-height:1.4;">
        © 2026 <a href="https://profitcod.com" style="color:#22c55e;text-decoration:none;font-weight:600;">ProfitCOD</a>
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
                <input id="search" placeholder="${d.ui.searchPH}" oninput="doSearch(this.value)" onfocus="doSearch(this.value)" onkeydown="doSearchKeydown(event)" />
                <div class="search-results" id="searchDrop"></div>
              </div>
            </div>

            <div id="topbar-plan-chip" onclick="setSection('plan')" style="display:none;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;background:#1f2937;border:1px solid #374151;cursor:pointer;font-size:12px;font-weight:600;color:#e5e7eb;white-space:nowrap;flex-shrink:0;" title="Ver plan"></div>

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
                  <div class="drop-item" onclick="openUserSection('profile')"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>${d.ui.profile}</div>
                  <div class="drop-item" onclick="openUserSection('settings')"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>${d.ui.settings}</div>
                  <div class="drop-item" onclick="toggleTheme()">${document.body.classList.contains('dark')
                    ? `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>Modo día`
                    : `<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>Modo nocturno`
                  }</div>
                  <div class="drop-item" onclick="logout()"><svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>${d.ui.logout}</div>
                </div>
              </div>

            </div>
          </div>

          <div id="trial-countdown-banner" style="display:none;padding:9px 20px;font-size:13px;font-weight:600;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span>🎁</span>
              <span id="trial-countdown-text"></span>
            </div>
            <button onclick="setSection('plan')" style="background:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.5);color:inherit;padding:5px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Ver planes</button>
          </div>
          <div id="order-limit-banner" style="display:none;background:#dc2626;color:#fff;padding:10px 20px;font-size:13px;font-weight:600;display:none;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:10px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span id="order-limit-banner-text"></span>
            </div>
            <button onclick="setSection('plan')" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.5);color:#fff;padding:5px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Actualizar plan</button>
          </div>

          <div class="content">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <span style="display:inline-block;width:4px;height:22px;background:#22c55e;border-radius:3px;flex-shrink:0;"></span>
              <h2 id="title" style="margin:0;"></h2>
            </div>
            <div id="subtitle"></div>

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

    // On tablet/mobile, start with sidebar hidden
    if (window.innerWidth <= 1024) {
      document.getElementById("sidebar")?.classList.add("hidden");
    }

    document.querySelectorAll(".menu-item").forEach((el) => {
      el.onclick = () => {
        if (window.innerWidth <= 1024) closeSidebarMobile();
        setSection(el.dataset.id);
      };
    });

    document.querySelectorAll(".menu-subitem").forEach((el) => {
      el.onclick = () => {
        if (window.innerWidth <= 1024) closeSidebarMobile();
        setSection(el.dataset.id);
      };
    });

    setSection(section);
    ensureOutsideClose();
    loadSidebarReembolsos();
    updateOrderLimitBanner();
}

function updateOrderLimitBanner() {
  const banner = document.getElementById("order-limit-banner");
  const trialBanner = document.getElementById("trial-countdown-banner");
  const up = window.__userPlan || {};
  const used  = up.monthly_orders || 0;
  const limit = up.order_limit;
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();

  // ── Chip de plan en topbar ───────────────────────────────────
  const chip = document.getElementById("topbar-plan-chip");
  if (chip && up.plan && up.plan !== "free" && up.plan !== "admin") {
    const planColors = { starter:"#10b981", growth:"#3b82f6", pro:"#8b5cf6", business:"#f59e0b" };
    const planNames  = { starter:"Starter", growth:"Growth", pro:"Pro", business:"Business" };
    const col = planColors[up.plan] || "#6b7280";
    const estimated = up.estimated_total != null ? `· ${Number(up.estimated_total).toFixed(2).replace(".",",")}€ est.` : "";
    chip.style.display = "flex";
    chip.style.borderColor = col + "44";
    chip.innerHTML = `
      <span style="width:7px;height:7px;border-radius:50%;background:${col};flex-shrink:0;"></span>
      <span style="color:${col};">${planNames[up.plan] || up.plan}</span>
      ${estimated ? `<span style="color:#9ca3af;font-weight:400;">${estimated}</span>` : ""}
    `;
  } else if (chip) {
    chip.style.display = "none";
  }

  // ── Barra de trial ──────────────────────────────────────────
  if (trialBanner) {
    if (up.trial_active && up.trial_ends_at && up.status !== "active") {
      const msLeft = new Date(up.trial_ends_at) - now;
      const daysTrialLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
      const textEl = document.getElementById("trial-countdown-text");
      if (textEl) textEl.textContent =
        daysTrialLeft <= 1
          ? `Período de prueba: ¡último día! Activa un plan para no perder el acceso.`
          : `Período de prueba: ${daysTrialLeft} día${daysTrialLeft === 1 ? "" : "s"} restantes`;
      // Verde si ≥3 días, naranja si ≤2
      const bg = daysTrialLeft <= 2 ? "#f59e0b" : "#22c55e";
      trialBanner.style.cssText = `display:flex;background:${bg};color:#fff;padding:9px 20px;font-size:13px;font-weight:600;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;`;
    } else {
      trialBanner.style.display = "none";
    }
  }

  // ── Barra de límite de pedidos ───────────────────────────────
  if (!banner) return;
  if (up.is_blocked) {
    banner.style.cssText = "display:flex;background:#dc2626;color:#fff;padding:10px 20px;font-size:13px;font-weight:600;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;";
    const textEl = document.getElementById("order-limit-banner-text");
    if (textEl) textEl.textContent =
      `⛔ Límite de pedidos alcanzado (${used.toLocaleString("es-ES")} de ${limit.toLocaleString("es-ES")}). La app está bloqueada. Cambia de plan o espera al inicio del mes (${daysLeft} día${daysLeft === 1 ? "" : "s"}).`;
  } else if (limit && used >= limit * 0.85) {
    banner.style.cssText = "display:flex;background:#f59e0b;color:#fff;padding:10px 20px;font-size:13px;font-weight:600;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;";
    const textEl = document.getElementById("order-limit-banner-text");
    if (textEl) textEl.textContent =
      `⚠️ Atención: has usado ${used.toLocaleString("es-ES")} de ${limit.toLocaleString("es-ES")} pedidos este mes (${Math.round(used/limit*100)}%). Quedan ${daysLeft} día${daysLeft===1?"":"s"}.`;
  } else {
    banner.style.display = "none";
  }
}
window.updateOrderLimitBanner = updateOrderLimitBanner;

window.startTrialAndReload = async function() {
  try {
    const r = await fetch(`${API_BASE}/api/billing/start-trial`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ plan: "starter" }),
    });
    const d = await r.json();
    if (d.ok) {
      window.__userPlan = { ...window.__userPlan, plan: "starter", status: "trial", trial_active: true, trial_ends_at: d.trial_ends_at, had_trial: true };
      showToast("🎉 ¡Prueba activada!", "Tienes 7 días gratuitos. Disfrútalo.", "#22c55e");
      setSection(localStorage.getItem("section") || "metricas");
    } else {
      alert(d.error || "No se pudo activar el período de prueba");
    }
  } catch(e) { alert("Error: " + e.message); }
};

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
// BLOQUEO POR PLAN CADUCADO
// Clientes sin plan activo ven pantalla de renovación en todas las secciones excepto "plan"
// =========================
if (id !== "plan" && currentUser.role !== "Administrador") {
  const up = window.__userPlan || {};

// Si el plan aún no ha cargado, mostrar spinner y esperar
    if (!up.plan) {
      if (box) { box.className = "card"; box.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px;"><div style="width:32px;height:32px;border:3px solid #e5e7eb;border-top-color:#22c55e;border-radius:50%;animation:spin 0.7s linear infinite;"></div></div>`; }
      // Reintentar hasta 10 veces (5 segundos) esperando que cargue el plan
      let retryCount = (window.__planRetryCount || 0) + 1;
      window.__planRetryCount = retryCount;
      if (retryCount <= 10) {
        setTimeout(() => {
          if (window.__userPlan?.plan) {
            window.__planRetryCount = 0;
            setSection(id);
          } else if (retryCount < 10) {
            setSection(id);
          }
        }, 500);
      }
      return;
    }

  const planOk = up.plan && up.plan !== "free"
    && (up.status === "active" || up.status === "trial")
    && (!up.expires_at || new Date(up.expires_at) > new Date());

  if (!planOk) {
    if (t) t.textContent = "Plan requerido";
    if (s) s.textContent = "";
    if (c) c.textContent = "Plan requerido";
    if (box) {
      box.className = "card";
      const planCards = [
        { key:"starter",  color:"#10b981", name:"Starter",  price:"9,99",  ppo:"0,09", limit:"100" },
        { key:"growth",   color:"#3b82f6", name:"Growth",   price:"19,99", ppo:"0,07", limit:"500" },
        { key:"pro",      color:"#8b5cf6", name:"Pro",      price:"29,99", ppo:"0,05", limit:"1.000" },
        { key:"business", color:"#f59e0b", name:"Business", price:"39,99", ppo:"0,03", limit:"∞" },
      ];
      const trialExpired = up.had_trial && up.status !== "active";
      const headline = trialExpired
        ? "Tu período de prueba ha terminado"
        : "Activa tu plan para acceder a tus tiendas";
      const subline = trialExpired
        ? "Los 7 días gratuitos han expirado. Elige un plan para seguir usando la app."
        : "Tu suscripción ha caducado o no tienes un plan activo. Tiendas ilimitadas en todos los planes.";
      box.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center;gap:20px;">
          <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="${trialExpired ? "#f59e0b" : "#d1d5db"}" stroke-width="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div>
            <div style="font-size:20px;font-weight:800;color:#f9fafb;margin-bottom:8px;">${headline}</div>
            <div style="font-size:14px;color:#6b7280;max-width:460px;">${subline}</div>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px;">
            ${planCards.map(p => `
              <div style="border:2px solid ${p.color};border-radius:12px;padding:16px 20px;min-width:140px;text-align:left;">
                <div style="font-size:11px;font-weight:700;color:${p.color};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${p.name}</div>
                <div style="font-size:22px;font-weight:800;color:#f9fafb;">${p.price}€<span style="font-size:12px;font-weight:400;color:#6b7280;">/mes</span></div>
                <div style="font-size:11px;color:#6b7280;margin-top:2px;">+ ${p.ppo}€/pedido</div>
                <div style="font-size:11px;color:#6b7280;">hasta ${p.limit} pedidos/mes</div>
              </div>`).join("")}
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px;">
            ${!up.had_trial ? `<button onclick="startTrialAndReload()" style="padding:12px 32px;background:#22c55e;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">🎁 Probar gratis 7 días</button>` : ""}
            <button onclick="setSection('plan')" style="padding:12px 32px;background:${up.had_trial ? "#22c55e" : "#f9fafb"};color:${up.had_trial ? "#fff" : "#374151"};border:1px solid #374151;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">Ver planes y activar</button>
          </div>
        </div>`;
    }
    closeAllDrops();
    closeSearchDrop();
    return;
  }

  // Bloqueo por límite de pedidos superado (plan activo pero excedido)
  if (up.is_blocked) {
    const now = new Date();
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    if (box) {
      box.style.position = "relative";
      // Eliminar overlay anterior si existe
      document.getElementById("order-limit-overlay")?.remove();
      const overlay = document.createElement("div");
      overlay.id = "order-limit-overlay";
      overlay.style.cssText = "position:absolute;inset:0;z-index:500;background:rgba(255,255,255,0.93);backdrop-filter:blur(3px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;border-radius:inherit;text-align:center;padding:32px;";
      overlay.innerHTML = `
        <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="#dc2626" stroke-width="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <div>
          <div style="font-size:18px;font-weight:800;color:#f9fafb;margin-bottom:8px;">Has alcanzado el límite de pedidos</div>
          <div style="font-size:14px;color:#6b7280;max-width:420px;">
            Has usado <strong>${(up.monthly_orders||0).toLocaleString("es-ES")}</strong> pedidos este mes.
            Tu plan <strong>${up.plan}</strong> permite <strong>${(up.order_limit||0).toLocaleString("es-ES")}</strong>.<br><br>
            La sincronización en segundo plano sigue activa. Solo la visualización está bloqueada.
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center;">
          <button onclick="setSection('plan')" style="padding:11px 28px;background:#22c55e;color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;">Cambiar de plan</button>
          <span style="font-size:13px;color:#9ca3af;">o espera ${daysLeft} día${daysLeft===1?"":"s"} para que se reinicie</span>
        </div>`;
      box.appendChild(overlay);
    }
  } else {
    document.getElementById("order-limit-overlay")?.remove();
  }
}

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
        <div style="position:relative;" id="met-picker-wrap">
          <button id="met-picker-trigger" onclick="toggleMetDatePicker()"
            style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:var(--pk-bg);border:1.5px solid var(--pk-border2);border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--pk-text);transition:all .15s;"
            onmouseover="this.style.borderColor='var(--pk-border)';this.style.background='var(--pk-input)';" onmouseout="this.style.borderColor='var(--pk-border2)';this.style.background='var(--pk-bg)';">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span id="met-picker-label">Mes actual</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--pk-text3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div id="met-picker-panel" style="display:none;position:absolute;right:0;top:calc(100% + 6px);z-index:2000;"></div>
          <input type="date" id="metrics-date-from" value="${savedFrom}" style="display:none;">
          <input type="date" id="metrics-date-to" value="${savedTo}" style="display:none;">
          <select id="metrics-shop" style="display:none;"><option value="">Todas las tiendas</option></select>
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
            <div style="border-left:1px solid #1f2937;padding-left:10px;display:flex;flex-direction:column;align-items:flex-start;">
              <span class="stat-num" id="stat-sin-cancelados">0</span>
              <span class="stat-label" style="white-space:nowrap;">Sin cancelados</span>
            </div>
          </div>
          <div style="border-top:1px solid #1f2937;padding-top:6px;width:100%;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:12px;color:#6b7280;display:flex;flex-direction:column;line-height:1.4;">Enviados<span style="font-size:10px;color:#9ca3af;">(excl. pendientes y cancelados)</span></span>
            <span style="font-size:14px;font-weight:700;color:#22c55e;" id="stat-enviados">0</span>
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
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" stroke-width="3.5"
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
                <span style="width:10px;height:10px;border-radius:50%;background:#22c55e;display:inline-block;flex-shrink:0;"></span>
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
          <div class="stat-icon green">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-entregados">0</span>
            <span class="stat-label">Entregados</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon red">
            <svg viewBox="0 0 24 24"><path d="M1 4v6h6M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-devueltos">0</span>
            <span class="stat-label">Devueltos</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon purple">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-destruidos">0</span>
            <span class="stat-label">Destruidos</span>
          </div>
        </div>

    <div class="stat-card">
          <div class="stat-icon cyan">
            <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-facturacion">0,00 €</span>
            <span class="stat-label">Facturación</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon orange">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-cpa">— €</span>
            <span class="stat-label">CPA</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon teal">
            <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-num" id="stat-roas">—</span>
            <span class="stat-label">ROAS</span>
          </div>
        </div>

    </div>
      </div>
      <div id="met-shop-filter-panel" style="width:200px;flex-shrink:0;background:var(--card);border:1px solid #374151;border-radius:12px;padding:14px;position:sticky;top:0px;align-self:flex-start;">
        <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Filtrar tiendas</div>
        <div style="color:#9ca3af;font-size:12px;">Cargando...</div>
      </div>
    </div>

    <!-- ── GRÁFICA PEDIDOS POR TIENDA ── -->
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border);">
      <div style="display:flex;gap:20px;align-items:flex-start;">

        <!-- Mitad izquierda: gráfica -->
        <div style="flex:1;min-width:0;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px 20px 16px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;gap:10px;flex-wrap:wrap;">
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--text);letter-spacing:-.2px;">Pedidos por tienda</div>
              <div style="font-size:12px;color:var(--muted);margin-top:3px;" id="chart-period-label">—</div>
            </div>
            <div style="display:flex;gap:5px;">
              <button id="chart-btn-day"   onclick="setChartPeriod('day')"   class="chart-period-btn active">Día</button>
              <button id="chart-btn-month" onclick="setChartPeriod('month')" class="chart-period-btn">Mes</button>
              <button id="chart-btn-year"  onclick="setChartPeriod('year')"  class="chart-period-btn">Año</button>
            </div>
          </div>
          <canvas id="orders-bar-chart" style="width:100%;display:block;"></canvas>
          <div id="chart-legend" style="display:flex;flex-direction:column;gap:6px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);"></div>
        </div>

        <!-- Mitad derecha: reservada -->
        <div style="flex:1;min-width:0;" id="metricas-right-panel"></div>

      </div>
    </div>
    `;
  }
// ===========================
// METRICS DATE PICKER
// ===========================
(function() {
  const MN = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MNl = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const now = new Date();

  const _sf = localStorage.getItem('met_from'), _st = localStorage.getItem('met_to');
  window.__metPicker = {
    open: false,
    startDate: _sf || null,
    endDate:   _st || null,
    hoverDate: null, selecting: false,
    viewYear: now.getFullYear(), viewMonth: now.getMonth()+1,
    preset: 'mes', presetLabel: 'Mes actual'
  };

  function fmtD(d) {
    if (!d) return '—';
    const [y,m,day] = d.split('-');
    return `${parseInt(day)} de ${MNl[parseInt(m)-1]} de ${y}`;
  }

  function renderMonth(year, month) {
    const s = window.__metPicker;
    const dim = new Date(year, month, 0).getDate();
    const fdow = new Date(year, month-1, 1).getDay();
    const today = new Date().toISOString().split('T')[0];
    let cells = [];
    for (let i=0;i<fdow;i++) cells.push(null);
    for (let d=1;d<=dim;d++) cells.push(d);
    while (cells.length%7!==0) cells.push(null);
    let rows='';
    for (let i=0;i<cells.length;i+=7) {
      let row='<tr>';
      for (let j=0;j<7;j++) {
        const day=cells[i+j];
        if (!day) { row+='<td style="width:36px;height:36px;"></td>'; continue; }
        const ds=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isS=ds===s.startDate, isE=ds===s.endDate;
        const hi = s.selecting&&s.startDate&&s.hoverDate&&ds>s.startDate&&ds<=s.hoverDate;
        const inR = s.startDate&&s.endDate&&ds>s.startDate&&ds<s.endDate;
        const isT = ds===today;
        let bg='transparent', col='var(--pk-day-text)', fw='400', br='6px', tdBg='transparent', outline='none';
        if (isS||isE) { bg='#22c55e'; col='#fff'; fw='700'; outline='none'; }
        else if (inR) { tdBg='rgba(34,197,94,.15)'; col='#86efac'; fw='500'; br='0'; }
        else if (hi)  { tdBg='rgba(34,197,94,.08)'; col='#86efac'; br='0'; }
        if (isT&&!isS&&!isE) { fw='700'; col=inR||hi?col:'#4ade80'; }
        row+=`<td style="width:36px;height:36px;text-align:center;padding:0;background:${tdBg};">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;background:${bg};color:${col};border-radius:${br};font-size:13px;font-weight:${fw};cursor:pointer;transition:all .12s;"
            onclick="window.__metPDay('${ds}')" onmouseover="window.__metPHover('${ds}')"
            onmouseenter="if(!${isS||isE})this.style.background='var(--pk-hover)';"
            onmouseleave="if(!${isS||isE})this.style.background='transparent';"
            >${day}</span></td>`;
      }
      row+='</tr>'; rows+=row;
    }
    return `<div>
      <div style="text-align:center;font-size:13px;font-weight:700;color:var(--pk-text);padding-bottom:10px;letter-spacing:.3px;">${MN[month-1]} ${year}</div>
      <table style="border-collapse:collapse;"><thead><tr>${['do','lu','ma','mi','ju','vi','sá'].map(d=>`<th style="width:36px;font-size:10px;color:var(--pk-text3);font-weight:600;text-align:center;padding-bottom:8px;text-transform:uppercase;letter-spacing:.6px;">${d}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }

  function metReposition() {
    const panel = document.getElementById('met-picker-panel'); if (!panel) return;
    // On very narrow screens: fixed centered modal
    if (window.innerWidth < 600) {
      panel.style.position='fixed'; panel.style.left='8px'; panel.style.right='8px';
      panel.style.top='50%'; panel.style.bottom='';
      panel.style.transform='translateY(-50%)';
      panel.style.maxHeight='90vh'; panel.style.overflowY='auto'; panel.style.zIndex='3000';
      return;
    }
    // Desktop: keep absolute positioning, only adjust alignment to prevent overflow
    panel.style.position='absolute';
    panel.style.transform=''; panel.style.maxHeight=''; panel.style.overflowY='';
    panel.style.top='calc(100% + 6px)'; panel.style.bottom='';
    panel.style.right='0'; panel.style.left='';
    const rect = panel.getBoundingClientRect();
    if (rect.left < 8) { panel.style.right='auto'; panel.style.left='0'; }
    else if (rect.right > window.innerWidth - 8) { panel.style.left='auto'; panel.style.right='0'; }
    if (rect.bottom > window.innerHeight - 8) { panel.style.top='auto'; panel.style.bottom='calc(100% + 6px)'; }
  }
  function renderPicker() {
    const panel=document.getElementById('met-picker-panel'); if(!panel) return;
    const s=window.__metPicker;
    const vy=s.viewYear,vm=s.viewMonth;
    const lm=vm===1?12:vm-1, ly=vm===1?vy-1:vy;
    const narrow = window.innerWidth < 680;
    const PRESETS=[{key:'hoy',label:'Hoy'},{key:'ayer',label:'Ayer'},{key:'mes',label:'Este mes'},{key:'mes-ant',label:'Mes anterior'},{key:'personalizado',label:'Rango personalizado'}];
    const sidebar=PRESETS.map(p=>{
      const act=s.preset===p.key;
      return `<div onclick="window.__metPPreset('${p.key}')"
        style="padding:9px 14px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:${act?'600':'400'};color:${act?'#22c55e':'var(--pk-text2)'};background:${act?'rgba(34,197,94,.12)':'transparent'};border-left:${act?'3px solid #22c55e':'3px solid transparent'};transition:all .12s;"
        onmouseover="if(!${act})this.style.background='var(--pk-hover)';" onmouseout="this.style.background='${act?'rgba(34,197,94,.12)':'transparent'}';">${p.label}</div>`;
    }).join('');
    const dateBox = (d,placeholder) => `<div style="flex:1;display:flex;align-items:center;gap:7px;padding:9px 13px;border:1.5px solid ${d?'#22c55e':'var(--pk-border2)'};border-radius:9px;background:${d?'rgba(34,197,94,.08)':'var(--pk-input)'};">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="${d?'#22c55e':'var(--pk-text3)'}" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
      <span style="font-size:12.5px;color:${d?'#86efac':'var(--pk-text2)'};font-weight:${d?'500':'400'};white-space:nowrap;">${d?fmtD(d):placeholder}</span>
    </div>`;
    const navBtn = (dir,label) => `<button onclick="window.__metPNav(${dir})" style="width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;background:var(--pk-btn-bg);border:1px solid var(--pk-border2);border-radius:7px;cursor:pointer;font-size:15px;color:var(--pk-text2);font-weight:700;transition:all .12s;" onmouseover="this.style.color='var(--pk-text)';this.style.borderColor='var(--pk-border)';" onmouseout="this.style.color='var(--pk-text2)';this.style.borderColor='var(--pk-border2)';">${label}</button>`;
    const calSection = narrow
      ? `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">${navBtn(-1,'‹')}<span></span>${navBtn(1,'›')}</div>${renderMonth(vy,vm)}`
      : `<div style="display:flex;gap:28px;align-items:flex-start;">
          <div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">${navBtn(-1,'‹')}<span></span></div>${renderMonth(ly,lm)}</div>
          <div style="width:1px;background:var(--pk-border);align-self:stretch;margin-top:42px;"></div>
          <div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><span></span>${navBtn(1,'›')}</div>${renderMonth(vy,vm)}</div>
        </div>`;
    const presetMobile = narrow
      ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">${PRESETS.map(q=>{const act=s.preset===q.key;return `<button onclick="window.__metPPreset('${q.key}')" style="padding:5px 12px;border-radius:999px;font-size:12px;font-weight:${act?'700':'400'};cursor:pointer;background:${act?'#22c55e':'var(--pk-btn-bg)'};color:${act?'#052e16':'var(--pk-text2)'};border:1px solid ${act?'#22c55e':'var(--pk-border2)'};font-family:inherit;">${q.label}</button>`;}).join('')}</div>`
      : '';
    panel.innerHTML=`<div class="dpf-panel" style="display:flex;box-shadow:var(--pk-shadow);border-radius:14px;overflow:hidden;background:var(--pk-bg);border:1px solid var(--pk-border);">
      ${narrow?'':` <div style="width:176px;padding:18px 10px;background:var(--pk-sidebar);border-right:1px solid var(--pk-border);display:flex;flex-direction:column;gap:2px;">
        <div style="font-size:9.5px;font-weight:700;color:var(--pk-text3);text-transform:uppercase;letter-spacing:.8px;padding:0 8px 10px;">Período</div>
        ${sidebar}
      </div>`}
      <div style="padding:${narrow?'16px':'20px 26px'};">
        ${presetMobile}
        <div style="display:flex;align-items:center;gap:${narrow?'6px':'10px'};margin-bottom:${narrow?'14px':'20px'};">
          ${dateBox(s.startDate,'Fecha inicio')}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--pk-text3)" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          ${dateBox(s.endDate,'Fecha fin')}
        </div>
        ${calSection}
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:${narrow?'14px':'20px'};padding-top:${narrow?'12px':'16px'};border-top:1px solid var(--pk-border);">
          <button onclick="window.__metPClose()" style="padding:8px 18px;background:transparent;border:1.5px solid var(--pk-border2);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;color:var(--pk-text2);transition:all .12s;font-family:inherit;" onmouseover="this.style.borderColor='var(--pk-border)';this.style.color='var(--pk-text)';" onmouseout="this.style.borderColor='var(--pk-border2)';this.style.color='var(--pk-text2)';">Cancelar</button>
          <button onclick="window.__metPApply()" style="padding:8px 22px;background:#22c55e;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;color:#052e16;box-shadow:0 0 20px rgba(34,197,94,.3);transition:all .12s;font-family:inherit;" onmouseover="this.style.background='#16a34a';this.style.boxShadow='0 0 28px rgba(34,197,94,.5)';" onmouseout="this.style.background='#22c55e';this.style.boxShadow='0 0 20px rgba(34,197,94,.3)';">Aplicar</button>
        </div>
      </div>
    </div>`;
    metReposition();
  }

  window.toggleMetDatePicker = function() {
    const s=window.__metPicker, panel=document.getElementById('met-picker-panel'); if(!panel) return;
    if (s.open) { panel.style.display='none'; s.open=false; }
    else {
      // Set view to month of endDate or current month
      const ref = s.endDate || new Date().toISOString().split('T')[0];
      const [ry,rm] = ref.split('-').map(Number);
      s.viewYear=ry; s.viewMonth=rm;
      panel.style.display='block'; s.open=true; renderPicker();
    }
  };
  window.__metPPreset = function(key) {
    const s=window.__metPicker; s.preset=key; s.selecting=false;
    const n=new Date(), fmt=d=>d.toISOString().split('T')[0];
    if (key==='hoy')     { const d=fmt(n); s.startDate=d; s.endDate=d; s.presetLabel='Hoy'; }
    else if (key==='ayer'){ const d=fmt(new Date(n-864e5)); s.startDate=d; s.endDate=d; s.presetLabel='Ayer'; }
    else if (key==='mes') { s.startDate=fmt(new Date(n.getFullYear(),n.getMonth(),1)); s.endDate=fmt(n); s.presetLabel='Este mes'; }
    else if (key==='mes-ant') { s.startDate=fmt(new Date(n.getFullYear(),n.getMonth()-1,1)); s.endDate=fmt(new Date(n.getFullYear(),n.getMonth(),0)); s.presetLabel='Mes anterior'; }
    else if (key==='personalizado') { s.presetLabel='Personalizado'; }
    if (s.endDate) { const [ry,rm]=s.endDate.split('-').map(Number); s.viewYear=ry; s.viewMonth=rm; }
    renderPicker();
  };
  window.__metPNav = function(dir) {
    const s=window.__metPicker; s.viewMonth+=dir;
    if (s.viewMonth>12){s.viewMonth=1;s.viewYear++;} if (s.viewMonth<1){s.viewMonth=12;s.viewYear--;}
    renderPicker();
  };
  window.__metPDay = function(ds) {
    const s=window.__metPicker; s.preset='personalizado'; s.presetLabel='Personalizado';
    if (!s.selecting||!s.startDate) { s.startDate=ds; s.endDate=null; s.selecting=true; }
    else { if (ds<s.startDate){s.endDate=s.startDate;s.startDate=ds;}else{s.endDate=ds;} s.selecting=false; }
    renderPicker();
  };
  window.__metPHover = function(ds) {
    const s=window.__metPicker;
    if (s.selecting && s.hoverDate !== ds) { s.hoverDate=ds; renderPicker(); }
  };
  window.__metPClose = function() {
    const panel=document.getElementById('met-picker-panel'); if(panel) panel.style.display='none'; window.__metPicker.open=false;
  };
  window.__metPApply = function() {
    const s=window.__metPicker; if (!s.startDate) return;
    if (!s.endDate) s.endDate = s.startDate; // single day click → same start/end
    s.selecting = false;
    const from=document.getElementById('metrics-date-from'), to=document.getElementById('metrics-date-to');
    if (from) from.value=s.startDate; if (to) to.value=s.endDate;
    localStorage.setItem('met_from',s.startDate); localStorage.setItem('met_to',s.endDate);
    const lbl=document.getElementById('met-picker-label'); if(lbl) lbl.textContent=s.presetLabel;
    window.__metPClose(); loadMetricas();
  };
  document.addEventListener('click', e=>{
    if (!window.__metPicker.open) return;
    if (!e.target.isConnected) return; // elemento eliminado por re-render, ignorar
    const wrap=document.getElementById('met-picker-wrap');
    if (wrap&&!wrap.contains(e.target)) window.__metPClose();
  });

  // Compat wrappers
  window.filtroMetricasHoy          = ()=>{ window.__metPPreset('hoy');     window.__metPApply(); };
  window.filtroMetricasAyer         = ()=>{ window.__metPPreset('ayer');    window.__metPApply(); };
  window.filtroMetricasMes          = ()=>{ window.__metPPreset('mes');     window.__metPApply(); };
  window.filtroMetricasMesAnterior  = ()=>{ window.__metPPreset('mes-ant');  window.__metPApply(); };
  window.aplicarFiltroMetricas      = ()=>{
    const from=document.getElementById('metrics-date-from')?.value, to=document.getElementById('metrics-date-to')?.value;
    if(from) localStorage.setItem('met_from',from); if(to) localStorage.setItem('met_to',to); loadMetricas();
  };
})();

function recalcMetricasFiltro() {
  const checks = document.querySelectorAll("#met-shop-filter-panel input[type='checkbox'][value]");
  const allCheck = document.getElementById("met-shop-check-all");
  if (allCheck) allCheck.checked = [...checks].every(c => c.checked);
  loadMetricas();
}
window.recalcMetricasFiltro = recalcMetricasFiltro;

function toggleAllMetricasFiltro(checked) {
  document.querySelectorAll("#met-shop-filter-panel input[type='checkbox'][value]").forEach(c => c.checked = checked);
  loadMetricas();
}
window.toggleAllMetricasFiltro = toggleAllMetricasFiltro;

  loadMetricas();
  loadOrdersChart(window.__chartPeriod || 'day');

// Cargar tiendas en el panel de filtro de métricas
  fetch(`${API_BASE}/api/shopify/stores`, {
    headers: { Authorization: "Bearer " + getActiveToken() }
  }).then(r => r.json()).then(stores => {
    const panel = document.getElementById("met-shop-filter-panel");
    if (panel && Array.isArray(stores) && stores.length > 0) {
      const checkboxes = stores.map(s =>
        `<label class="shop-check-label shop-check-row">
          <input type="checkbox" checked value="${s.domain}" onchange="recalcMetricasFiltro()">
          ${escapeHtml(s.shop_name || s.domain)}
        </label>`
      ).join("");
      panel.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Filtrar tiendas</div>
        <label class="shop-check-label all">
          <input type="checkbox" id="met-shop-check-all" checked onchange="toggleAllMetricasFiltro(this.checked)">
          Todas las tiendas
        </label>
        ${checkboxes}
      `;
    } else if (panel) {
      panel.innerHTML = `<div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Filtrar tiendas</div><div style="color:#9ca3af;font-size:12px;">Sin tiendas</div>`;
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

      msg.style.color = "#22c55e";
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
// SECCIÓN RENTABILIDAD
// =========================
if (id === "rentabilidad") {
  if (t) t.textContent = "Rentabilidad";
  if (s) s.textContent = "Análisis de rentabilidad por tienda";
  if (c) c.textContent = "Rentabilidad";

  const nowR = new Date();
  const firstDayR = new Date(nowR.getFullYear(), nowR.getMonth(), 1);
  const fmtR = d => d.toISOString().split("T")[0];
  const savedFromR = localStorage.getItem("rent_from") || fmtR(firstDayR);
  const savedToR   = localStorage.getItem("rent_to")   || fmtR(nowR);
  const savedRentLabel = localStorage.getItem("rent_from") ? 'Personalizado' : 'Este mes';

  box.className = "card metricas-box";
  box.innerHTML = `
    <div style="display:flex;gap:20px;align-items:flex-start;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
          <h3 style="margin:0;font-size:15px;font-weight:600;">Balance por tienda</h3>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1;justify-content:flex-end;">
            ${window.__DPF.triggerBtn('rent', savedRentLabel)}
            <input type="date" id="rent-date-from" value="${savedFromR}" style="display:none;">
            <input type="date" id="rent-date-to" value="${savedToR}" style="display:none;">
          </div>
        </div>
        <div id="rent-balance-wrap"></div>
      </div>
    </div>
  `;

  window.__DPF.create('rent', savedFromR, savedToR,
    localStorage.getItem("rent_from") ? 'personalizado' : 'mes',
    savedRentLabel, 'rent_from', 'rent_to',
    function() { window.loadRentabilidad(); });

  function filtroRentabilidadHoy() {
    const hoy = new Date().toISOString().split("T")[0];
    const from = document.getElementById("rent-date-from");
    const to   = document.getElementById("rent-date-to");
    if (from) from.value = hoy;
    if (to)   to.value   = hoy;
    localStorage.setItem("rent_from", hoy);
    localStorage.setItem("rent_to",   hoy);
    loadRentabilidad();
  }
  window.filtroRentabilidadHoy = filtroRentabilidadHoy;

  function filtroRentabilidadMes() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const today    = now.toISOString().split("T")[0];
    const from = document.getElementById("rent-date-from");
    const to   = document.getElementById("rent-date-to");
    if (from) from.value = firstDay;
    if (to)   to.value   = today;
    localStorage.setItem("rent_from", firstDay);
    localStorage.setItem("rent_to",   today);
    loadRentabilidad();
  }
  window.filtroRentabilidadMes = filtroRentabilidadMes;

  function filtroRentabilidadMesAnterior() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay  = new Date(now.getFullYear(), now.getMonth(), 0);
    const firstStr = firstDay.toISOString().split("T")[0];
    const lastStr  = lastDay.toISOString().split("T")[0];
    const from = document.getElementById("rent-date-from");
    const to   = document.getElementById("rent-date-to");
    if (from) from.value = firstStr;
    if (to)   to.value   = lastStr;
    localStorage.setItem("rent_from", firstStr);
    localStorage.setItem("rent_to",   lastStr);
    loadRentabilidad();
  }
  window.filtroRentabilidadMesAnterior = filtroRentabilidadMesAnterior;

  function aplicarFiltroRentabilidad() {
    const from = document.getElementById("rent-date-from")?.value;
    const to   = document.getElementById("rent-date-to")?.value;
    if (from && to && from > to) {
      alert("❌ La fecha de inicio no puede ser mayor que la fecha de fin");
      return;
    }
    if (from) localStorage.setItem("rent_from", from);
    if (to)   localStorage.setItem("rent_to",   to);
    loadRentabilidad();
  }
  window.aplicarFiltroRentabilidad = aplicarFiltroRentabilidad;

  async function loadRentabilidad() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = d => d.toISOString().split("T")[0];
    const dateFrom = document.getElementById("rent-date-from")?.value || fmt(firstDay);
    const dateTo   = document.getElementById("rent-date-to")?.value   || fmt(now);
    await loadRentabilidadBalance(dateFrom, dateTo);
  }
  window.loadRentabilidad = loadRentabilidad;

  loadRentabilidad();
  closeAllDrops();
  closeSearchDrop();
  return;
}

// =========================
// SECCIÓN TIENDAS
// =========================
if (id === "tiendas") {
  if (t) t.textContent = "Integraciones";
  if (s) s.textContent = "Gestiona tus integraciones";
  if (c) c.textContent = "Integraciones";

  box.className = "";
  box.removeAttribute("style");
  box.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;background:var(--input);padding:4px;border-radius:10px;width:fit-content;">
      <button id="int-tab-btn-tiendas" onclick="switchIntegracionesTab('tiendas')"
        style="padding:7px 18px;border-radius:7px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;background:#22c55e;color:#fff;box-shadow:0 2px 8px rgba(34,197,94,.25);transition:all .15s;">
        Tiendas
      </button>
      <button id="int-tab-btn-agencia" onclick="switchIntegracionesTab('agencia')"
        style="padding:7px 18px;border-radius:7px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;background:transparent;color:var(--muted);transition:all .15s;">
        Agencia de envío
      </button>
      <button id="int-tab-btn-reembolsos" onclick="switchIntegracionesTab('reembolsos')"
        style="padding:7px 18px;border-radius:7px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;background:transparent;color:var(--muted);transition:all .15s;">
        Reembolsos
      </button>
    </div>
    <div id="integraciones-content"></div>
  `;

  window.switchIntegracionesTab = function(tab) {
    ["tiendas","agencia","reembolsos"].forEach(k => {
      const btn = document.getElementById("int-tab-btn-" + k);
      if (!btn) return;
      if (k === tab) {
        btn.style.background = "#22c55e"; btn.style.color = "#fff"; btn.style.boxShadow = "0 2px 8px rgba(34,197,94,.25)";
      } else {
        btn.style.background = "transparent"; btn.style.color = "var(--muted)"; btn.style.boxShadow = "none";
      }
    });

    const content = document.getElementById("integraciones-content");
    if (!content) return;

    if (tab === "tiendas") {
      content.innerHTML = `
        <div class="card">
          <div style="display:flex; justify-content:flex-end; margin-bottom:20px;">
            <button class="btn-primary" onclick="openShopifyConnect()" style="display:inline-flex;align-items:center;gap:8px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Conectar tienda Shopify
            </button>
          </div>
          <div id="storesGrid" class="stores-grid"></div>
        </div>
      `;
      fetchStores();
    }

    if (tab === "agencia") {
      content.innerHTML = `
        <div class="card" style="padding:24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-size:15px;font-weight:700;color:#f9fafb;margin-bottom:4px;">🚚 Integración MRW</div>
              <div style="font-size:13px;color:#6b7280;">Conecta tu cuenta MRW para sincronizar estados de envío automáticamente</div>
            </div>
            <div id="mrw-status-badge"></div>
          </div>
          <div id="mrw-config-wrap"></div>
        </div>
      `;
      cargarConfigMRW();
    }

    if (tab === "reembolsos") {
      content.innerHTML = `
        <div class="card" style="padding:28px;max-width:560px;">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
            <div style="width:44px;height:44px;background:rgba(34,197,94,.08);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#f9fafb;">Correo de reembolsos MRW</div>
              <div style="font-size:13px;color:#6b7280;margin-top:2px;">Conecta el correo donde MRW te envía los PDFs de liquidación COD para importarlos automáticamente</div>
            </div>
          </div>

          <div id="gmail-status-wrap" style="margin-bottom:20px;"></div>

          <div id="gmail-form-wrap">
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:13px;font-weight:600;color:#e5e7eb;margin-bottom:6px;">Correo donde recibes los PDFs de MRW *</label>
              <input type="email" id="pdf-email-input" placeholder="ejemplo@gmail.com"
                style="width:100%;padding:10px 12px;border:1px solid #374151;border-radius:8px;font-size:14px;font-family:inherit;color:var(--text);background:var(--card);box-sizing:border-box;"/>
              <div style="font-size:12px;color:#9ca3af;margin-top:5px;">Debe ser una cuenta Gmail o Google Workspace.</div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <button onclick="iniciarConexionGmail()"
                style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#111827;border:1.5px solid #374151;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;color:#e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.08);">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Conectar con Google
              </button>
              <span id="gmail-connect-msg" style="font-size:13px;"></span>
            </div>
          </div>
        </div>
      `;
      cargarConfigGmail();
    }
  };

  window.cargarConfigMRW = async function() {
    const wrap = document.getElementById("mrw-config-wrap");
    const badge = document.getElementById("mrw-status-badge");
    if (!wrap) return;
    try {
      const res = await fetch(`${API_BASE}/api/tracking/mrw-credentials`, {
        headers: { Authorization: "Bearer " + getActiveToken() }
      });
      const data = await res.json();
      if (data.integrated) {
        if (badge) badge.innerHTML = `<span style="padding:6px 14px;background:rgba(34,197,94,.12);color:#22c55e;border-radius:20px;font-size:13px;font-weight:700;">✓ Conectado</span>`;
        wrap.innerHTML = `
          <div style="background:rgba(34,197,94,.08);border:1px solid #86efac;border-radius:10px;padding:16px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-weight:600;color:#16a34a;margin-bottom:4px;">MRW integrado correctamente</div>
              <div style="font-size:13px;color:#6b7280;">Login: <strong>${data.login || "—"}</strong>${data.franquicia ? " · Franquicia: <strong>" + data.franquicia + "</strong>" : ""}${data.abonado ? " · Abonado: <strong>" + data.abonado + "</strong>" : ""}</div>
            </div>
            <button onclick="desintegrarMRW();setTimeout(()=>switchIntegracionesTab('agencia'),500)" 
              style="padding:8px 18px;background:rgba(239,68,68,.1);color:#dc2626;border:1px solid #fca5a5;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
              ✕ Desconectar MRW
            </button>
          </div>
          <div style="font-size:13px;color:#6b7280;">La sincronización automática de estados está activa. Los pedidos se actualizan cada 5 minutos.</div>
        `;
      } else {
        if (badge) badge.innerHTML = `<span style="padding:6px 14px;background:#1f2937;color:#6b7280;border-radius:20px;font-size:13px;font-weight:700;">No conectado</span>`;
        const inp = `width:100%;padding:9px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;font-family:inherit;background:var(--card);color:var(--text);box-sizing:border-box;`;
        wrap.innerHTML = `
          <div style="max-width:480px;display:flex;flex-direction:column;gap:14px;">
            <div style="background:rgba(59,130,246,.08);border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;font-size:13px;color:#93c5fd;">
              💡 Necesitas las credenciales SAGEC de MRW (Login y Contraseña del WebService TrackingServices)
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Login SAGEC *</label>
              <input id="mrw-login-int" type="text" placeholder="Ej: CD01234Ejemplo" style="${inp}">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Contraseña SAGEC *</label>
              <input id="mrw-pass-int" type="password" placeholder="Contraseña" style="${inp}">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Franquicia</label>
                <input id="mrw-franquicia-int" type="text" placeholder="Ej: 01234" style="${inp}">
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Abonado</label>
                <input id="mrw-abonado-int" type="text" placeholder="Ej: 603835" style="${inp}">
              </div>
            </div>
            <div id="mrw-int-msg" style="font-size:13px;min-height:18px;"></div>
            <button onclick="conectarMRWIntegraciones()" 
              style="padding:10px 24px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;align-self:flex-start;">
              🔗 Conectar MRW
            </button>
          </div>
        `;
      }
    } catch(e) {
      if (wrap) wrap.innerHTML = `<div style="color:#dc2626;">Error cargando configuración</div>`;
    }
  };

  window.conectarMRWIntegraciones = async function() {
    const login = document.getElementById("mrw-login-int")?.value.trim();
    const pass  = document.getElementById("mrw-pass-int")?.value.trim();
    const franquicia = document.getElementById("mrw-franquicia-int")?.value.trim();
    const abonado    = document.getElementById("mrw-abonado-int")?.value.trim();
    const msg = document.getElementById("mrw-int-msg");
    if (!login || !pass) { if (msg) { msg.style.color="#dc2626"; msg.textContent="Login y contraseña son obligatorios"; } return; }
    if (msg) { msg.style.color="#6b7280"; msg.textContent="Guardando..."; }
    try {
      const res = await fetch(`${API_BASE}/api/tracking/mrw-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
        body: JSON.stringify({ login, pass, franquicia, abonado })
      });
      const data = await res.json();
      if (data.ok) {
        showToast("✅ MRW conectado", "La sincronización automática está activa", "#22c55e");
        switchIntegracionesTab("agencia");
      } else {
        if (msg) { msg.style.color="#dc2626"; msg.textContent=data.error||"Error guardando"; }
      }
    } catch(e) { if (msg) { msg.style.color="#dc2626"; msg.textContent="Error de conexión"; } }
  };

  // Gmail config functions
  async function cargarConfigGmail() {
    const statusWrap = document.getElementById("gmail-status-wrap");
    const formWrap   = document.getElementById("gmail-form-wrap");
    try {
      const data = await cachedFetch(`${API_BASE}/api/gmail/config`, { headers: { Authorization: "Bearer " + getActiveToken() } });
      if (data?.connected) {
        // Ya conectado — mostrar estado y opción de desconectar
        if (statusWrap) statusWrap.innerHTML = `
          <div style="background:rgba(34,197,94,.08);border:1px solid #86efac;border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:18px;">✓</span>
              <div>
                <div style="font-weight:600;color:#16a34a;font-size:14px;">Gmail conectado</div>
                <div style="font-size:13px;color:#6b7280;">${data.email || ""}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button onclick="sincronizarPDFsMRW()" style="padding:7px 16px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                ↓ Importar PDFs ahora
              </button>
              <button onclick="desconectarGmail()" style="padding:7px 16px;background:rgba(239,68,68,.1);color:#dc2626;border:1px solid #fca5a5;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Desconectar</button>
            </div>
          </div>`;
        if (formWrap) formWrap.style.display = "none";
      } else {
        // No conectado — pre-rellenar email si existe
        if (data?.email) { const inp = document.getElementById("pdf-email-input"); if (inp) inp.value = data.email; }
        if (statusWrap) statusWrap.innerHTML = "";
        if (formWrap) formWrap.style.display = "";
      }
    } catch {
      if (statusWrap) statusWrap.innerHTML = "";
      if (formWrap) formWrap.style.display = "";
    }
  }
  window.cargarConfigGmail = cargarConfigGmail;

  window.iniciarConexionGmail = async function() {
    const email = document.getElementById("pdf-email-input")?.value?.trim();
    const msg   = document.getElementById("gmail-connect-msg");
    if (!email) { if (msg) { msg.textContent = "❌ Escribe el correo antes de conectar"; msg.style.color = "#dc2626"; } return; }
    if (msg) { msg.textContent = "Guardando..."; msg.style.color = "#6b7280"; }
    try {
      const res = await fetch(`${API_BASE}/api/gmail/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        if (msg) { msg.textContent = "Redirigiendo a Google..."; msg.style.color = "#22c55e"; }
        setTimeout(() => { window.location.href = `${API_BASE}/api/gmail/auth?token=${getActiveToken()}`; }, 800);
      } else { if (msg) { msg.textContent = "❌ Error al guardar el correo"; msg.style.color = "#dc2626"; } }
    } catch { if (msg) { msg.textContent = "❌ Error de conexión"; msg.style.color = "#dc2626"; } }
  };

  window.desconectarGmail = async function() {
    if (!confirm("¿Desconectar Gmail? Dejarás de recibir los PDFs automáticamente.")) return;
    try {
      await fetch(`${API_BASE}/api/gmail/config`, { method: "DELETE", headers: { Authorization: "Bearer " + getActiveToken() } });
      cargarConfigGmail();
    } catch {}
  };

  window.sincronizarPDFsMRW = async function() {
    const btn = event?.target;
    if (btn) { btn.textContent = "Procesando..."; btn.disabled = true; }
    try {
      const res = await fetch(`${API_BASE}/api/gmail/sync-pdf`, {
        method: "POST",
        headers: { Authorization: "Bearer " + getActiveToken() }
      });
      const data = await res.json();
      if (data.ok) {
        const msg = data.procesados > 0
          ? `✓ ${data.procesados} reembolso(s) marcados como cobrados`
          : `Sin reembolsos nuevos\nEmails encontrados: ${data.emailsLeidos ?? 0}\nPDFs: ${data.pdfsProcesados ?? 0}\nNº Envíos en PDF: ${data.enviosEncontrados ?? 0}`;
        alert(msg + (data.errores?.length ? `\nErrores: ${data.errores.map(e=>e.error).join(", ")}` : ""));
        if (data.procesados > 0) loadSidebarReembolsos();
      } else if (data.error === "GMAIL_RECONNECT" || res.status === 401) {
        if (confirm("⚠️ La sesión de Gmail ha expirado.\n\n¿Reconectar ahora automáticamente?")) {
          window.location.href = `${API_BASE}/api/gmail/auth?token=${getActiveToken()}`;
        }
      } else {
        alert("❌ Error: " + (data.error || "desconocido"));
      }
    } catch { alert("❌ Error de conexión"); }
    finally { if (btn) { btn.textContent = "↓ Importar PDFs ahora"; btn.disabled = false; } }
  };

  switchIntegracionesTab("tiendas");

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
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:10px;flex-wrap:wrap;">
      <button onclick="abrirEntradaMercancia()"
        style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;background:rgba(37,99,235,.1);color:#2563eb;border:1.5px solid rgba(37,99,235,.25);border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;"
        onmouseover="this.style.background='rgba(37,99,235,.18)';this.style.borderColor='rgba(37,99,235,.4)';" onmouseout="this.style.background='rgba(37,99,235,.1)';this.style.borderColor='rgba(37,99,235,.25)';">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        Entrada de mercancía
      </button>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <select id="productos-shop-filter" onchange="loadProductos()"
          style="padding:8px 12px;border:1.5px solid var(--border);border-radius:9px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;cursor:pointer;outline:none;">
          <option value="">Todas las tiendas</option>
        </select>
        <button onclick="loadProductos()"
          style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;background:rgba(34,197,94,.1);color:#16a34a;border:1.5px solid rgba(34,197,94,.25);border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;"
          onmouseover="this.style.background='rgba(34,197,94,.18)';this.style.borderColor='rgba(34,197,94,.4)';" onmouseout="this.style.background='rgba(34,197,94,.1)';this.style.borderColor='rgba(34,197,94,.25)';">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
          Sincronizar
        </button>
        <button onclick="abrirVincularStock()"
          style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;background:rgba(139,92,246,.1);color:#7c3aed;border:1.5px solid rgba(139,92,246,.25);border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;"
          onmouseover="this.style.background='rgba(139,92,246,.18)';this.style.borderColor='rgba(139,92,246,.4)';" onmouseout="this.style.background='rgba(139,92,246,.1)';this.style.borderColor='rgba(139,92,246,.25)';">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Vincular stock
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
              ${window.__DPF.triggerBtn('filter', 'Este mes')}
              <input type="date" id="filter-date-from" value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]}" style="display:none;">
              <input type="date" id="filter-date-to" value="${new Date().toISOString().split('T')[0]}" style="display:none;">
              <select id="filter-shop-inline"
                onchange="applyFilters()"
                style="padding:7px 10px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
                <option value="">Todas las tiendas</option>
              </select>
              <button onclick="clearFiltersInline()" style="padding:7px 14px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.4);border-radius:8px;color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Limpiar</button>
            </div>

            <!-- DERECHA: Sincronizar -->
            <div style="display:flex;align-items:center;gap:8px;">
              <button class="btn-sync" onclick="syncAndRefreshOrders()" title="Sincronizar Shopify y MRW" style="min-width:unset;padding:7px 12px;">
                <svg viewBox="0 0 24 24"><path d="M1 4v6h6" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>

          </div>
        </div>

        <div class="tabs">

          <span class="tab active" onclick="filterByTab(this, '')">Todos</span>
          <span class="tab" onclick="filterByTab(this, 'pendiente')">Pendiente</span>
          <span class="tab" onclick="filterByTabPendienteMRW(this)">Pend. entregar MRW</span>
          <span class="tab" onclick="filterByTab(this, 'enviado')">Enviado</span>
          <span class="tab" onclick="filterByTab(this, 'en_transito')">En tránsito</span>
          <span class="tab" onclick="filterByTab(this, 'entregado')">Entregado</span>
          <span class="tab" onclick="filterByTabMulti(this, ['devuelto','destruido'])">Dev/Destruido</span>
          <span class="tab" onclick="filterByTab(this, 'franquicia')">Franquicia</span>
          <span class="tab" onclick="filterByTab(this, 'cancelado')">Cancelado</span>
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

    // Init date picker for orders
    const _ordNow = new Date();
    const _ordFrom = new Date(_ordNow.getFullYear(), _ordNow.getMonth(), 1).toISOString().split('T')[0];
    const _ordTo   = _ordNow.toISOString().split('T')[0];
    window.__DPF.create('filter', _ordFrom, _ordTo, 'mes', 'Este mes', null, null, function() { window.applyFilters(); });

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

    // Auto-sincronizar MRW cada 1 minuto si está integrado (con lock para no apilar)
    if (window.__mrwInterval) clearInterval(window.__mrwInterval);
    window.__mrwInterval = setInterval(async () => {
      try {
        const creds = await fetch(`${API_BASE}/api/tracking/mrw-credentials`, {
          headers: { Authorization: "Bearer " + getActiveToken() }
        }).then(r => r.json());
        if (creds.integrated) await sincronizarMRW();
      } catch(e) {}
    }, 60 * 1000);

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
            style="padding:8px 18px;border-radius:8px;border:1px solid #374151;font-size:13px;font-weight:600;cursor:pointer;background:#111827;color:#e5e7eb;transition:all .15s;">
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
          style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          <option value="">Cargando tiendas...</option>
        </select>
        <select id="ads-month-sel"
          style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${Array.from({length:12},(_,i)=>{
            const d = new Date(); d.setMonth(i);
            return `<option value="${i+1}" ${i===new Date().getMonth()?"selected":""}>${d.toLocaleString("es",{month:"long"})}</option>`;
          }).join("")}
        </select>
        <select id="ads-year-sel"
          style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
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
        style="padding:8px 18px;border-radius:8px;border:1px solid #22c55e;font-size:13px;font-weight:600;cursor:pointer;background:#22c55e;color:#fff;">
        Reembolsos
      </button>
      <button id="inf-tab-btn-ingresos" onclick="switchInformesTab('ingresos')"
        style="padding:8px 18px;border-radius:8px;border:1px solid #374151;font-size:13px;font-weight:600;cursor:pointer;background:#111827;color:#e5e7eb;">
        Ingresos
      </button>
      <button id="inf-tab-btn-balance" onclick="switchInformesTab('balance')"
        style="padding:8px 18px;border-radius:8px;border:1px solid #374151;font-size:13px;font-weight:600;cursor:pointer;background:#111827;color:#e5e7eb;">
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
          style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
            .map((m,i)=>`<option value="${i+1}" ${i===new Date().getMonth()?"selected":""}>${m}</option>`).join("")}
        </select>
        <select id="gv-year-sel"
          style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===new Date().getFullYear()?"selected":""}>${y}</option>`).join("")}
        </select>
        <button onclick="loadGastosVarios()"
          style="padding:7px 16px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
          Ver
        </button>
      </div>
      <div id="gv-mes-label" style="margin-bottom:16px;padding:10px 16px;background:rgba(34,197,94,.08);border:1px solid #86efac;border-radius:8px;font-size:13px;color:#22c55e;font-weight:600;"></div>
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
    .help-tab-btn { padding:9px 20px; border-radius:10px; border:1.5px solid #374151; font-size:13px; font-weight:600; cursor:pointer; background:var(--card,#fff); color:var(--text,#111827); transition:all .15s; }
    .help-tab-btn.active, .help-tab-btn:hover { background:#22c55e; color:#fff; border-color:#22c55e; }
    .help-panel { display:none; }
    .help-panel.active { display:block; }
    .help-section { background:var(--card,#fff); border:1px solid var(--border,#e5e7eb); border-radius:12px; padding:24px 28px; margin-bottom:18px; }
    .help-section h2 { font-size:17px; font-weight:700; color:var(--text,#111827); margin:0 0 8px 0; }
    .help-section h3 { font-size:14px; font-weight:700; color:#22c55e; margin:18px 0 6px 0; }
    .help-section p, .help-section li { font-size:14px; color:var(--muted,#4b5563); line-height:1.7; margin:0 0 6px 0; }
    .help-section ul { padding-left:20px; margin:0 0 10px 0; }
    .help-tip { background:rgba(34,197,94,.08); border-left:3px solid #22c55e; border-radius:0 8px 8px 0; padding:10px 16px; font-size:13px; color:#16a34a; margin-top:12px; }
    .help-warning { background:rgba(234,179,8,.1); border-left:3px solid #fbbf24; border-radius:0 8px 8px 0; padding:10px 16px; font-size:13px; color:#fde047; margin-top:12px; }
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
      <p>Aquí gestionas todas las conexiones entre PROFITCOD y tus tiendas de Shopify. Cada tienda conectada sincronizará automáticamente sus pedidos y productos.</p>
    </div>
    <div class="help-section">
      <h2>➕ Conectar una nueva tienda</h2>
      <p>Pulsa <strong>+ Conectar tienda Shopify</strong>. Necesitarás introducir:</p>
      <ul>
        <li><strong>Dominio:</strong> formato tutienda.myshopify.com</li>
        <li><strong>Access Token:</strong> comienza por shpat_, encuéntralo en Shopify → Apps → Tu app → Credenciales API.</li>
        <li><strong>App Secret:</strong> también en la misma pantalla de credenciales de la app.</li>
      </ul>
      <div class="help-tip">💡 PROFITCOD nunca te pedirá la contraseña de tu cuenta de Shopify.</div>
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
      <p>Si MRW te envía un PDF con los comprobantes de liquidación, súbelo al sistema. PROFITCOD extrae automáticamente los números de seguimiento y marca esos pedidos como pagados.</p>
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

// =========================
// SECCIÓN PAGOS CONFIG (solo admin)
// =========================
if (id === "pagos-config") {
  if (currentUser.role !== "Administrador") { setSection("metricas"); return; }
  if (t) t.textContent = "Configuración de pagos";
  if (s) s.textContent = "Claves de Stripe y PayPal para cobrar a los clientes";
  if (c) c.textContent = "Configuración de pagos";
  box.className = "card";

  const inp = (id, ph, type="text") =>
    `<input id="${id}" type="${type}" placeholder="${ph}"
      style="width:100%;padding:9px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;
             background:var(--card);color:var(--text);font-family:inherit;box-sizing:border-box;">`;

  box.innerHTML = `<div style="max-width:560px;">
    <div style="background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.3);border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#fde047;">
      ⚠️ Estas claves se usan para procesar los cobros de los clientes. Mantenlas confidenciales.
    </div>

    <div style="margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#635bff" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
        <span style="font-weight:700;font-size:15px;color:#635bff;">Stripe</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Clave pública (pk_live_...)</label>
          ${inp("cfg-stripe-pk","pk_live_...")}
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Clave secreta (sk_live_...)</label>
          ${inp("cfg-stripe-sk","sk_live_...","password")}
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Webhook secret (whsec_...)</label>
          ${inp("cfg-stripe-wh","whsec_...","password")}
        </div>
      </div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #f3f4f6;">
        <div style="font-size:12px;font-weight:700;color:#e5e7eb;margin-bottom:10px;">Price IDs de suscripciones mensuales</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:12px;color:#10b981;font-weight:700;width:72px;">Starter</span>
            ${inp("cfg-stripe-price-starter","price_...")}
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:12px;color:#3b82f6;font-weight:700;width:72px;">Growth</span>
            ${inp("cfg-stripe-price-growth","price_...")}
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:12px;color:#8b5cf6;font-weight:700;width:72px;">Pro</span>
            ${inp("cfg-stripe-price-pro","price_...")}
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:12px;color:#f59e0b;font-weight:700;width:72px;">Business</span>
            ${inp("cfg-stripe-price-business","price_...")}
          </div>
        </div>
      </div>
    </div>
    </div>

    <div style="margin-bottom:28px;padding-top:20px;border-top:1px solid #f3f4f6;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#003087" stroke-width="2"><path d="M6.5 8h5a4 4 0 0 1 0 8H8l-1 5H5l2-13z"/><path d="M13 8h3a4 4 0 0 1 0 8h-1"/></svg>
        <span style="font-weight:700;font-size:15px;color:#003087;">PayPal</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Client ID</label>
          ${inp("cfg-pp-client","AXxx...")}
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Secret</label>
          ${inp("cfg-pp-secret","EXxx...","password")}
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Entorno</label>
          <select id="cfg-pp-env" style="width:100%;padding:9px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
            <option value="live">Producción (live)</option>
            <option value="sandbox">Sandbox (pruebas)</option>
          </select>
        </div>
      </div>
    </div>

    <div id="pagos-cfg-msg" style="font-size:13px;min-height:18px;margin-bottom:10px;"></div>
    <button onclick="guardarPagosConfig()"
      style="padding:10px 28px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
      Guardar configuración
    </button>
  </div>`;

  // Cargar valores actuales y bloquear campos con valor
  fetch(`${API_BASE}/api/admin/payment-config`, { headers: { Authorization: "Bearer " + getActiveToken() } })
    .then(r => r.json()).then(d => {
      const campos = {
        "cfg-stripe-pk":           d.stripe_public_key       || "",
        "cfg-stripe-sk":           d.stripe_secret_key       || "",
        "cfg-stripe-wh":           d.stripe_webhook_secret   || "",
        "cfg-stripe-price-starter":d.stripe_price_starter    || "",
        "cfg-stripe-price-growth": d.stripe_price_growth     || "",
        "cfg-stripe-price-pro":    d.stripe_price_pro        || "",
        "cfg-stripe-price-business":d.stripe_price_business  || "",
        "cfg-pp-client":           d.paypal_client_id        || "",
        "cfg-pp-secret":           d.paypal_secret           || "",
      };
      let alguno = false;
      for (const [id, val] of Object.entries(campos)) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.value = val;
        if (val) { el.readOnly = true; el.style.background = "#f9fafb"; el.style.color = "#6b7280"; alguno = true; }
      }
      document.getElementById("cfg-pp-env").value = d.paypal_env || "live";
      if (alguno) {
        document.getElementById("cfg-pp-env").disabled = true;
        document.getElementById("cfg-pp-env").style.background = "#f9fafb";
        document.getElementById("cfg-pp-env").style.color = "#6b7280";
        // Mostrar botón Editar
        const btnEdit = document.createElement("button");
        btnEdit.textContent = "✏️ Editar configuración";
        btnEdit.style.cssText = "padding:10px 20px;background:#1f2937;color:#e5e7eb;border:1px solid #374151;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-left:10px;";
        btnEdit.onclick = () => {
          for (const id of Object.keys(campos)) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.readOnly = false; el.style.background = ""; el.style.color = "";
          }
          document.getElementById("cfg-pp-env").disabled = false;
          document.getElementById("cfg-pp-env").style.background = "";
          document.getElementById("cfg-pp-env").style.color = "";
          btnEdit.remove();
        };
        document.querySelector("#pagos-cfg-msg").after(btnEdit);
      }
    }).catch(() => {});

  window.guardarPagosConfig = async function() {
    const msg = document.getElementById("pagos-cfg-msg");
    msg.textContent = "Guardando...";
    msg.style.color = "#6b7280";
    try {
      const res = await fetch(`${API_BASE}/api/admin/payment-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
        body: JSON.stringify({
          stripe_public_key:      document.getElementById("cfg-stripe-pk").value.trim(),
          stripe_secret_key:      document.getElementById("cfg-stripe-sk").value.trim(),
          stripe_webhook_secret:  document.getElementById("cfg-stripe-wh").value.trim(),
          stripe_price_starter:   document.getElementById("cfg-stripe-price-starter").value.trim(),
          stripe_price_growth:    document.getElementById("cfg-stripe-price-growth").value.trim(),
          stripe_price_pro:       document.getElementById("cfg-stripe-price-pro").value.trim(),
          stripe_price_business:  document.getElementById("cfg-stripe-price-business").value.trim(),
          paypal_client_id:       document.getElementById("cfg-pp-client").value.trim(),
          paypal_secret:          document.getElementById("cfg-pp-secret").value.trim(),
          paypal_env:             document.getElementById("cfg-pp-env").value,
        }),
      });
      const d = await res.json();
      if (d.ok) { msg.textContent = "✅ Configuración guardada correctamente"; msg.style.color = "#22c55e"; }
      else { msg.textContent = "❌ Error: " + (d.error || "desconocido"); msg.style.color = "#dc2626"; }
    } catch(e) { msg.textContent = "❌ Error: " + e.message; msg.style.color = "#dc2626"; }
  };

  closeAllDrops(); closeSearchDrop();
  return;
}

// =========================
// SECCIÓN PLAN
// =========================
if (id === "plan") {
  if (t) t.textContent = "Plan de facturación";
  if (s) s.textContent = "Gestiona tu suscripción";
  if (c) c.textContent = "Plan";

  const isAdmin = currentUser.role === "Administrador";

  const PLAN_DEFS = {
    starter:  { name:"Starter",  price:"9,99",  ppo:"0,09", limit:"100",    color:"#10b981", features:["Tiendas ilimitadas","Hasta 100 pedidos/mes","Sincronización automática","Seguimiento MRW","Métricas e informes"] },
    growth:   { name:"Growth",   price:"19,99", ppo:"0,07", limit:"500",    color:"#3b82f6", features:["Tiendas ilimitadas","Hasta 500 pedidos/mes","Sincronización automática","Seguimiento MRW","Métricas e informes"] },
    pro:      { name:"Pro",      price:"29,99", ppo:"0,05", limit:"1.000",  color:"#8b5cf6", features:["Tiendas ilimitadas","Hasta 1.000 pedidos/mes","Sincronización automática","Seguimiento MRW","Soporte prioritario"] },
    business: { name:"Business", price:"39,99", ppo:"0,03", limit:"∞",     color:"#f59e0b", features:["Tiendas ilimitadas","Pedidos ilimitados","Sincronización automática","Seguimiento MRW","Soporte prioritario"] },
  };

  box.className = "card";
  box.innerHTML = `<div style="max-width:960px;">
    ${isAdmin ? `<div style="background:rgba(34,197,94,.08);border:1px solid #86efac;border-radius:10px;padding:12px 18px;margin-bottom:24px;display:flex;align-items:center;gap:10px;">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#22c55e" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span style="font-size:13px;color:#16a34a;font-weight:600;">Cuenta de administrador — acceso ilimitado a todas las funciones.</span>
    </div>` : ""}
    <div id="plan-current-banner" style="margin-bottom:12px;"></div>
    <div id="plan-cancel-banner" style="display:none;background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.3);border-radius:10px;padding:12px 18px;margin-bottom:12px;font-size:13px;color:#fde047;font-weight:600;"></div>
    <div id="plan-trial-banner" style="display:none;background:rgba(34,197,94,.08);border:1px solid #86efac;border-radius:10px;padding:12px 18px;margin-bottom:20px;font-size:13px;color:#16a34a;font-weight:600;"></div>
    <h3 style="font-size:15px;font-weight:700;margin:0 0 6px;">Elige tu plan</h3>
    <p style="font-size:13px;color:#6b7280;margin:0 0 18px;">Tiendas ilimitadas en todos los planes. Precio base mensual + coste por pedido usado.</p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;" id="plan-cards">
      ${Object.entries(PLAN_DEFS).map(([p, info]) => `
        <div id="plan-card-${p}" style="border:2px solid #374151;border-radius:14px;padding:20px;display:flex;flex-direction:column;position:relative;transition:border-color .2s;">
          <div style="font-size:12px;font-weight:700;color:${info.color};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${info.name}</div>
          <div style="display:flex;align-items:baseline;gap:3px;margin-bottom:2px;">
            <span style="font-size:26px;font-weight:800;color:#f9fafb;">${info.price}€</span>
            <span style="font-size:12px;color:#6b7280;">/mes</span>
          </div>
          <div style="font-size:12px;color:${info.color};font-weight:600;margin-bottom:2px;">+ ${info.ppo}€ por pedido</div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:14px;">hasta ${info.limit} pedidos/mes</div>
          <ul style="list-style:none;padding:0;margin:0 0 18px;display:flex;flex-direction:column;gap:6px;flex:1;">
            ${info.features.map(f => `<li style="display:flex;align-items:center;gap:6px;font-size:11px;color:#e5e7eb;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="${info.color}" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>${f}</li>`).join("")}
          </ul>
          <div id="plan-actions-${p}" style="margin-top:auto;"></div>
        </div>`).join("")}
    </div>
    <div id="plan-invoice-preview" style="display:none;"></div>
    <div style="border-top:1px solid #f3f4f6;padding-top:14px;font-size:12px;color:#9ca3af;text-align:center;">
      Los pagos se procesan de forma segura. Cada pago activa el plan por 30 días. 7 días gratis en tu primera suscripción.
    </div>
  </div>`;

  async function loadPlanUI() {
    let d = { plan: "free", status: "inactive", expires_at: null, trial_active: false, trial_ends_at: null, had_trial: false, monthly_orders: 0, order_limit: null, is_blocked: false, variable_cost: 0, estimated_total: null, days_left_month: 0 };
    try {
      const r = await fetch(`${API_BASE}/api/billing/plan`, { headers: { Authorization: "Bearer " + getActiveToken() } });
      const j = await r.json();
      if (!j.error) Object.assign(d, j);
    } catch {}

    const currentPlan = d.plan || "free";
    const expiresAt   = d.expires_at;

    const planNames = { free: "Sin plan activo", starter: "Starter", growth: "Growth", pro: "Pro", business: "Business" };
    const planColors = { free: "#6b7280", starter: "#10b981", growth: "#3b82f6", pro: "#8b5cf6", business: "#f59e0b" };

    // Banner plan actual
    const banner = document.getElementById("plan-current-banner");
    if (banner) {
      const expStr = expiresAt ? new Date(expiresAt).toLocaleDateString("es-ES") : null;
      const statusLabel = (d.status === "trial" && d.status !== "active") ? " · <span style='color:#f59e0b;font-weight:700;'>Período de prueba</span>" : "";
      banner.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:12px 18px;background:#1f2937;border:1px solid #374151;border-radius:10px;flex-wrap:wrap;">
        <span style="font-size:13px;color:#e5e7eb;">Plan actual:</span>
        <span style="font-weight:700;color:${planColors[currentPlan] || "#6b7280"};font-size:14px;">${planNames[currentPlan] || currentPlan}</span>
        ${statusLabel}
        ${expStr ? `<span style="font-size:12px;color:#9ca3af;margin-left:4px;">· Vence el ${expStr}</span>` : ""}
        ${d.monthly_orders > 0 ? `<span style="font-size:12px;color:#6b7280;margin-left:auto;">${d.monthly_orders}${d.order_limit ? "/" + d.order_limit : ""} pedidos este mes</span>` : ""}
      </div>`;
    }

    // Banner de cancelación programada
    const cancelBanner = document.getElementById("plan-cancel-banner");
    if (cancelBanner) {
      if (d.subscription_cancel_at) {
        const cancelDate = new Date(d.subscription_cancel_at).toLocaleDateString("es-ES");
        cancelBanner.style.display = "block";
        cancelBanner.innerHTML = `⚠️ Has cancelado tu suscripción. Tu cuenta seguirá activa hasta el <strong>${cancelDate}</strong>, después pasará al plan gratuito.`;
      } else {
        cancelBanner.style.display = "none";
      }
    }

    // Banner de trial activo
    const trialBanner = document.getElementById("plan-trial-banner");
    if (trialBanner) {
      if (d.trial_active && d.trial_ends_at && d.status !== "active") {
        const trialEnd = new Date(d.trial_ends_at).toLocaleDateString("es-ES");
        trialBanner.style.display = "block";
        trialBanner.innerHTML = `🎉 Período de prueba activo — expira el <strong>${trialEnd}</strong>. Después necesitarás un plan de pago para seguir usando la app.`;
      } else {
        trialBanner.style.display = "none";
      }
    }

    // Resaltar card del plan actual
    document.querySelectorAll("[id^='plan-card-']").forEach(card => {
      card.style.borderColor = "#e5e7eb";
      card.style.boxShadow = "none";
    });
    const activeCard = document.getElementById("plan-card-" + currentPlan);
    if (activeCard) {
      const col = planColors[currentPlan] || "#22c55e";
      activeCard.style.borderColor = col;
      activeCard.style.boxShadow = `0 0 0 3px ${col}22`;
    }

    // Preview de factura del mes
    const invoiceDiv = document.getElementById("plan-invoice-preview");
    if (invoiceDiv && currentPlan !== "free" && !isAdmin) {
      try {
        const r2 = await fetch(`${API_BASE}/api/billing/invoice-preview`, { headers: { Authorization: "Bearer " + getActiveToken() } });
        const inv = await r2.json();
        if (inv.available) {
          invoiceDiv.style.display = "block";
          invoiceDiv.innerHTML = `
            <div style="background:#1f2937;border:1px solid #374151;border-radius:10px;padding:16px 20px;margin-top:4px;">
              <div style="font-size:13px;font-weight:700;color:#e5e7eb;margin-bottom:10px;">Resumen del mes actual (${inv.cycle_start} → ${inv.cycle_end})</div>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;">
                <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Cuota base:</span><span style="font-weight:600;">${inv.base_price.toFixed(2)}€</span></div>
                <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Pedidos usados:</span><span style="font-weight:600;">${inv.orders_used} × ${inv.price_per_order}€</span></div>
                <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Coste variable:</span><span style="font-weight:600;">${inv.variable_cost.toFixed(2)}€</span></div>
                <div style="display:flex;justify-content:space-between;border-top:1px solid #1f2937;padding-top:6px;margin-top:2px;"><span style="font-weight:700;color:#f9fafb;">Total estimado:</span><span style="font-weight:800;font-size:15px;color:#f9fafb;">${inv.total.toFixed(2)}€</span></div>
              </div>
            </div>`;
        } else {
          invoiceDiv.style.display = "none";
        }
      } catch { invoiceDiv.style.display = "none"; }
    } else if (invoiceDiv) {
      invoiceDiv.style.display = "none";
    }

    // Obtener client_id de PayPal para saber si está configurado
    let ppClientId = "";
    try {
      const r = await fetch(`${API_BASE}/api/billing/paypal/client-id`, { headers: { Authorization: "Bearer " + getActiveToken() } });
      const pj = await r.json();
      ppClientId = pj.client_id || "";
    } catch {}

    // Botones por plan
    ["starter","growth","pro","business"].forEach(p => {
      const actDiv = document.getElementById("plan-actions-" + p);
      if (!actDiv) return;
      if (isAdmin) {
        actDiv.innerHTML = `<div style="text-align:center;font-size:12px;color:#9ca3af;padding:8px 0;">Sin restricciones (admin)</div>`;
        return;
      }
      const isCurrent = p === currentPlan;
      const canTrial  = p === "starter" && !d.had_trial && d.status !== "active" && d.status !== "trial";
      actDiv.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;position:relative;">
          ${isCurrent ? `<div style="text-align:center;padding:7px;background:rgba(34,197,94,.08);border-radius:8px;font-size:12px;font-weight:700;color:#22c55e;">✓ Plan actual${d.status === "trial" ? " (prueba)" : ""}</div>` : ""}
          ${canTrial ? `<button onclick="startTrial('${p}')"
            style="width:100%;padding:9px;background:rgba(34,197,94,.08);color:#22c55e;border:1.5px solid #86efac;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
            🎁 Probar gratis 7 días
          </button>` : ""}
          ${isCurrent && d.status === "active" ? `<button onclick="gestionarSuscripcion()"
            style="width:100%;padding:9px;background:#1f2937;color:#e5e7eb;border:1px solid #374151;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
            ⚙️ Gestionar suscripción
          </button>` : ""}
          ${!(isCurrent && d.status === "active") ? `<button id="subscribe-btn-${p}" onclick="togglePaymentMenu('${p}')"
            style="width:100%;padding:10px;background:#635bff;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
            Suscribirse
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>` : ""}
          <div id="payment-menu-${p}" style="display:none;position:absolute;bottom:calc(100% + 6px);left:0;right:0;background:#111827;border:1px solid #374151;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:8px;z-index:100;">
            <button onclick="pagarStripe('${p}')"
              style="width:100%;padding:9px 12px;background:#1f2937;border:1px solid #374151;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;color:#f9fafb;margin-bottom:6px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#635bff" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
              Pago con tarjeta
            </button>
            <div id="paypal-btn-${p}" style="${ppClientId ? "" : "display:none;"}"></div>
          </div>
        </div>`;
    });

    // Cerrar menú al hacer click fuera
    document.addEventListener("click", function closePlanMenus(e) {
      if (!e.target.closest("[id^='subscribe-btn-']") && !e.target.closest("[id^='payment-menu-']")) {
        document.querySelectorAll("[id^='payment-menu-']").forEach(m => m.style.display = "none");
      }
    }, { passive: true });

    // Cargar PayPal SDK si está configurado
    if (ppClientId) {
      loadPayPalButtons(ppClientId, currentPlan);
    }
  }

  window.gestionarSuscripcion = async function() {
    try {
      const r = await fetch(`${API_BASE}/api/billing/stripe/portal`, {
        headers: { Authorization: "Bearer " + getActiveToken() },
      });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
      else alert(d.error || "No se pudo abrir el portal de Stripe");
    } catch(e) { alert("Error: " + e.message); }
  };

  window.startTrial = async function(plan) {
    try {
      const r = await fetch(`${API_BASE}/api/billing/start-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
        body: JSON.stringify({ plan }),
      });
      const d = await r.json();
      if (d.ok) {
        showToast("🎉 ¡Prueba activada!", `Tienes 7 días gratuitos con el plan ${plan}. Disfrútalo.`, "#22c55e");
        loadPlanUI();
      } else {
        alert(d.error || "No se pudo activar el período de prueba");
      }
    } catch(e) { alert("Error: " + e.message); }
  };

  window.togglePaymentMenu = function(plan) {
    const menu = document.getElementById("payment-menu-" + plan);
    if (!menu) return;
    // Cerrar otros
    document.querySelectorAll("[id^='payment-menu-']").forEach(m => {
      if (m.id !== "payment-menu-" + plan) m.style.display = "none";
    });
    menu.style.display = menu.style.display === "none" ? "block" : "none";
  };

  async function loadPayPalButtons(ppClientId, currentPlan) {
    // Cargar SDK PayPal dinámicamente
    if (!document.getElementById("paypal-sdk")) {
      const script = document.createElement("script");
      script.id = "paypal-sdk";
      script.src = `https://www.paypal.com/sdk/js?client-id=${ppClientId}&currency=EUR&intent=capture`;
      document.head.appendChild(script);
      await new Promise(res => { script.onload = res; script.onerror = res; });
    }

    if (!window.paypal) return;

    ["starter","growth","pro","business"].forEach(plan => {
      const container = document.getElementById("paypal-btn-" + plan);
      if (!container) return;
      window.paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 35 },
        createOrder: async () => {
          const r = await fetch(`${API_BASE}/api/billing/paypal/create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
            body: JSON.stringify({ plan }),
          });
          const d = await r.json();
          if (!d.orderID) throw new Error(d.error || "Error PayPal");
          return d.orderID;
        },
        onApprove: async (data) => {
          const r = await fetch(`${API_BASE}/api/billing/paypal/capture`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
            body: JSON.stringify({ orderID: data.orderID, plan }),
          });
          const d = await r.json();
          if (d.ok) {
            showToast("✅ Pago completado", `Plan ${plan} activado correctamente`, "#22c55e");
            loadPlanUI();
          } else {
            alert("Error al procesar el pago: " + (d.error || "desconocido"));
          }
        },
        onError: (err) => { alert("Error PayPal: " + err); },
      }).render("#paypal-btn-" + plan);
    });
  }

  window.pagarStripe = async function(plan) {
    try {
      const r = await fetch(`${API_BASE}/api/billing/stripe/create-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
        body: JSON.stringify({ plan }),
      });
      const d = await r.json();
      if (d.url) {
        window.location.href = d.url;
      } else {
        alert(d.error || "Error al iniciar el pago con Stripe");
      }
    } catch(e) {
      alert("Error: " + e.message);
    }
  };

  // Manejar retorno de Stripe
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("payment") === "success") {
    history.replaceState({}, "", "/");
    showToast("✅ Pago completado", "Tu plan ha sido activado. Puede tardar unos segundos en reflejarse.", "#22c55e");
  } else if (urlParams.get("payment") === "cancelled") {
    history.replaceState({}, "", "/");
    showToast("ℹ️ Pago cancelado", "No se realizó ningún cargo.", "#6b7280");
  }

  loadPlanUI();
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

  // Show/hide backdrop on tablet/mobile
  if (window.innerWidth <= 1024) {
    const bd = document.getElementById("sidebar-backdrop");
    if (bd) bd.style.display = sb.classList.contains("hidden") ? "none" : "block";
  }
}

function closeSidebarMobile() {
  const sb = document.getElementById("sidebar");
  if (!sb) return;
  sb.classList.add("hidden");
  const bd = document.getElementById("sidebar-backdrop");
  if (bd) bd.style.display = "none";
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
  // Guardar todos los IDs actuales en shownHoy para que no se regeneren hoy
  const d = dict();
  const currentList = getNotifications(d);
  if (currentList.length > 0) {
    const hoy = new Date().toISOString().slice(0, 10);
    const shownKey = `notis_shown_${currentUser?.id || "anon"}_${hoy}`;
    const shownHoy = JSON.parse(localStorage.getItem(shownKey) || "[]");
    const newShown = [...new Set([...shownHoy, ...currentList.map(n => n.id)])];
    localStorage.setItem(shownKey, JSON.stringify(newShown));
  }

  setNotifications([]);
  updateNotifBadge(0);

  const panel = document.getElementById("notifPanel");
  if (panel) {
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

let __searchDebounceTimer = null;

function doSearch(value) {
  const d = dict();
  const q = (value || "").trim().toLowerCase();
  const drop = document.getElementById("searchDrop");
  if (!drop) return;

  if (!q) {
    drop.innerHTML = "";
    drop.classList.remove("open");
    clearTimeout(__searchDebounceTimer);
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

  // Productos (local cache)
  const productosAll = (window.__allProductos || []).filter(p =>
    (p.title || "").toLowerCase().includes(q)
  );
  const productos = productosAll.slice(0, 5).map(p => ({
    label: `📦 ${p.title}`,
    section: "productos",
    type: "producto",
    orderNumber: String(p.id)
  }));
  window.__searchProductosIds = productosAll.map(p => String(p.id));

  // Render immediately with what we have (sections + products)
  // Pedidos placeholder while API loads
  const localResults = [...secciones, ...productos];
  _renderSearchDrop(drop, localResults, true);

  // Debounce API call for orders/tracking
  clearTimeout(__searchDebounceTimer);
  __searchDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/orders?q=${encodeURIComponent(q)}&limit=8&page=1`,
        { headers: { Authorization: "Bearer " + getActiveToken() } }
      );
      const data = await res.json();
      const pedidos = (data.orders || []).map(o => ({
        label: `🛍️ ${o.order_number || "-"} — ${o.customer_name || "-"}`,
        section: "pedidos",
        type: "pedido",
        orderNumber: o.order_number || "",
        status: o.fulfillment_status || ""
      }));
      const allResults = [...secciones, ...productos, ...pedidos];
      _renderSearchDrop(drop, allResults, false);
    } catch {}
  }, 300);

}

function _renderSearchDrop(drop, results, loading) {
  const d = dict();
  if (!drop) return;
  if (results.length === 0 && !loading) {
    drop.innerHTML = `<div class="search-empty">${d.ui.notFound}</div>`;
    drop.classList.add("open");
    return;
  }

  const dark = document.body.classList.contains("dark");
  const statusColors = {
    pendiente:      { bg: "rgba(234,179,8,.15)",    color: dark ? "#fbbf24" : "#92400e", border: dark ? "rgba(234,179,8,.3)"    : "rgba(234,179,8,.45)" },
    en_preparacion: { bg: "rgba(59,130,246,.15)",   color: dark ? "#93c5fd" : "#1e40af", border: dark ? "rgba(59,130,246,.3)"   : "rgba(59,130,246,.45)" },
    enviado:        { bg: "rgba(59,130,246,.15)",   color: dark ? "#93c5fd" : "#1e40af", border: dark ? "rgba(59,130,246,.3)"   : "rgba(59,130,246,.45)" },
    en_transito:    { bg: "rgba(139,92,246,.15)",   color: dark ? "#c4b5fd" : "#5b21b6", border: dark ? "rgba(139,92,246,.3)"   : "rgba(139,92,246,.45)" },
    franquicia:     { bg: "rgba(139,92,246,.15)",   color: dark ? "#c4b5fd" : "#5b21b6", border: dark ? "rgba(139,92,246,.3)"   : "rgba(139,92,246,.45)" },
    entregado:      { bg: "rgba(34,197,94,.15)",    color: dark ? "#4ade80" : "#15803d", border: dark ? "rgba(34,197,94,.3)"    : "rgba(34,197,94,.4)" },
    devuelto:       { bg: "rgba(239,68,68,.15)",    color: dark ? "#fca5a5" : "#991b1b", border: dark ? "rgba(239,68,68,.3)"    : "rgba(239,68,68,.45)" },
    destruido:      { bg: "rgba(107,114,128,.15)",  color: dark ? "#9ca3af" : "#374151", border: dark ? "rgba(107,114,128,.3)"  : "rgba(107,114,128,.45)" },
    cancelado:      { bg: "rgba(239,68,68,.15)",    color: dark ? "#fca5a5" : "#991b1b", border: dark ? "rgba(239,68,68,.3)"    : "rgba(239,68,68,.45)" },
  };
  const statusNames = {
    pendiente: "Pendiente", en_preparacion: "En preparación", enviado: "Enviado",
    en_transito: "En tránsito", franquicia: "Franquicia", entregado: "Entregado",
    devuelto: "Devuelto", destruido: "Destruido", cancelado: "Cancelado",
  };

  let html = results.map(r => {
    if (r.type === "pedido" && r.status) {
      const sc = statusColors[r.status] || { bg: "rgba(107,114,128,.15)", color: "#9ca3af", border: "rgba(107,114,128,.3)" };
      const sn = statusNames[r.status] || r.status;
      return `<div class="search-item" onclick="goToSearch('${escapeAttr(r.section)}','${escapeAttr(r.orderNumber || "")}')" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span>${escapeHtml(r.label)}</span>
        <span style="padding:2px 7px;border-radius:5px;font-size:11px;font-weight:600;background:${sc.bg};color:${sc.color};border:1px solid ${sc.border||'transparent'};white-space:nowrap;flex-shrink:0;">${escapeHtml(sn)}</span>
      </div>`;
    }
    return `<div class="search-item" onclick="goToSearch('${escapeAttr(r.section)}','${escapeAttr(r.orderNumber || "")}')">
      ${escapeHtml(r.label)}
    </div>`;
  }).join("");

  // "Ver todos" hint for multiple product matches
  const totalProductos = window.__searchProductosIds?.length || 0;
  if (totalProductos > 1) {
    html += `<div class="search-item" onclick="goToSearchAllProductos()" style="border-top:1px solid #1f2937;color:#c4b5fd;font-weight:600;font-size:12px;">
      🔍 Ver los ${totalProductos} resultados de productos · Enter
    </div>`;
  }

  if (loading) {
    html += `<div class="search-item" style="color:#9ca3af;font-size:12px;pointer-events:none;">Buscando pedidos...</div>`;
  }

  drop.innerHTML = html;
  drop.classList.add("open");
}

function doSearchKeydown(e) {
  if (e.key !== "Enter") return;
  const ids = window.__searchProductosIds || [];
  if (ids.length === 0) return;
  if (ids.length === 1) {
    goToSearch("productos", ids[0]);
  } else {
    goToSearchAllProductos();
  }
}
window.doSearchKeydown = doSearchKeydown;

function goToSearchAllProductos() {
  const ids = window.__searchProductosIds || [];
  if (ids.length === 0) return;
  closeSearchDrop();
  const searchEl = document.getElementById("search");
  if (searchEl) searchEl.value = "";
  window.__pendingProductoIds = ids;
  setSection("productos");
}
window.goToSearchAllProductos = goToSearchAllProductos;

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
      btn.style.background = "#22c55e";
      btn.style.color = "#fff";
      btn.style.borderColor = "#22c55e";
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
                ${window.__DPF.triggerBtn('ree', 'Período')}
                <input type="date" id="ree-date-from" value="" style="display:none;">
                <input type="date" id="ree-date-to" value="" style="display:none;">
                <select id="ree-shop" onchange="renderReembolsos()"
                  style="padding:7px 10px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
                  <option value="">Todas las tiendas</option>
                </select>
                <button onclick="clearReembolsosFilters()" style="padding:7px 14px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.4);border-radius:8px;color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Limpiar</button>
                <label style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:rgba(34,197,94,.08);border:1px solid #22c55e;border-radius:8px;color:#22c55e;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">
                  ✅ Importar Pagados
                  <input type="file" accept=".pdf" multiple style="display:none;" onchange="importarPagadosPDF(this)">
                </label>
              </div>
          </div>
          <div style="border-bottom:1px solid #1f2937;margin-bottom:12px;"></div>

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
    window.__DPF.create('ree', '', '', 'personalizado', 'Período', null, null, function() { window.renderReembolsos(); });
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
        <select id="ads-shop-sel" style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          <option value="">Cargando tiendas...</option>
        </select>
        <select id="ads-month-sel" style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${Array.from({length:12},(_,i)=>{const d=new Date();d.setMonth(i);return `<option value="${i+1}" ${i===new Date().getMonth()?"selected":""}>${d.toLocaleString("es",{month:"long"})}</option>`;}).join("")}
        </select>
        <select id="ads-year-sel" style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
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
        <select id="gv-month-sel" style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"].map((m,i)=>`<option value="${i+1}" ${i===new Date().getMonth()?"selected":""}>${m}</option>`).join("")}
        </select>
        <select id="gv-year-sel" style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
          ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===new Date().getFullYear()?"selected":""}>${y}</option>`).join("")}
        </select>
        <button onclick="loadGastosVarios()" style="padding:7px 16px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Ver</button>
      </div>
      <div id="gv-mes-label" style="margin-bottom:16px;padding:10px 16px;background:rgba(34,197,94,.08);border:1px solid #86efac;border-radius:8px;font-size:13px;color:#22c55e;font-weight:600;"></div>
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
      <select id="nom-month-sel" onchange="loadNominaData()" style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${monthNames.map((m,i)=>`<option value="${i+1}" ${i===now.getMonth()?"selected":""}>${m}</option>`).join("")}
      </select>
      <select id="nom-year-sel" onchange="loadNominaData()" style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===now.getFullYear()?"selected":""}>${y}</option>`).join("")}
      </select>
      <button onclick="openAddTrabajador()" style="padding:7px 16px;background:#111827;color:#22c55e;border:1px solid #22c55e;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">+ Trabajador</button>
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
    const inp = `width:100%;padding:6px 8px;border:1px solid #374151;border-radius:6px;font-size:13px;font-family:inherit;background:var(--card);color:var(--text);box-sizing:border-box;`;

    const totalNomina = trabajadores.reduce((s,t) => s + (parseFloat(pagosMap[t.id])||0), 0);

    content.innerHTML = `
      <div style="background:var(--card);border:1px solid #374151;border-radius:12px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#22c55e;">
              <th style="${thS}left;">TRABAJADOR</th>
              <th style="${thS}right;">PAGO DEL MES (€)</th>
              <th style="${thS}center;">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            ${trabajadores.map(t => `
              <tr>
                <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;">${escapeHtml(t.nombre)}</td>
                <td style="padding:8px 14px;border:1px solid #374151;">
                  <input type="number" step="0.01" min="0"
                    value="${fmt(pagosMap[t.id]||0)}"
                    data-id="${t.id}" data-mes="${mes}"
                    onchange="saveNominaPago(this)"
                    style="${inp}text-align:right;">
                </td>
                <td style="padding:8px 14px;border:1px solid #374151;text-align:center;">
                  <button onclick="deleteTrabajador(${t.id})"
                    style="padding:4px 12px;background:rgba(239,68,68,.1);color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font-size:12px;cursor:pointer;">
                    Eliminar
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr style="background:rgba(34,197,94,.08);">
              <td style="padding:11px 14px;border:1px solid #374151;font-weight:700;">TOTAL NÓMINA</td>
              <td style="padding:11px 14px;border:1px solid #374151;text-align:right;font-weight:700;color:#22c55e;">${fmt(totalNomina)} €</td>
              <td style="border:1px solid #374151;"></td>
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
    input.style.borderColor = "#22c55e";
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

// =========================
// CHAT WIDGET
// =========================
(function initChat() {
  let chatOpen = false;
  let chatPollTimer = null;
  let chatCurrentUser = null; // para admin: el usuario seleccionado
  let chatCurrentGuest = null;
  let lastUnreadCount = 0;

  // Shared AudioContext – created once on first user gesture, reused for background tabs
  let _audioCtx = null;
  function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
  }
  // Prime the context on any user interaction so it's allowed to play in background
  document.addEventListener("click", () => { try { getAudioCtx().resume(); } catch {} }, { once: false, passive: true });

  function playNotifSound() {
    try {
      const ctx = getAudioCtx();
      // Resume in case the browser suspended it (tab in background)
      ctx.resume().then(() => {
        [0, 0.18].forEach((delay, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.value = i === 0 ? 880 : 1100;
          gain.gain.setValueAtTime(0.35, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.25);
        });
      });
    } catch {}
  }

  function getChatToken() {
    // El chat siempre usa el token real del usuario, nunca el impersonado
    // (el endpoint de conversaciones requiere rol admin)
    return localStorage.getItem("token") || "";
  }

  function buildChatWidget() {
    if (document.getElementById("chat-widget")) return;

    const widget = document.createElement("div");
    widget.id = "chat-widget";
    widget.innerHTML = `
      <button id="chat-fab" onclick="window.__toggleChat()" title="Soporte" style="
        position:fixed;bottom:24px;right:24px;z-index:9000;
        width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;
        background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 16px rgba(0,0,0,.2);transition:transform .2s;">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span id="chat-badge" style="
          display:none;position:absolute;top:-4px;right:-4px;
          background:#dc2626;color:#fff;border-radius:50%;
          min-width:20px;height:20px;padding:0 4px;
          font-size:11px;font-weight:700;
          align-items:center;justify-content:center;
          box-shadow:0 0 0 2px #fff;
          font-family:inherit;line-height:1;">0</span>
      </button>

      <div id="chat-panel" style="
        display:none;position:fixed;bottom:88px;right:24px;z-index:9000;
        width:340px;height:480px;background:#111827;border-radius:16px;
        box-shadow:0 8px 32px rgba(0,0,0,.15);display:none;flex-direction:column;overflow:hidden;">

        <div style="background:#22c55e;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span style="font-weight:700;font-size:14px;color:#fff;" id="chat-panel-title">Soporte ProfitCod</span>
          </div>
          <button onclick="window.__toggleChat()" style="background:none;border:none;cursor:pointer;color:#fff;font-size:18px;line-height:1;">✕</button>
        </div>

        <div id="chat-conv-list" style="display:none;flex:1;overflow-y:auto;padding:8px;"></div>

        <!-- Formulario de identificación (clientes sin display_name) -->
        <div id="chat-info-form" style="display:none;flex:1;padding:20px;display:none;flex-direction:column;gap:14px;justify-content:center;">
          <p style="font-size:13px;color:#6b7280;margin:0;">Antes de continuar, indícanos cómo contactarte:</p>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="font-size:12px;font-weight:600;color:#e5e7eb;">Nombre *</label>
            <input id="chat-info-name" type="text" placeholder="Tu nombre completo"
              style="padding:9px 12px;border:1.5px solid #374151;border-radius:8px;font-size:13px;font-family:inherit;outline:none;" />
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="font-size:12px;font-weight:600;color:#e5e7eb;">Email</label>
            <input id="chat-info-email" type="email"
              style="padding:9px 12px;border:1.5px solid #374151;border-radius:8px;font-size:13px;font-family:inherit;background:#1f2937;color:#e5e7eb;outline:none;" readonly />
          </div>
          <div id="chat-info-error" style="font-size:12px;color:#dc2626;display:none;"></div>
          <button onclick="window.__submitChatInfo()"
            style="padding:10px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;">
            Iniciar conversación
          </button>
        </div>

        <div id="chat-msgs" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;"></div>

        <div id="chat-input-area" style="border-top:1px solid #1f2937;padding:10px;display:flex;gap:8px;align-items:flex-end;">
          <textarea id="chat-input" rows="1" placeholder="Escribe un mensaje..."
            style="flex:1;resize:none;border:1px solid #374151;border-radius:10px;padding:8px 10px;font-size:13px;font-family:inherit;outline:none;max-height:80px;overflow-y:auto;"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window.__sendChatMsg();}"></textarea>
          <button onclick="window.__sendChatMsg()" style="padding:8px 14px;background:#22c55e;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">Enviar</button>
        </div>
      </div>`;
    document.body.appendChild(widget);
  }

  function renderMsg(m) {
    const isMe = (currentUser?.role === "Administrador" && m.sender === "admin")
              || (currentUser?.role !== "Administrador" && (m.sender === "client" || m.sender === "guest"));
    const time = m.created_at ? new Date(m.created_at).toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" }) : "";
    return `<div style="display:flex;flex-direction:column;align-items:${isMe ? "flex-end" : "flex-start"};">
      <div style="max-width:80%;padding:8px 12px;border-radius:${isMe ? "12px 12px 4px 12px" : "12px 12px 12px 4px"};
        background:${isMe ? "#22c55e" : "#f3f4f6"};color:${isMe ? "#fff" : "#111827"};font-size:13px;line-height:1.5;">
        ${escapeHtml ? escapeHtml(m.content) : m.content}
      </div>
      <span style="font-size:10px;color:#9ca3af;margin-top:2px;">${time}</span>
    </div>`;
  }

  async function loadMessages() {
    const token = getChatToken();
    if (!token) return;
    try {
      let url = `${API_BASE}/api/chat/messages`;
      if (currentUser?.role === "Administrador" && chatCurrentUser) url += `?user_id=${chatCurrentUser}`;
      else if (currentUser?.role === "Administrador" && chatCurrentGuest) url += `?guest_id=${chatCurrentGuest}`;

      const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      const d = await r.json();
      const msgs = d.messages || [];
      const box = document.getElementById("chat-msgs");
      if (!box) return;
      box.innerHTML = msgs.length
        ? msgs.map(renderMsg).join("")
        : `<div style="text-align:center;color:#9ca3af;font-size:13px;margin-top:40px;">Aún no hay mensajes.<br>¡Escríbenos para ayudarte!</div>`;
      box.scrollTop = box.scrollHeight;
    } catch {}
  }

  async function loadConversations() {
    if (currentUser?.role !== "Administrador") return;
    const token = getChatToken();
    try {
      const r = await fetch(`${API_BASE}/api/chat/conversations`, { headers: { Authorization: "Bearer " + token } });
      const d = await r.json();
      console.log("[Chat] conversations response:", r.status, d);
      if (!r.ok) {
        const list = document.getElementById("chat-conv-list");
        if (list) list.innerHTML = `<div style="text-align:center;color:#dc2626;font-size:12px;padding:20px;">Error ${r.status}: ${d?.error || "desconocido"}</div>`;
        return;
      }
      const list = document.getElementById("chat-conv-list");
      if (!list) return;

      const all = [
        ...(d.users || []).map(u => ({ ...u, type: "user", label: u.display_name || u.email })),
        ...(d.guests || []).map(g => ({ ...g, type: "guest", label: g.guest_name || g.guest_email || g.guest_id })),
      ].sort((a, b) => (b.last_message || "").localeCompare(a.last_message || ""));

      if (!all.length) {
        list.innerHTML = `<div style="text-align:center;color:#9ca3af;font-size:13px;padding:30px 10px;">No hay conversaciones aún</div>`;
        return;
      }

      const frag = document.createDocumentFragment();
      all.forEach(c => {
        const convId = c.type === "user" ? c.user_id : c.guest_id;
        const div = document.createElement("div");
        div.style.cssText = "padding:10px 12px;border-radius:10px;cursor:pointer;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;gap:8px;";
        div.addEventListener("mouseover", () => div.style.background = "#f9fafb");
        div.addEventListener("mouseout",  () => div.style.background = "");
        div.addEventListener("click",     () => window.__selectChatConv(c.type, convId, c.label, c.email || c.guest_email || ""));
        const unread = parseInt(c.unread) > 0
          ? `<span style="background:#dc2626;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${c.unread}</span>`
          : "";
        div.innerHTML = `
          <div>
            <div style="font-size:13px;font-weight:600;color:#f9fafb;">${c.label}</div>
            <div style="font-size:11px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${c.last_content || ""}</div>
          </div>${unread}`;
        frag.appendChild(div);
      });
      list.innerHTML = "";
      list.appendChild(frag);
    } catch(e) { console.error("[Chat] loadConversations error:", e); }
  }

  async function checkUnread() {
    const token = getChatToken();
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/api/chat/unread`, { headers: { Authorization: "Bearer " + token } });
      const d = await r.json();
      const badge = document.getElementById("chat-badge");
      if (!badge) return;
      const count = d.count || 0;
      if (count > 0) {
        badge.style.display = "flex";
        badge.textContent = count > 9 ? "9+" : count;
      } else {
        badge.style.display = "none";
      }
      // Sonido solo cuando aumenta el número de no leídos (mensaje nuevo)
      if (count > lastUnreadCount && lastUnreadCount >= 0) {
        playNotifSound();
      }
      lastUnreadCount = count;
    } catch {}
  }

  window.__toggleChat = function() {
    const panel = document.getElementById("chat-panel");
    if (!panel) return;
    chatOpen = !chatOpen;
    panel.style.display = chatOpen ? "flex" : "none";
    panel.style.flexDirection = "column";
    if (chatOpen) {
      if (currentUser?.role === "Administrador") {
        // Admin: mostrar lista de conversaciones primero
        document.getElementById("chat-conv-list").style.display = "block";
        document.getElementById("chat-msgs").style.display = "none";
        document.getElementById("chat-input-area").style.display = "none";
        document.getElementById("chat-panel-title").textContent = "Conversaciones";
        loadConversations();
      } else {
        document.getElementById("chat-conv-list").style.display = "none";
        if (!currentUser?.display_name) {
          // Mostrar formulario de identificación
          const infoForm = document.getElementById("chat-info-form");
          infoForm.style.display = "flex";
          infoForm.style.flexDirection = "column";
          document.getElementById("chat-msgs").style.display = "none";
          document.getElementById("chat-input-area").style.display = "none";
          // Pre-rellenar email de la cuenta
          const emailEl = document.getElementById("chat-info-email");
          if (emailEl) emailEl.value = currentUser?.email || "";
          setTimeout(() => document.getElementById("chat-info-name")?.focus(), 100);
        } else {
          document.getElementById("chat-info-form").style.display = "none";
          document.getElementById("chat-msgs").style.display = "flex";
          document.getElementById("chat-msgs").style.flexDirection = "column";
          document.getElementById("chat-input-area").style.display = "flex";
          loadMessages();
        }
      }
      clearInterval(chatPollTimer);
      chatPollTimer = setInterval(() => {
        if (currentUser?.role === "Administrador" && !chatCurrentUser && !chatCurrentGuest) loadConversations();
        else loadMessages();
        checkUnread();
      }, 5000);
    } else {
      clearInterval(chatPollTimer);
    }
  };

  window.__selectChatConv = function(type, id, label, email) {
    if (type === "user") { chatCurrentUser = id; chatCurrentGuest = null; }
    else { chatCurrentGuest = id; chatCurrentUser = null; }
    document.getElementById("chat-conv-list").style.display = "none";
    const msgs = document.getElementById("chat-msgs");
    msgs.style.display = "flex"; msgs.style.flexDirection = "column";
    document.getElementById("chat-input-area").style.display = "flex";
    const displayName = label || (type === "user" ? "Usuario #" + id : "Visitante");
    const emailLine = email ? `<div style="font-size:11px;opacity:0.8;font-weight:400;">${email}</div>` : "";
    document.getElementById("chat-panel-title").innerHTML =
      `<span onclick="window.__backToConvList()" style="cursor:pointer;margin-right:8px;font-size:16px;line-height:1;">‹</span>
       <div style="display:flex;flex-direction:column;line-height:1.3;">
         <span style="font-size:14px;font-weight:700;">${displayName}</span>
         ${emailLine}
       </div>`;
    loadMessages();
  };

  window.__backToConvList = function() {
    chatCurrentUser = null; chatCurrentGuest = null;
    document.getElementById("chat-conv-list").style.display = "block";
    document.getElementById("chat-msgs").style.display = "none";
    document.getElementById("chat-input-area").style.display = "none";
    document.getElementById("chat-panel-title").textContent = "Conversaciones";
    loadConversations();
  };

  window.__sendChatMsg = async function() {
    const inp = document.getElementById("chat-input");
    const content = inp?.value?.trim();
    if (!content) return;
    inp.value = "";
    const token = getChatToken();
    try {
      const body = { content };
      if (currentUser?.role === "Administrador" && chatCurrentUser)  body.to_user_id  = chatCurrentUser;
      if (currentUser?.role === "Administrador" && chatCurrentGuest) body.to_guest_id = chatCurrentGuest;
      await fetch(`${API_BASE}/api/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(body),
      });
      loadMessages();
    } catch {}
  };

  window.__submitChatInfo = async function() {
    const nameEl  = document.getElementById("chat-info-name");
    const errEl   = document.getElementById("chat-info-error");
    const name    = nameEl?.value?.trim();
    if (!name) {
      errEl.textContent = "El nombre es obligatorio";
      errEl.style.display = "block";
      return;
    }
    errEl.style.display = "none";
    try {
      const token = getChatToken();
      await fetch(`${API_BASE}/api/auth/display-name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ display_name: name }),
      });
      // Actualizar currentUser local para no volver a pedir el nombre
      if (currentUser) currentUser.display_name = name;
    } catch {}
    // Pasar al chat
    document.getElementById("chat-info-form").style.display = "none";
    document.getElementById("chat-msgs").style.display = "flex";
    document.getElementById("chat-msgs").style.flexDirection = "column";
    document.getElementById("chat-input-area").style.display = "flex";
    loadMessages();
    setTimeout(() => document.getElementById("chat-input")?.focus(), 100);
  };

  // Iniciar widget y polling de unread
  function startChat() {
    buildChatWidget();
    checkUnread();
    setInterval(checkUnread, 15000);
  }

  // Esperar a que el DOM esté listo
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startChat);
  else startChat();
})();

// Exponer funciones usadas por onclick
window.loadApp = loadApp;
window.setSection = setSection;
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;
window.closeSidebarMobile = closeSidebarMobile;
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

  const inp = (id, ph, type="text") => `<input id="${id}" type="${type}" placeholder="${ph}" style="width:100%;padding:9px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;box-sizing:border-box;">`;

  if (type === "profile") {
    title.textContent = "Perfil";
    subtitle.textContent = "Datos de la cuenta";
    crumb.textContent = "Perfil";

    box.innerHTML = `<div style="max-width:480px;">
      <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:28px;">
        <div style="position:relative;cursor:pointer;" onclick="document.getElementById('avatar-input').click()">
          <div id="avatar-circle" style="width:96px;height:96px;border-radius:50%;background:#1f2937;border:2px solid #374151;overflow:hidden;display:flex;align-items:center;justify-content:center;">
            <svg id="avatar-placeholder-icon" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#9ca3af" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <img id="avatar-img" style="display:none;width:100%;height:100%;object-fit:cover;" />
          </div>
          <div style="position:absolute;bottom:2px;right:2px;background:#22c55e;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>
        </div>
        <input type="file" id="avatar-input" accept="image/*" style="display:none;" onchange="handleAvatarChange(event)">
        <div style="margin-top:14px;display:flex;align-items:center;gap:6px;">
          <input id="display-name-input" type="text"
            value="${escapeHtml(currentUser.display_name)}"
            placeholder="Tu nombre o empresa..."
            style="border:none;border-bottom:2px solid #e5e7eb;padding:4px 6px;font-size:17px;font-weight:700;color:#f9fafb;text-align:center;background:transparent;font-family:inherit;width:220px;outline:none;transition:border-color .2s;"
            onfocus="this.style.borderBottomColor='#22c55e'"
            onblur="this.style.borderBottomColor='#e5e7eb';guardarDisplayName(this.value)"
            onkeydown="if(event.key==='Enter'){this.blur();}">
        </div>
        <div style="margin-top:4px;font-size:12px;color:#9ca3af;">${escapeHtml(currentUser.email)}</div>
        <span style="margin-top:6px;padding:3px 14px;background:rgba(34,197,94,.12);color:#22c55e;border-radius:20px;font-size:12px;font-weight:600;">${escapeHtml(currentUser.role)}</span>
      </div>

      <div style="border-top:1px solid #1f2937;padding-top:22px;">
        <div style="font-weight:700;font-size:14px;margin-bottom:14px;">Cambiar contraseña</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${inp("curr-pass","Contraseña actual","password")}
          ${inp("new-pass","Nueva contraseña","password")}
          ${inp("confirm-pass","Confirmar nueva contraseña","password")}
        </div>
        <div id="pass-msg" style="margin-top:8px;font-size:12px;min-height:16px;"></div>
        <button onclick="changePassword()" style="margin-top:12px;padding:9px 22px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Actualizar contraseña</button>
      </div>
    </div>`;

    // Cargar avatar guardado
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: "Bearer " + getActiveToken() } })
      .then(r => r.json()).then(data => {
        if (data.user?.avatar_url) {
          const tmpImg = new Image();
          tmpImg.onload = () => {
            // Re-renderizar con fondo blanco para corregir avatares guardados con fondo negro
            const c = document.createElement("canvas");
            c.width = 256; c.height = 256;
            const cx = c.getContext("2d");
            cx.fillStyle = "#ffffff";
            cx.fillRect(0, 0, 256, 256);
            cx.drawImage(tmpImg, 0, 0, 256, 256);
            const fixedUrl = c.toDataURL("image/jpeg", 0.88);
            const imgEl = document.getElementById("avatar-img");
            if (imgEl) { imgEl.src = fixedUrl; imgEl.style.display = "block"; }
            const icon = document.getElementById("avatar-placeholder-icon");
            if (icon) icon.style.display = "none";
            // Re-guardar si difiere (arregla avatares viejos con fondo negro)
            if (fixedUrl !== data.user.avatar_url) {
              fetch(`${API_BASE}/api/auth/avatar`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
                body: JSON.stringify({ avatar_url: fixedUrl })
              }).catch(() => {});
            }
          };
          tmpImg.src = data.user.avatar_url;
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
      <button onclick="saveBillingData()" style="margin-top:14px;padding:9px 22px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Actualizar datos de facturación</button>

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

  // Leer imagen y abrir editor de recorte
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Abrir modal editor
  const croppedUrl = await abrirEditorAvatar(dataUrl);
  if (!croppedUrl) return; // cancelado

  // Mostrar preview
  const imgEl = document.getElementById("avatar-img");
  const icon  = document.getElementById("avatar-placeholder-icon");
  if (imgEl) { imgEl.src = croppedUrl; imgEl.style.display = "block"; }
  if (icon) icon.style.display = "none";

  // Subir al servidor
  try {
    const res = await fetch(`${API_BASE}/api/auth/avatar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ avatar_url: croppedUrl })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Error al guardar la imagen"); }
    else {
      const headerAvatar = document.querySelector(".user-avatar");
      if (headerAvatar) {
        headerAvatar.style.backgroundImage = `url('${croppedUrl}')`;
        headerAvatar.style.backgroundSize = "cover";
        headerAvatar.style.backgroundPosition = "center";
      }
      showToast("Foto de perfil actualizada", "", "#22c55e");
    }
  } catch { alert("Error al guardar la imagen"); }
}

function abrirEditorAvatar(srcUrl) {
  return new Promise(resolve => {
    const existing = document.getElementById("avatar-editor-modal");
    if (existing) existing.remove();

    const PREVIEW = 240; // tamaño del círculo de preview
    let scale = 1, offX = 0, offY = 0;
    let dragging = false, startX = 0, startY = 0, startOffX = 0, startOffY = 0;
    let imgW = 0, imgH = 0;

    const modal = document.createElement("div");
    modal.id = "avatar-editor-modal";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;";
    modal.innerHTML = `
      <div style="background:#111827;border-radius:16px;padding:28px 24px;width:320px;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 24px 64px rgba(0,0,0,0.4);">
        <div style="font-size:15px;font-weight:700;color:#f9fafb;align-self:flex-start;">Ajustar foto de perfil</div>
        <!-- Círculo de preview con canvas -->
        <div style="width:${PREVIEW}px;height:${PREVIEW}px;border-radius:50%;overflow:hidden;border:3px solid #22c55e;cursor:grab;flex-shrink:0;touch-action:none;">
          <canvas id="avatar-crop-canvas" width="${PREVIEW}" height="${PREVIEW}" style="display:block;"></canvas>
        </div>
        <!-- Slider zoom -->
        <div style="width:100%;display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#6b7280;">
            <span>Zoom</span><span id="avatar-zoom-label">1.0×</span>
          </div>
          <input id="avatar-zoom-slider" type="range" min="50" max="300" value="100"
            style="width:100%;accent-color:#22c55e;cursor:pointer;">
        </div>
        <!-- Botones -->
        <div style="display:flex;gap:10px;width:100%;">
          <button id="avatar-cancel-btn" style="flex:1;padding:10px;background:#1f2937;border:1px solid #374151;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Cancelar</button>
          <button id="avatar-save-btn" style="flex:1;padding:10px;background:#22c55e;border:none;border-radius:8px;font-size:13px;font-weight:600;color:#fff;cursor:pointer;font-family:inherit;">Guardar foto</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const canvas = document.getElementById("avatar-crop-canvas");
    const ctx = canvas.getContext("2d");
    const slider = document.getElementById("avatar-zoom-slider");
    const zoomLabel = document.getElementById("avatar-zoom-label");

    const img = new Image();
    img.onload = () => {
      imgW = img.width; imgH = img.height;
      // Escala inicial: la imagen llena el círculo por el lado más corto
      const minSide = Math.min(imgW, imgH);
      scale = PREVIEW / minSide;
      offX = (PREVIEW - imgW * scale) / 2;
      offY = (PREVIEW - imgH * scale) / 2;
      slider.value = Math.round(scale * 100);
      draw();
    };
    img.src = srcUrl;

    function draw() {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, PREVIEW, PREVIEW);
      ctx.drawImage(img, offX, offY, imgW * scale, imgH * scale);
    }

    function clampOffset() {
      const sw = imgW * scale, sh = imgH * scale;
      if (sw >= PREVIEW) {
        offX = Math.min(0, Math.max(PREVIEW - sw, offX));
      } else {
        offX = (PREVIEW - sw) / 2;
      }
      if (sh >= PREVIEW) {
        offY = Math.min(0, Math.max(PREVIEW - sh, offY));
      } else {
        offY = (PREVIEW - sh) / 2;
      }
    }

    slider.addEventListener("input", () => {
      const newScale = parseInt(slider.value) / 100;
      // Zoom centrado en el centro del preview
      const cx = PREVIEW / 2, cy = PREVIEW / 2;
      offX = cx - (cx - offX) * (newScale / scale);
      offY = cy - (cy - offY) * (newScale / scale);
      scale = newScale;
      clampOffset();
      zoomLabel.textContent = scale.toFixed(1) + "×";
      draw();
    });

    // Drag
    canvas.addEventListener("pointerdown", e => {
      dragging = true; canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
      startX = e.clientX; startY = e.clientY;
      startOffX = offX; startOffY = offY;
    });
    canvas.addEventListener("pointermove", e => {
      if (!dragging) return;
      offX = startOffX + (e.clientX - startX);
      offY = startOffY + (e.clientY - startY);
      clampOffset();
      draw();
    });
    canvas.addEventListener("pointerup", () => { dragging = false; canvas.style.cursor = "grab"; });

    document.getElementById("avatar-cancel-btn").addEventListener("click", () => {
      modal.remove(); resolve(null);
    });

    document.getElementById("avatar-save-btn").addEventListener("click", () => {
      // Renderizar a 256×256 para guardar
      const out = document.createElement("canvas");
      out.width = 256; out.height = 256;
      const ratio = 256 / PREVIEW;
      const outCtx = out.getContext("2d");
      outCtx.fillStyle = "#ffffff";
      outCtx.fillRect(0, 0, 256, 256);
      outCtx.drawImage(img, offX * ratio, offY * ratio, imgW * scale * ratio, imgH * scale * ratio);
      const result = out.toDataURL("image/jpeg", 0.88);
      modal.remove();
      resolve(result);
    });
  });
}
window.abrirEditorAvatar = abrirEditorAvatar;

async function guardarDisplayName(value) {
  const nombre = (value || "").trim();
  try {
    await fetch(`${API_BASE}/api/auth/display-name`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ display_name: nombre })
    });
    currentUser.display_name = nombre;
    currentUser.name = nombre || currentUser.email;
    // Actualizar nombre en el header
    const nameEl = document.querySelector(".user-name");
    if (nameEl) nameEl.textContent = currentUser.name;
  } catch {}
}
window.guardarDisplayName = guardarDisplayName;

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
      if (msg) { msg.style.color="#22c55e"; msg.textContent="Contraseña actualizada correctamente."; }
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
    else { if (msg) { msg.style.color="#22c55e"; msg.textContent="Datos de facturación actualizados."; } }
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
        <input type="password" id="cancel-pass" placeholder="Tu contraseña" style="width:100%;padding:9px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;box-sizing:border-box;margin-bottom:8px;">
        <div id="cancel-msg" style="font-size:12px;color:#dc2626;min-height:16px;margin-bottom:14px;"></div>
        <div style="display:flex;gap:10px;">
          <button onclick="confirmCancelAccount()" style="flex:1;padding:9px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Sí, cancelar mi cuenta</button>
          <button onclick="document.getElementById('cancel-overlay').remove()" style="flex:1;padding:9px;background:#e5e7eb;color:#e5e7eb;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Volver</button>
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

  // Leer tiendas seleccionadas por checkbox del panel de filtro
  const checkboxes = document.querySelectorAll("#met-shop-filter-panel input[type='checkbox'][value]");
  let dominiosFiltro = [];
  if (checkboxes.length > 0) {
    dominiosFiltro = [...checkboxes].filter(c => c.checked).map(c => c.value);
    // Si están todas marcadas, no filtrar (mostrar todas)
    if (dominiosFiltro.length === checkboxes.length) dominiosFiltro = [];
  }

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  try {
    const h = { Authorization: "Bearer " + getActiveToken() };

    // Llamada al nuevo endpoint de stats — toda la lógica queda en el servidor
    const statsParams = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (dominiosFiltro.length > 0) statsParams.set("shops", dominiosFiltro.join(","));
    const statsRes = await fetch(`${API_BASE}/api/metrics/stats?${statsParams}`, { headers: h });
    const stats = await statsRes.json();

    const total          = stats.total          || 0;
    const pendientes     = stats.pendientes      || 0;
    const transito       = stats.en_transito     || 0;
    const entregados     = stats.entregados      || 0;
    const devueltos      = stats.devueltos       || 0;
    const destruidos     = stats.destruidos      || 0;
    const enviados       = stats.enviados        || 0;
    const sinCancelados  = stats.pedidos_activos || 0;
    const rojos          = devueltos + destruidos;
    const facturacion    = parseFloat(stats.facturacion || 0);

    set("stat-total",           total);
    set("stat-sin-cancelados",  sinCancelados);
    set("stat-enviados",        enviados);
    set("stat-pendientes",      pendientes);
    set("stat-transito",        transito);
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
    pedTienda.filter(o=>!["devuelto","cancelado"].includes(o.fulfillment_status)).forEach(o=>{
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
    const resColor = d.resultado >= 0 ? "#22c55e" : "#dc2626";
    const resBg    = d.resultado >= 0 ? "rgba(34,197,94,.08)" : "#fef2f2";
    const resBorder= d.resultado >= 0 ? "#86efac" : "#fecaca";
    return `
      <div style="background:var(--card);border:1px solid #374151;border-radius:12px;overflow:hidden;" data-domain="${d.domain}">
        <div style="background:#22c55e;padding:10px 14px;">
          <div style="font-weight:700;color:#fff;font-size:14px;">${escapeHtml(d.name)}</div>
          <div style="font-size:11px;color:#86efac;">${d.domain}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tbody>
            <tr style="background:rgba(34,197,94,.08);"><td colspan="2" style="padding:8px 14px;border:1px solid #374151;font-weight:700;color:#22c55e;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">📥 Ingresos</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">COD<div style="font-size:10px;color:#9ca3af;font-weight:400;">${d.numCOD} pedidos — ${fmt(d.brutoCOD)} € bruto</div><div style="font-size:10px;color:#dc2626;">Comisión MRW (${d.numCOD}×0.67€) = −${fmt(d.descCOD)}€</div></td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;color:#e5e7eb;font-weight:600;">${fmt(d.netoCOD)} €</td></tr>
            <tr style="background:#1f2937;"><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">TARJETA<div style="font-size:10px;color:#9ca3af;font-weight:400;">${d.numTarjeta} pedidos — ${fmt(d.brutoTarjeta)} € bruto</div><div style="font-size:10px;color:#dc2626;">Comisión tarjeta (4%) = −${fmt(d.descTarjeta)}€</div></td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;color:#e5e7eb;font-weight:600;">${fmt(d.netoTarjeta)} €</td></tr>
            ${d.man1val > 0 ? `<tr><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">${escapeHtml(d.man1nom||"Extra 1")}</td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;">${fmt(d.man1val)} €</td></tr>` : ""}
            ${d.man2val > 0 ? `<tr style="background:#1f2937;"><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">${escapeHtml(d.man2nom||"Extra 2")}</td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;">${fmt(d.man2val)} €</td></tr>` : ""}
            <tr style="background:rgba(34,197,94,.08);"><td style="padding:8px 14px;border:1px solid #86efac;font-weight:700;color:#22c55e;">Total Ingresos</td><td style="padding:8px 14px;border:1px solid #86efac;text-align:right;font-weight:700;color:#22c55e;">${fmt(d.totalIngreso)} €</td></tr>
            <tr style="background:rgba(239,68,68,.1);"><td colspan="2" style="padding:8px 14px;border:1px solid #374151;font-weight:700;color:#dc2626;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">📤 Gastos</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">Gasto Meta</td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(d.meta)} €</td></tr>
            <tr style="background:#1f2937;"><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">Gasto TikTok</td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(d.tiktok)} €</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">Productos<div style="font-size:10px;color:#9ca3af;">costo × uds × qty</div></td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(d.costoProductos)} €</td></tr>
            <tr style="background:#1f2937;"><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">MRW<div style="font-size:10px;color:#9ca3af;">${fmt(d.precioMRW)}€/ud × ${d.enviosMRW} envíos + ${d.devMRW} dev.</div></td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(d.mrw)} €</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">Logística<div style="font-size:10px;color:#9ca3af;">${fmt(d.precioLog)}€/ud × ${d.enviosMRW} envíos</div></td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(d.logistica)} €</td></tr>
            <tr style="background:#1f2937;"><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">Gastos Fijos<div style="font-size:10px;color:#9ca3af;">${fmt(d.totalOtrosFijos)}€ ÷ ${d.numTiendas} tiendas</div></td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(d.fijoXTienda)} €</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">Nómina<div style="font-size:10px;color:#9ca3af;">Total nómina ÷ ${d.numTiendas} tiendas</div></td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(d.nominaXTienda)} €</td></tr>
            <tr><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">Shopify</td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(d.shopify)} €</td></tr>
            ${(d.extras||[]).filter(g=>g.nombre||g.valor>0).map(g=>`<tr><td style="padding:8px 14px;border:1px solid #374151;color:#e5e7eb;font-weight:600;">${escapeHtml(g.nombre||'Concepto extra')}</td><td style="padding:8px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(g.valor)} €</td></tr>`).join("")}
            <tr style="background:#fefce8;"><td style="padding:8px 14px;border:1px solid #fef08a;color:#854d0e;font-weight:600;">IVA (${(d.ivaPorcentaje*100).toFixed(0)}%)<div style="font-size:10px;color:#a16207;">${d.numCOD + d.numTarjeta} pedidos entregados × ${(d.ivaPorcentaje*100).toFixed(0)}%</div></td><td style="padding:8px 14px;border:1px solid #fef08a;text-align:right;color:#854d0e;font-weight:600;">${fmt(d.ivaTotal)} €</td></tr>
             <tr style="background:rgba(239,68,68,.1);"><td style="padding:8px 14px;border:1px solid #fecaca;font-weight:700;color:#dc2626;">Total Gastos</td><td style="padding:8px 14px;border:1px solid #fecaca;text-align:right;font-weight:700;color:#dc2626;">− ${fmt(d.totalGasto)} €</td></tr>
            <tr style="background:${resBg};"><td style="padding:12px 14px;border:1px solid ${resBorder};font-weight:700;color:${resColor};font-size:14px;">RESULTADO</td><td style="padding:12px 14px;border:1px solid ${resBorder};text-align:right;font-weight:800;color:${resColor};font-size:16px;">${fmt(d.resultado)} €</td></tr>
          </tbody>
        </table>
      </div>`;       
  }).join("");

  const storeCheckboxes = balanceData.map(d =>
    `<label class="shop-check-label shop-check-row">
      <input type="checkbox" checked value="${d.domain}" onchange="recalcMetricasBalance()">
      ${escapeHtml(d.name)}
    </label>`
  ).join("");

  wrap.innerHTML = `
    <div style="display:flex;gap:20px;align-items:flex-start;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#e5e7eb;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">📊 Balance por tienda <span style="font-size:11px;font-weight:400;color:#6b7280;font-style:italic;">(Esto es un estimado basado en el rango de fecha seleccionado y los precios Unt de MRW y Logística, tu balance final por mes lo puedes ver en Ingresos - Balance Final)</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;" id="met-bal-cols">${cols}</div>
        <div id="met-bal-sumatoria" style="margin-top:20px;padding:16px 20px;background:rgba(34,197,94,.08);border:2px solid #22c55e;border-radius:12px;">
          <div style="font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Sumatoria seleccionada</div>
          <div id="met-bal-filas" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;"></div>
          <div style="border-top:2px solid #22c55e;padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:15px;color:#e5e7eb;">TOTAL</span>
            <span id="met-bal-total" style="font-weight:800;font-size:22px;"></span>
          </div>
        </div>
      </div>
       <div style="width:200px;flex-shrink:0;background:var(--card);border:1px solid #374151;border-radius:12px;padding:14px;position:sticky;top:0px;align-self:flex-start;">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Filtrar tiendas</div>
        <label class="shop-check-label all">
          <input type="checkbox" id="met-bal-check-all" checked onchange="toggleAllMetricasBalance(this.checked)">
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
  if (filasEl) filasEl.innerHTML = filtradas.map(d => `<div style="background:#111827;border:1px solid #374151;border-radius:8px;padding:8px 14px;font-size:12px;min-width:140px;"><div style="color:#6b7280;font-weight:600;margin-bottom:4px;">${escapeHtml(d.name)}</div><div style="font-size:11px;color:#9ca3af;">Ingreso: <span style="color:#22c55e;font-weight:600;">${fmt(d.totalIngreso)} €</span></div><div style="font-size:11px;color:#9ca3af;">Gasto: <span style="color:#dc2626;font-weight:600;">${fmt(d.totalGasto)} €</span></div><div style="font-size:13px;font-weight:700;color:${d.resultado>=0?'#22c55e':'#dc2626'};margin-top:4px;border-top:1px solid #f3f4f6;padding-top:4px;">${fmt(d.resultado)} €</div></div>`).join("");
  if (totalEl) { totalEl.textContent = fmt(total) + " €"; totalEl.style.color = total>=0?"#22c55e":"#dc2626"; }
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

// =========================
// GRÁFICA PEDIDOS POR TIENDA
// =========================
const CHART_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#ef4444','#84cc16','#f97316','#14b8a6'];

function toMadridPart(date, part) {
  return parseInt(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', [part]: 'numeric' }).format(date));
}

async function loadOrdersChart(period) {
  const canvas    = document.getElementById('orders-bar-chart');
  const legendEl  = document.getElementById('chart-legend');
  const labelEl   = document.getElementById('chart-period-label');
  if (!canvas) return;

  const h   = { Authorization: 'Bearer ' + getActiveToken() };
  const now = new Date();
  const MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  let from, to, buckets, bucketFn, bucketLabel;

  let periodText = '';
  if (period === 'day') {
    const y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,'0'), d = String(now.getDate()).padStart(2,'0');
    from = to = `${y}-${m}-${d}`;
    buckets    = Array.from({length:24}, (_,i) => i);
    bucketFn   = o => toMadridPart(new Date(o.created_at), 'hour');
    bucketLabel = h => `${String(h).padStart(2,'0')}h`;
    periodText  = `Hoy — ${d}/${m}/${y}`;
  } else if (period === 'month') {
    const y = now.getFullYear(), mo = now.getMonth();
    const dim = new Date(y, mo+1, 0).getDate();
    from = `${y}-${String(mo+1).padStart(2,'0')}-01`;
    to   = `${y}-${String(mo+1).padStart(2,'0')}-${String(dim).padStart(2,'0')}`;
    buckets    = Array.from({length:dim}, (_,i) => i+1);
    bucketFn   = o => toMadridPart(new Date(o.created_at), 'day');
    bucketLabel = d => d;
    periodText  = `${MESES_FULL[mo]} ${y}`;
  } else {
    const y = now.getFullYear();
    from = `${y}-01-01`;
    to   = `${y}-12-31`;
    buckets    = Array.from({length:12}, (_,i) => i);
    bucketFn   = o => toMadridPart(new Date(o.created_at), 'month') - 1;
    bucketLabel = i => MES[i];
    periodText  = `Año ${y}`;
  }
  if (labelEl) labelEl.textContent = periodText;

  try {
    const [rows, storesRes] = await Promise.all([
      fetch(`${API_BASE}/api/orders?from=${from}&to=${to}&light=1&limit=5000`, {headers:h}).then(r=>r.json()),
      fetch(`${API_BASE}/api/shopify/stores`, {headers:h}).then(r=>r.json()).catch(()=>[]),
    ]);
    const orders = (Array.isArray(rows) ? rows : (rows.orders||[])).filter(o => o.fulfillment_status !== 'cancelado' && o.created_at);

    // Mapa dominio → nombre asignado por el usuario
    const storeNameMap = {};
    (Array.isArray(storesRes) ? storesRes : (storesRes.stores||[])).forEach(s => {
      if (s.domain) storeNameMap[s.domain] = s.shop_name || s.domain;
    });

    // Tiendas únicas
    const storeDomains = {};
    orders.forEach(o => { if (o.shop_domain) storeDomains[o.shop_domain] = true; });
    const stores = Object.keys(storeDomains).sort();

    // Acumular datos: data[store][bucket] = count
    const data = {};
    stores.forEach(s => { data[s] = {}; buckets.forEach(b => data[s][b] = 0); });
    orders.forEach(o => {
      if (!o.shop_domain || !data[o.shop_domain]) return;
      const b = bucketFn(o);
      if (data[o.shop_domain][b] !== undefined) data[o.shop_domain][b]++;
    });

    renderBarChart(canvas, data, buckets, stores, bucketLabel);

    // Total global visible en el subtítulo
    if (labelEl) {
      labelEl.innerHTML = `${escapeHtml(periodText)} <span style="color:#22c55e;font-weight:700;">· ${orders.length} pedidos</span>`;
    }

    if (legendEl) {
      const isDark = document.body.classList.contains('dark');
      const displayName = domain => storeNameMap[domain] || domain.replace(/\.myshopify\.com$/i,'').replace(/\.[^.]+\.[^.]+$/,'').toUpperCase();
      const totalPorTienda = stores.map(s => ({ domain: s, name: displayName(s), total: buckets.reduce((a,b) => a + ((data[s]||{})[b]||0), 0) }));
      legendEl.innerHTML = totalPorTienda.map(({name,total},i) => {
        const color = (STORE_PALETTE[i % STORE_PALETTE.length])[isDark ? 'dark' : 'light'];
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--input);border-radius:8px;">
          <span style="width:10px;height:10px;border-radius:3px;background:${color};flex-shrink:0;"></span>
          <span style="font-size:13px;font-weight:600;color:var(--text);letter-spacing:.3px;">${escapeHtml(name)}</span>
          <span style="font-size:13px;font-weight:700;color:${color};margin-left:auto;">${total}</span>
        </div>`;
      }).join('');
    }
  } catch(e) { console.error('[CHART]', e); }
}

// Paleta: [light-color, dark-color] por tienda — coincide con colores de las tarjetas de métricas
const STORE_PALETTE = [
  { light:'#3b82f6', dark:'#93c5fd' },  // azul
  { light:'#22c55e', dark:'#4ade80' },  // verde
  { light:'#f97316', dark:'#fdba74' },  // naranja
  { light:'#ef4444', dark:'#fca5a5' },  // rojo
  { light:'#8b5cf6', dark:'#c4b5fd' },  // morado
  { light:'#06b6d4', dark:'#67e8f9' },  // cyan
  { light:'#ec4899', dark:'#f9a8d4' },  // rosa
  { light:'#eab308', dark:'#fde047' },  // amarillo
];

// Convierte hex (#rrggbb) a "r,g,b" para usar en rgba()
function hexToRgb(hex) {
  const h = hex.replace('#','');
  const n = parseInt(h, 16);
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
}

function renderBarChart(canvas, data, buckets, stores, labelFn) {
  const isDark   = document.body.classList.contains('dark');
  const gridCol  = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
  const axisCol  = isDark ? 'rgba(255,255,255,.1)'  : 'rgba(0,0,0,.08)';
  const labelCol = isDark ? '#6b7280' : '#9ca3af';
  const numCol   = isDark ? '#f9fafb' : '#111827';

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.parentElement.clientWidth || 400;
  const H   = 240;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const PL = 10, PR = 10, PT = 30, PB = 28;
  const cW = W - PL - PR;
  const cH = H - PT - PB;

  // Para stacked: el max es la suma de todas las tiendas por bucket
  let maxTotal = 0;
  buckets.forEach(b => {
    const t = stores.reduce((a, s) => a + ((data[s]||{})[b]||0), 0);
    if (t > maxTotal) maxTotal = t;
  });
  const nicMax = Math.max(1, Math.ceil((maxTotal || 1) * 1.3));

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  for (let i = 1; i <= 3; i++) {
    const y = PT + cH - (i / 3) * cH;
    ctx.beginPath();
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 0.5;
    ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y);
    ctx.stroke();
  }

  // Eje X
  ctx.beginPath();
  ctx.strokeStyle = axisCol;
  ctx.lineWidth = 1;
  ctx.moveTo(PL, PT + cH); ctx.lineTo(PL + cW, PT + cH);
  ctx.stroke();

  // Barras apiladas — 1 barra por bucket, mucho más anchas
  const groupW  = cW / buckets.length;
  const padding = Math.max(1.5, groupW * 0.15);
  const bw      = Math.max(6, groupW - padding * 2);
  const skipX   = Math.ceil(buckets.length / (W > 500 ? 18 : 9));

  ctx.textAlign = 'center';

  buckets.forEach((bucket, bi) => {
    const gx    = PL + bi * groupW + padding;
    const cx    = gx + bw / 2;
    const total = stores.reduce((acc, s) => acc + ((data[s]||{})[bucket]||0), 0);

    // Etiqueta X
    if (bi % skipX === 0) {
      ctx.fillStyle = labelCol;
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(labelFn(bucket), cx, H - 7);
    }

    if (total === 0) return;

    const totalBarH = (total / nicMax) * cH;
    const topY = PT + cH - totalBarH;
    const r    = Math.min(5, bw / 2);

    // Índice del segmento más alto
    let topIdx = -1;
    for (let si = stores.length - 1; si >= 0; si--) {
      if (((data[stores[si]]||{})[bucket]||0) > 0) { topIdx = si; break; }
    }
    const topColor = (STORE_PALETTE[topIdx % STORE_PALETTE.length])[isDark ? 'dark' : 'light'];
    const topRgb   = hexToRgb(topColor);

    // Dibujar segmentos apilados — cuerpo oscuro/translúcido
    let yOffset = PT + cH;
    stores.forEach((store, si) => {
      const val  = (data[store]||{})[bucket] || 0;
      if (val === 0) return;
      const segH  = (val / nicMax) * cH;
      const y     = yOffset - segH;
      const isTop = si === topIdx;
      const segR  = isTop ? Math.min(5, bw / 2, segH) : 0;
      const color = (STORE_PALETTE[si % STORE_PALETTE.length])[isDark ? 'dark' : 'light'];
      const rgb   = hexToRgb(color);

      // Cuerpo: muy oscuro con tinte del color
      ctx.fillStyle = isDark
        ? `rgba(${rgb}, 0.13)`
        : `rgba(${rgb}, 0.14)`;
      ctx.beginPath();
      if (isTop && ctx.roundRect) ctx.roundRect(gx, y, bw, segH, [segR, segR, 0, 0]);
      else ctx.rect(gx, y, bw, segH);
      ctx.fill();

      // Borde lateral sutil
      ctx.strokeStyle = isDark
        ? `rgba(${rgb}, 0.28)`
        : `rgba(${rgb}, 0.30)`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      if (isTop && ctx.roundRect) ctx.roundRect(gx, y, bw, segH, [segR, segR, 0, 0]);
      else ctx.rect(gx, y, bw, segH);
      ctx.stroke();

      // Separador entre segmentos
      if (!isTop) {
        ctx.beginPath();
        ctx.strokeStyle = isDark ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.6)';
        ctx.lineWidth = 1;
        ctx.moveTo(gx, y + segH); ctx.lineTo(gx + bw, y + segH);
        ctx.stroke();
      }

      yOffset -= segH;
    });

    // Línea brillante con glow en el tope (estilo segunda foto)
    ctx.save();
    ctx.shadowColor  = `rgba(${topRgb}, ${isDark ? 0.85 : 0.55})`;
    ctx.shadowBlur   = isDark ? 10 : 6;
    ctx.strokeStyle  = isDark
      ? `rgba(${topRgb}, 1)`
      : `rgba(${topRgb}, 0.85)`;
    ctx.lineWidth = isDark ? 2 : 1.8;
    ctx.beginPath();
    ctx.moveTo(gx + r, topY + 1);
    ctx.lineTo(gx + bw - r, topY + 1);
    ctx.stroke();
    ctx.restore();

    // Número total encima
    ctx.fillStyle = numCol;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(total, cx, topY - 6);
  });
}

window.setChartPeriod = function(period) {
  window.__chartPeriod = period;
  ['day','month','year'].forEach(p => {
    const btn = document.getElementById(`chart-btn-${p}`);
    if (btn) btn.classList.toggle('active', p === period);
  });
  loadOrdersChart(period);
};
window.loadOrdersChart = loadOrdersChart;

// =========================
// RENTABILIDAD BALANCE
// =========================
async function loadRentabilidadBalance(dateFrom, dateTo) {
  const wrap = document.getElementById("rent-balance-wrap");
  if (!wrap) return;
  window.__showLoadingBar?.("Cargando rentabilidad...");

  const fmt = n => (parseFloat(n)||0).toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const MRW_COMISION = 0.67;
  const TARJETA_PCT  = 0.04;

  let stores = [], orders = [], manuales = [];
  const facturacionPorTienda = {};
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
    // Facturación exacta por tienda (mismo cálculo que Gastos Ads: bruto - cancelados por cancelled_at)
    await Promise.all(stores.map(async store => {
      try {
        const p = new URLSearchParams({ shops: store.domain });
        if (dateFrom) p.set("from", dateFrom);
        if (dateTo)   p.set("to",   dateTo);
        const s = await fetch(`${API_BASE}/api/metrics/stats?${p}`, { headers: h }).then(r => r.json());
        facturacionPorTienda[store.domain] = parseFloat(s.facturacion || 0);
      } catch {}
    }));
  } catch {}

  const ordersRango = orders;

  const now = new Date();
  const mesActual = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const mesFrom = dateFrom ? dateFrom.slice(0,7) : mesActual;

  try {
    const r = await fetch(`${API_BASE}/api/shopify/informes-ingresos?mes=${mesFrom}`, { headers: { Authorization: "Bearer " + getActiveToken() } });
    manuales = await r.json();
    if (!Array.isArray(manuales)) manuales = [];
  } catch {}

  const numTiendas = stores.length || 1;

  const mesesRango = [];
  const dStart = dateFrom ? new Date(dateFrom + "T00:00:00") : new Date();
  const dEnd   = dateTo   ? new Date(dateTo   + "T00:00:00") : new Date();
  let cur = new Date(dStart.getFullYear(), dStart.getMonth(), 1);
  while (cur <= dEnd) {
    mesesRango.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  if (mesesRango.length === 0) mesesRango.push(mesFrom);

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

  let gastosExtrasRent = {};
  await Promise.all(mesesRango.map(async mes => {
    try {
      const rows = await cachedFetch(`${API_BASE}/api/gastos-varios/extras?mes=${mes}`, { headers: h2 });
      if (Array.isArray(rows)) rows.forEach(r => {
        if (!gastosExtrasRent[r.shop_domain]) gastosExtrasRent[r.shop_domain] = [];
        gastosExtrasRent[r.shop_domain].push(r);
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

  let ivaPorcentaje = 0.21;
  try {
    const impData = await cachedFetch(`${API_BASE}/api/impuestos`, { headers: h2 });
    if (Array.isArray(impData) && impData.length > 0) {
      ivaPorcentaje = (impData[0].porcentaje !== null && impData[0].porcentaje !== undefined ? parseFloat(impData[0].porcentaje) : 21) / 100;
    }
  } catch {}

  let preciosGlobales = { precio_mrw: 0, precio_logistica: 0 };
  try { preciosGlobales = await cachedFetch(`${API_BASE}/api/shopify/precios-globales`, { headers: h2 }) || preciosGlobales; } catch {}

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
  const pedidosBase = ordersRango.filter(o => o.fulfillment_status !== "cancelado");
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
    const ESTADOS_COSTO_PROD = ["enviado","en_transito","en_preparacion","franquicia","entregado","destruido"];
    const _calcCosto = (orders) => {
      let c = 0;
      orders.forEach(o=>{ try { const raw=o.raw_json?(typeof o.raw_json==="string"?JSON.parse(o.raw_json):o.raw_json):null; if(!raw?.line_items)return; raw.line_items.forEach(item=>{ c+=(parseFloat(stockMap[String(item.product_id)])||0)*(parseInt(variantesMap[String(item.variant_id)])||1)*(parseInt(item.quantity)||1); }); } catch{} });
      return c;
    };
    const costoProductos  = _calcCosto(pedTienda.filter(o => ESTADOS_COSTO_PROD.includes(o.fulfillment_status)));
    const costoRecuperado = _calcCosto(pedTienda.filter(o => o.fulfillment_status === "devuelto"));
    const numDevueltosProd = pedTienda.filter(o => o.fulfillment_status === "devuelto").length;
    const envTienda = pedTienda.filter(o=>estadosEnvioMRW.includes(o.fulfillment_status));
    const devTienda = envTienda.filter(o=>o.fulfillment_status==="devuelto").length;
    const precioMRW      = preciosGlobales.precio_mrw      || 0;
    const precioLogistica = preciosGlobales.precio_logistica || 0;
    const mrw      = precioMRW      * (envTienda.length + devTienda);
    const logistica = precioLogistica * envTienda.length;
    const ivaTotal = pedEnt.reduce((s,o) => s + (parseFloat(o.total_price)||0) * ivaPorcentaje, 0);
    const extrasTotal = (gastosExtrasRent[store.domain]||[]).reduce((s,g)=>s+(parseFloat(g.valor)||0),0);
    const totalGasto = ads.meta + ads.tiktok + shopify + (costoProductos - costoRecuperado) + mrw + logistica + fijoXTienda + nominaXTienda + extrasTotal + ivaTotal;
    const resultado = totalIngreso - totalGasto;
    // Detalle de productos para modal — separa enviados/destruidos (coste) de devueltos (recuperado)
    const _prodMap = {};
    pedTienda.forEach(o => {
      const esDevuelto = o.fulfillment_status === "devuelto";
      if (!esDevuelto && !ESTADOS_COSTO_PROD.includes(o.fulfillment_status)) return;
      try {
        const raw=o.raw_json?(typeof o.raw_json==="string"?JSON.parse(o.raw_json):o.raw_json):null;
        if(!raw?.line_items)return;
        raw.line_items.forEach(item=>{
          const pid   = String(item.product_id);
          const vid   = String(item.variant_id || item.product_id);
          const costo = parseFloat(stockMap[pid])||0;
          const uds   = parseInt(variantesMap[vid])||1;
          const qty   = parseInt(item.quantity)||1;
          const varTitle = item.variant_title && item.variant_title !== 'Default Title' ? ` — ${item.variant_title}` : '';
          const nombre = (item.title||pid) + varTitle;
          if (!_prodMap[vid]) _prodMap[vid] = { nombre, costo, uds, totalQty:0, totalUds:0, total:0, devQty:0, devUds:0, devTotal:0, qtyDist:{}, devQtyDist:{} };
          if (esDevuelto) {
            _prodMap[vid].devQty   += qty;
            _prodMap[vid].devUds   += qty * uds;
            _prodMap[vid].devTotal += costo * uds * qty;
            _prodMap[vid].devQtyDist[qty] = (_prodMap[vid].devQtyDist[qty] || 0) + 1;
          } else {
            _prodMap[vid].totalQty += qty;
            _prodMap[vid].totalUds += qty * uds;
            _prodMap[vid].total    += costo * uds * qty;
            _prodMap[vid].qtyDist[qty] = (_prodMap[vid].qtyDist[qty] || 0) + 1;
          }
        });
      } catch{}
    });
    const productosDetalle = Object.values(_prodMap).sort((a,b)=>b.total-a.total);
    const facturacionBruta = facturacionPorTienda[store.domain] ?? pedTienda.reduce((s,o)=>s+(parseFloat(o.total_price)||0), 0);
    return {
      domain: store.domain, name: store.shop_name||store.domain, totalIngreso, totalGasto, resultado, ivaTotal, ivaPorcentaje, facturacionBruta,
      numCOD: pedCOD.length, brutoCOD: tCOD, descCOD: pedCOD.length*MRW_COMISION, netoCOD: tCOD - pedCOD.length*MRW_COMISION,
      numTarjeta: pedPag.length, brutoTarjeta: tPag, descTarjeta: tPag*TARJETA_PCT, netoTarjeta: tPag - tPag*TARJETA_PCT,
      man1nom: man1.nombre||"", man1val: parseFloat(man1.valor)||0,
      man2nom: man2.nombre||"", man2val: parseFloat(man2.valor)||0,
      meta: ads.meta, tiktok: ads.tiktok, costoProductos, costoRecuperado, numDevueltosProd, mrw, logistica, shopify,
      fijoXTienda, nominaXTienda, totalOtrosFijos, numTiendas,
      precioMRW, precioLog: precioLogistica,
      enviosMRW: envTienda.length, devMRW: devTienda,
      extras: gastosExtrasRent[store.domain] || [],
      productosDetalle
    };
  });

  window.__rentabilidadBalanceData = balanceData;

  window.__rentabilidadDesglose = {};
  const cols = balanceData.map(d => {
    const resColor = d.resultado >= 0 ? "#22c55e" : "#dc2626";
    const resBg    = d.resultado >= 0 ? "rgba(34,197,94,.08)" : "#fef2f2";
    const resBorder= d.resultado >= 0 ? "#86efac" : "#fecaca";
    const tr  = (label, sub, val, opts={}) =>
      `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:7px 12px;color:#e5e7eb;font-weight:${opts.bold?'700':'500'};font-size:12px;${opts.cursor?'cursor:pointer;':''}"
          ${opts.onclick ? `onclick="${opts.onclick}"` : ''}>
          ${label}${sub ? `<div style="font-size:10px;color:#9ca3af;font-weight:400;margin-top:1px;">${sub}</div>` : ''}
        </td>
        <td style="padding:7px 12px;text-align:right;font-size:12px;color:${opts.valColor||'#6b7280'};font-weight:${opts.bold?'700':'400'};white-space:nowrap;">${val}</td>
      </tr>`;
    // Desglose completo — se abre en modal
    window.__rentabilidadDesglose[d.domain] = `
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          <tr><td colspan="2" style="padding:5px 12px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #f3f4f6;">Ingresos</td></tr>
          ${tr('COD', `${d.numCOD} pedidos · ${fmt(d.brutoCOD)}€ bruto · <span style="color:#dc2626;">−${fmt(d.descCOD)}€ comisión</span>`, fmt(d.netoCOD)+' €', {valColor:'#374151'})}
          ${tr('Tarjeta', `${d.numTarjeta} pedidos · ${fmt(d.brutoTarjeta)}€ bruto · <span style="color:#dc2626;">−${fmt(d.descTarjeta)}€ comisión</span>`, fmt(d.netoTarjeta)+' €', {valColor:'#374151'})}
          ${d.man1val > 0 ? tr(escapeHtml(d.man1nom||'Extra 1'), '', fmt(d.man1val)+' €') : ''}
          ${d.man2val > 0 ? tr(escapeHtml(d.man2nom||'Extra 2'), '', fmt(d.man2val)+' €') : ''}
          ${tr('Total Ingresos', '', fmt(d.totalIngreso)+' €', {bold:true, valColor:'#374151'})}
          <tr><td colspan="2" style="padding:5px 12px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #f3f4f6;border-top:6px solid #f9fafb;">Gastos</td></tr>
          ${tr('Gasto Meta', '', fmt(d.meta)+' €')}
          ${tr('Gasto TikTok', '', fmt(d.tiktok)+' €')}
          ${tr('Productos <span style="font-size:10px;color:#3b82f6;">▶ ver detalle</span>', `${fmt(d.costoProductos)}€ bruto${d.costoRecuperado>0?` − ${fmt(d.costoRecuperado)}€ recuperado (${d.numDevueltosProd} dev.)`:''}`, fmt(d.costoProductos-(d.costoRecuperado||0))+' €', {cursor:true, onclick:`verDetalleProductosRent('${d.domain}')`})}
          ${tr('MRW', `${fmt(d.precioMRW)}€/ud × ${d.enviosMRW} envíos + ${d.devMRW} dev.`, fmt(d.mrw)+' €')}
          ${tr('Logística', `${fmt(d.precioLog)}€/ud × ${d.enviosMRW} envíos`, fmt(d.logistica)+' €')}
          ${tr('Gastos Fijos', `${fmt(d.totalOtrosFijos)}€ ÷ ${d.numTiendas} tiendas`, fmt(d.fijoXTienda)+' €')}
          ${tr('Nómina', `Total nómina ÷ ${d.numTiendas} tiendas`, fmt(d.nominaXTienda)+' €')}
          ${tr('Shopify', '', fmt(d.shopify)+' €')}
          ${(d.extras||[]).filter(g=>g.nombre||g.valor>0).map(g=>tr(escapeHtml(g.nombre||'Concepto extra'),'',fmt(g.valor)+' €')).join('')}
          ${tr(`IVA (${(d.ivaPorcentaje*100).toFixed(0)}%)`, `${d.numCOD+d.numTarjeta} pedidos entregados × ${(d.ivaPorcentaje*100).toFixed(0)}%`, fmt(d.ivaTotal)+' €')}
          ${tr('Total Gastos', '', '− '+fmt(d.totalGasto)+' €', {bold:true, valColor:'#374151'})}
          <tr style="background:${resBg};"><td style="padding:10px 12px;border-top:2px solid ${resBorder};font-weight:700;color:${resColor};font-size:13px;">RESULTADO</td><td style="padding:10px 12px;border-top:2px solid ${resBorder};text-align:right;font-weight:800;color:${resColor};font-size:15px;">${fmt(d.resultado)} €</td></tr>
        </tbody>
      </table>`;
    // Tarjeta compacta — vista principal
    return `
      <div style="background:var(--card);border:1px solid #374151;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;" data-domain="${d.domain}">
        <div style="font-weight:700;font-size:13px;color:#e5e7eb;">${escapeHtml(d.name)}</div>
        <div style="font-size:10px;color:#9ca3af;">${d.domain}</div>
        <div style="margin-top:6px;font-size:12px;display:flex;flex-direction:column;gap:3px;">
          <div>Ingreso: <span style="color:#22c55e;font-weight:600;">${fmt(d.totalIngreso)} €</span></div>
          <div>Gasto: <span style="color:#dc2626;font-weight:600;">${fmt(d.totalGasto)} €</span></div>
        </div>
        <div style="font-size:16px;font-weight:800;color:${resColor};border-top:1px solid #f3f4f6;padding-top:8px;margin-top:2px;">${fmt(d.resultado)} €</div>
        <button onclick="verDesgloseRentTienda('${d.domain}')" style="margin-top:4px;padding:6px 0;background:#1f2937;border:1px solid #374151;border-radius:6px;font-size:12px;font-weight:600;color:#e5e7eb;cursor:pointer;width:100%;">Ver desglose</button>
      </div>`;
  }).join("");

  const storeCheckboxes = balanceData.map(d =>
    `<label class="shop-check-label shop-check-row">
      <input type="checkbox" checked value="${d.domain}" onchange="recalcRentabilidadBalance()">
      ${escapeHtml(d.name)}
    </label>`
  ).join("");

  wrap.innerHTML = `
    <div style="display:flex;gap:20px;align-items:flex-start;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#e5e7eb;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">📊 Balance por tienda <span style="font-size:11px;font-weight:400;color:#6b7280;font-style:italic;">(Estimado basado en el rango de fecha seleccionado)</span></div>
        <div id="rent-bal-kpis" style="margin-bottom:20px;"></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;" id="rent-bal-cols">${cols}</div>
        <div id="rent-bal-sumatoria" style="margin-top:20px;padding:12px 20px;background:rgba(34,197,94,.08);border:2px solid #22c55e;border-radius:12px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;font-size:15px;color:#e5e7eb;">TOTAL</span>
          <span id="rent-bal-total" style="font-weight:800;font-size:22px;"></span>
          <div id="rent-bal-filas" style="display:none;"></div>
        </div>
      </div>
      <div style="width:200px;flex-shrink:0;background:var(--card);border:1px solid #374151;border-radius:12px;padding:14px;position:sticky;top:0px;align-self:flex-start;">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Filtrar tiendas</div>
        <label class="shop-check-label all">
          <input type="checkbox" id="rent-bal-check-all" checked onchange="toggleAllRentabilidadBalance(this.checked)">
          Todas las tiendas
        </label>
        ${storeCheckboxes}
      </div>
    </div>
  `;
  recalcRentabilidadBalance();
  window.__hideLoadingBar?.();
}
window.loadRentabilidadBalance = loadRentabilidadBalance;

function recalcRentabilidadBalance() {
  const data = window.__rentabilidadBalanceData || [];
  const checks = document.querySelectorAll("#rent-balance-wrap input[type='checkbox'][value]");
  const sel = new Set([...checks].filter(c=>c.checked).map(c=>c.value));
  const filtradas = data.filter(d=>sel.has(d.domain));
  const fmt = n => (parseFloat(n)||0).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});
  document.querySelectorAll("#rent-bal-cols > div[data-domain]").forEach(card => { card.style.display = sel.has(card.dataset.domain) ? "" : "none"; });
  const total = filtradas.reduce((s,d)=>s+d.resultado,0);
  const filasEl = document.getElementById("rent-bal-filas");
  const totalEl = document.getElementById("rent-bal-total");
  if (filasEl) filasEl.innerHTML = filtradas.map(d => `<div style="background:#111827;border:1px solid #374151;border-radius:8px;padding:8px 14px;font-size:12px;min-width:140px;"><div style="color:#6b7280;font-weight:600;margin-bottom:4px;">${escapeHtml(d.name)}</div><div style="font-size:11px;color:#9ca3af;">Ingreso: <span style="color:#22c55e;font-weight:600;">${fmt(d.totalIngreso)} €</span></div><div style="font-size:11px;color:#9ca3af;">Gasto: <span style="color:#dc2626;font-weight:600;">${fmt(d.totalGasto)} €</span></div><div style="font-size:13px;font-weight:700;color:${d.resultado>=0?'#22c55e':'#dc2626'};margin-top:4px;border-top:1px solid #f3f4f6;padding-top:4px;">${fmt(d.resultado)} €</div></div>`).join("");
  if (totalEl) { totalEl.textContent = fmt(total) + " €"; totalEl.style.color = total>=0?"#22c55e":"#dc2626"; }
  const allCheck = document.getElementById("rent-bal-check-all");
  if (allCheck) allCheck.checked = filtradas.length === data.length;
  renderRentKpis(filtradas);
}
window.recalcRentabilidadBalance = recalcRentabilidadBalance;

function renderRentKpis(filtradas) {
  const el = document.getElementById('rent-bal-kpis');
  if (!el) return;
  const fmt = n => (parseFloat(n)||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
  const sum = k => filtradas.reduce((s,d)=>s+(parseFloat(d[k])||0),0);

  const totalIngreso      = sum('totalIngreso');
  const resultado         = sum('resultado');
  const facturacionReal   = filtradas.reduce((s,d)=>s+(d.facturacionBruta||0), 0);
  const pctGanancia       = facturacionReal > 0 ? (resultado / facturacionReal * 100) : 0;
  const netoCOD           = sum('netoCOD');
  const netoTarjeta       = sum('netoTarjeta');
  const meta              = sum('meta');
  const tiktok            = sum('tiktok');
  const costoProductosNeto= filtradas.reduce((s,d)=>s+((d.costoProductos||0)-(d.costoRecuperado||0)),0);
  const fijoTotal         = sum('fijoXTienda');
  const nominaTotal       = sum('nominaXTienda');
  const shopifyTotal      = sum('shopify');
  const ivaTotal          = sum('ivaTotal');
  const mrwTotal          = sum('mrw');
  const logisticaTotal    = sum('logistica');

  const card = (label, value, sub='', color='var(--text,#111827)') =>
    `<div style="background:var(--card);border:1px solid #374151;border-radius:10px;padding:16px 18px;">
      <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">${label}</div>
      <div style="font-size:22px;font-weight:800;color:${color};line-height:1.1;">${value}</div>
      ${sub ? `<div style="font-size:11px;color:#6b7280;margin-top:5px;">${sub}</div>` : ''}
    </div>`;

  const section = (title, cards) =>
    `<div style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;color:#e5e7eb;text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px;padding-bottom:5px;border-bottom:2px solid #e5e7eb;">${title}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;">${cards.join('')}</div>
    </div>`;

  const pctColor = pctGanancia >= 0 ? '#22c55e' : '#dc2626';
  const resColor = resultado >= 0 ? '#22c55e' : '#dc2626';

  el.innerHTML =
    section('Facturación', [
      card('Facturación total', fmt(facturacionReal)+' €', 'Total bruto pedidos no cancelados'),
      card('% Ganancia', pctGanancia.toFixed(1)+'%', fmt(resultado)+' € resultado neto', pctColor),
    ]) +
    section('Ingresos', [
      card('Total ingresos', fmt(totalIngreso)+' €'),
      card('Ingresos COD', fmt(netoCOD)+' €'),
      card('Ingresos tarjeta', fmt(netoTarjeta)+' €'),
    ]) +
    section('Gastos publicidad', [
      card('Gasto Meta', fmt(meta)+' €'),
      card('Gasto TikTok', fmt(tiktok)+' €'),
    ]) +
    section('Gastos por tienda', [
      card('Productos', fmt(costoProductosNeto)+' €'),
      card('Gastos fijos', fmt(fijoTotal)+' €'),
      card('Nómina', fmt(nominaTotal)+' €'),
      card('Shopify', fmt(shopifyTotal)+' €'),
      card('Impuestos (IVA)', fmt(ivaTotal)+' €'),
    ]) +
    section('Gastos logística', [
      card('MRW', fmt(mrwTotal)+' €'),
      card('Logística', fmt(logisticaTotal)+' €'),
    ]);
}
window.renderRentKpis = renderRentKpis;

function toggleAllRentabilidadBalance(checked) {
  document.querySelectorAll("#rent-balance-wrap input[type='checkbox'][value]").forEach(c=>c.checked=checked);
  recalcRentabilidadBalance();
}
window.toggleAllRentabilidadBalance = toggleAllRentabilidadBalance;

function verDesgloseRentTienda(domain) {
  const data = window.__rentabilidadBalanceData || [];
  const d = data.find(x => x.domain === domain);
  if (!d) return;
  const detailHtml = (window.__rentabilidadDesglose || {})[domain] || '';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:3500;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `<div style="background:#111827;border-radius:12px;overflow:hidden;width:480px;max-width:96vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);">
    <div style="background:#22c55e;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-weight:700;color:#fff;font-size:14px;">${escapeHtml(d.name)}</div>
        <div style="font-size:11px;color:#86efac;">${d.domain}</div>
      </div>
      <button id="__desglose-tienda-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#fff;line-height:1;padding:4px;">✕</button>
    </div>
    ${detailHtml}
  </div>`;
  document.body.appendChild(overlay);
  document.getElementById('__desglose-tienda-close').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
window.verDesgloseRentTienda = verDesgloseRentTienda;

function verDetalleProductosRent(domain) {
  const data = window.__rentabilidadBalanceData || [];
  const d = data.find(x => x.domain === domain);
  if (!d) return;
  const fmt = n => (parseFloat(n)||0).toLocaleString('es-ES', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const prods = d.productosDetalle || [];
  const thStyle = 'padding:5px 8px;background:#1f2937;border:1px solid #374151;font-size:10px;font-weight:600;color:#6b7280;text-align:right;white-space:nowrap;';
  const thStyleL = thStyle.replace('text-align:right','text-align:center');
  const tdStyle = 'padding:5px 8px;border:1px solid #f3f4f6;font-size:12px;text-align:right;color:#e5e7eb;white-space:nowrap;';
  const mkDistTable = (dist, uds, costo, accent) => {
    const rows = Object.entries(dist).sort((a,b)=>parseInt(a[0])-parseInt(b[0])).map(([qty,peds]) => {
      const udsS = peds * parseInt(qty);
      const udsF = udsS * uds;
      const sub  = costo > 0 ? fmt(costo * uds * parseInt(qty) * peds) + ' €' : '—';
      return '<tr>'
        + '<td style="' + tdStyle + 'text-align:center;font-weight:600;color:' + accent + ';">' + peds + '</td>'
        + '<td style="' + tdStyle + '">' + qty + '</td>'
        + '<td style="' + tdStyle + '">' + udsS + '</td>'
        + '<td style="' + tdStyle + '">' + uds + '</td>'
        + '<td style="' + tdStyle + 'font-weight:600;">' + udsF + '</td>'
        + '<td style="' + tdStyle + 'color:' + accent + ';font-weight:600;">' + sub + '</td>'
        + '</tr>';
    });
    return '<table style="width:100%;border-collapse:collapse;margin-top:8px;">'
      + '<thead><tr>'
      + '<th style="' + thStyleL + '">Pedidos</th>'
      + '<th style="' + thStyle + '">Qty/pedido</th>'
      + '<th style="' + thStyle + '">Uds Shopify</th>'
      + '<th style="' + thStyle + '">Uds/venta</th>'
      + '<th style="' + thStyle + '">Uds físicas</th>'
      + '<th style="' + thStyle + '">Subtotal</th>'
      + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  };
  const cards = prods.length === 0
    ? '<div style="padding:24px;text-align:center;color:#9ca3af;">Sin datos de productos</div>'
    : prods.map((p, i) => {
        const totalPedidos = Object.values(p.qtyDist).reduce((s,v)=>s+v, 0);
        let html = '<div style="border:1px solid #374151;border-radius:8px;overflow:hidden;margin-bottom:10px;">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:12px 14px;background:#1f2937;border-bottom:1px solid #1f2937;">'
          +   '<div style="font-weight:700;font-size:13px;color:#111;flex:1;margin-right:12px;">' + escapeHtml(p.nombre) + '</div>'
          +   '<div style="font-weight:700;font-size:14px;color:#e5e7eb;white-space:nowrap;">' + fmt(p.total) + ' €</div>'
          + '</div>'
          + '<div style="padding:10px 14px;">'
          +   '<div style="font-size:11px;color:#6b7280;margin-bottom:6px;">'
          +     '<span style="background:#1f2937;border-radius:4px;padding:2px 6px;margin-right:6px;">Coste: ' + fmt(p.costo) + '€/ud</span>'
          +     '<span style="background:#1f2937;border-radius:4px;padding:2px 6px;margin-right:6px;">Uds/venta: ' + p.uds + '</span>'
          +     '<span style="background:#1f2937;border-radius:4px;padding:2px 6px;margin-right:6px;">' + totalPedidos + ' pedidos</span>'
          +     '<span style="background:#1f2937;border-radius:4px;padding:2px 6px;margin-right:6px;">' + p.totalUds + ' uds físicas</span>'
          +   '</div>'
          +   mkDistTable(p.qtyDist, p.uds, p.costo, '#374151')
          + '</div>';
        if (p.devQty > 0) {
          const totalDevPed = Object.values(p.devQtyDist).reduce((s,v)=>s+v, 0);
          html += '<div style="padding:10px 14px;background:rgba(34,197,94,.08);border-top:1px solid #86efac;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
            +   '<span style="font-weight:600;font-size:12px;color:#22c55e;">↩ Recuperado (devuelto)</span>'
            +   '<span style="font-weight:700;font-size:13px;color:#22c55e;">+' + fmt(p.devTotal) + ' €</span>'
            + '</div>'
            + '<div style="font-size:11px;color:#22c55e;margin-bottom:6px;">'
            +   '<span style="background:rgba(34,197,94,.12);border-radius:4px;padding:2px 6px;margin-right:6px;">' + totalDevPed + ' pedidos devueltos</span>'
            +   '<span style="background:rgba(34,197,94,.12);border-radius:4px;padding:2px 6px;">' + p.devUds + ' uds físicas recuperadas</span>'
            + '</div>'
            + mkDistTable(p.devQtyDist, p.uds, p.costo, '#22c55e')
            + '</div>';
        }
        html += '</div>';
        return html;
      }).join('');
  const overlay = document.createElement('div');
  overlay.id = '__prod-detail-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3500;display:flex;align-items:center;justify-content:center;';
  const neto = d.costoProductos - (d.costoRecuperado||0);
  overlay.innerHTML = '<div style="background:#111827;border-radius:12px;padding:24px;width:700px;max-width:96vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.25);">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    +   '<div>'
    +     '<div style="font-weight:700;font-size:15px;color:#111;">📦 Desglose de Productos</div>'
    +     '<div style="font-size:12px;color:#6b7280;margin-top:2px;">' + escapeHtml(d.name) + ' — coste neto: <strong>' + fmt(neto) + ' €</strong></div>'
    +   '</div>'
    +   '<button id="__prod-detail-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#6b7280;line-height:1;padding:4px;">✕</button>'
    + '</div>'
    + '<div>' + cards + '</div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:rgba(34,197,94,.08);border-radius:8px;margin-top:4px;">'
    +   '<span style="font-weight:700;color:#22c55e;font-size:14px;">TOTAL PRODUCTOS</span>'
    +   '<span style="font-weight:800;color:#22c55e;font-size:16px;">' + fmt(neto) + ' €</span>'
    + '</div>'
    + '</div>';
  document.body.appendChild(overlay);
  document.getElementById('__prod-detail-close').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
window.verDetalleProductosRent = verDetalleProductosRent;

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

    const total         = stats.total          || 0;
    const pendientes    = stats.pendientes      || 0;
    const transito      = stats.en_transito     || 0;
    const entregados    = stats.entregados      || 0;
    const devueltos     = stats.devueltos       || 0;
    const destruidos    = stats.destruidos      || 0;
    const enviados      = stats.enviados        || 0;
    const sinCancelados = stats.pedidos_activos || 0;
    const facturacion   = parseFloat(stats.facturacion || 0);
    const rojos         = devueltos + destruidos;
    const baseCalc      = enviados > 0 ? enviados : 1;
    const pctEntregado  = ((entregados / baseCalc) * 100).toFixed(2);
    const pctRojo       = ((rojos      / baseCalc) * 100).toFixed(2);
    const pctPendiente  = ((transito   / baseCalc) * 100).toFixed(2);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("stat-total",          total);
    set("stat-sin-cancelados", sinCancelados);
    set("stat-enviados",       enviados);
    set("stat-pendientes",     pendientes);
    set("stat-transito",       transito);
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

function renderProductoCard(p, stockInfo, variantesMap, shopDomain) {
  const pid = String(p.id);
  const stock = stockInfo.stock ?? 0;
  const stockMin = stockInfo.stock_minimo ?? 5;
  const stockBajo = stock <= stockMin;
  const stockNeg  = stock < 0;
  const stockBg   = stockNeg || stockBajo ? '#dc2626' : stock === 0 ? '#d97706' : '#16a34a';
  const stockCol  = '#fff';
  const stockBord = stockNeg || stockBajo ? '#b91c1c' : stock === 0 ? '#b45309' : '#15803d';
  const imgSection = p.image
    ? `<img src="${p.image}" style="width:100%;height:180px;object-fit:cover;display:block;">`
    : `<div style="width:100%;height:180px;background:var(--input);display:flex;align-items:center;justify-content:center;">
         <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--border)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
       </div>`;
  return `
  <div data-pid="${pid}" style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,.04);transition:box-shadow .15s;" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.1)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,.04)'">
    <div style="position:relative;">
      ${imgSection}
      <div style="position:absolute;top:8px;right:8px;padding:4px 10px;border-radius:7px;font-size:15px;font-weight:700;background:${stockBg};color:${stockCol};border:1.5px solid ${stockBord};backdrop-filter:blur(6px);">${stock}</div>
      ${stockBajo ? `<div style="position:absolute;top:8px;left:8px;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;background:rgba(239,68,68,.9);color:#fff;letter-spacing:.3px;">Bajo stock</div>` : ''}
    </div>
    <div style="padding:14px;flex:1;display:flex;flex-direction:column;gap:10px;">
      <div style="font-weight:600;font-size:13px;color:var(--text);line-height:1.35;min-height:36px;" class="producto-nombre">${escapeHtml(p.title)}</div>
      <div style="display:flex;align-items:center;gap:6px;background:var(--input);padding:6px 10px;border-radius:7px;border:1px solid var(--border);">
        <span style="font-size:11px;color:var(--muted);flex:1;">Costo compra</span>
        <input type="number" min="0" step="0.01" value="${stockInfo.costo_compra||''}" placeholder="0.00"
          style="width:58px;border:none;background:transparent;font-size:13px;text-align:right;font-family:inherit;color:var(--text);outline:none;font-weight:600;"
          onchange="guardarCostoCompra('${shopDomain}','${pid}',this.value)">
        <span style="font-size:11px;color:var(--muted);">€</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;">
        <div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Variantes</div>
        ${p.variants.map(v => {
          const vid = String(v.id);
          const uds = variantesMap[vid] || 1;
          return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border);">
            <span style="font-size:11px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</span>
            <span style="font-size:10px;color:var(--muted);">×</span>
            <input type="number" min="1" value="${uds}"
              style="width:42px;padding:2px 5px;border:1px solid var(--border);border-radius:5px;font-size:12px;text-align:center;font-family:inherit;background:var(--input);color:var(--text);outline:none;"
              onchange="guardarVarianteConfig('${shopDomain}','${vid}',this.value)">
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:auto;padding-top:10px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:7px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:11px;color:var(--muted);flex:1;">Stock mínimo</span>
          <input type="number" min="0" value="${stockMin}"
            style="width:50px;padding:3px 6px;border:1px solid var(--border);border-radius:5px;font-size:12px;text-align:center;font-family:inherit;background:var(--input);color:var(--text);outline:none;"
            onchange="guardarStockMinimo('${shopDomain}','${pid}',this.value)">
        </div>
        <div style="display:flex;gap:6px;">
          <button onclick="abrirHistoricoStock('${pid}','${escapeHtml(p.title)}',${stock},${stockInfo.group_id||'null'})"
            style="flex:1;padding:6px;background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.2);border-radius:7px;font-size:11px;color:#2563eb;font-weight:600;cursor:pointer;font-family:inherit;transition:background .1s;"
            onmouseover="this.style.background='rgba(37,99,235,.16)'" onmouseout="this.style.background='rgba(37,99,235,.08)'">Histórico</button>
          ${stockInfo.group_name ? `<div style="flex:1;padding:6px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:7px;font-size:11px;color:#16a34a;font-weight:600;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(stockInfo.group_name)}">${escapeHtml(stockInfo.group_name)}</div>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function renderProductoTable(shop, stockMap, variantesMap) {
  return `
  <div style="margin-bottom:36px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid var(--border);">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18"/><path d="M4.5 5h15l1.5 4"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 20v-5a2 2 0 0 1 4 0v5"/></svg>
      <span style="font-size:14px;font-weight:700;color:var(--text);">${escapeHtml(shop.shop_name)}</span>
      <span style="font-size:11px;color:var(--muted);background:var(--input);padding:2px 9px;border-radius:999px;border:1px solid var(--border);">${shop.products.length} productos</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px;">
      ${shop.products.map(p => {
        const pid = String(p.id);
        const stockInfo = stockMap[pid] || { stock: 0, stock_minimo: 5 };
        return renderProductoCard(p, stockInfo, variantesMap, shop.shop_domain);
      }).join('')}
    </div>
  </div>`;
}

async function loadProductos() {
  const wrap = document.getElementById("productos-wrap");
  if (!wrap) return;
  window.__showLoadingBar?.("Cargando productos...");

  invalidateCache("shopify/stock"); // stock siempre fresco (puede haber cambiado por sync)

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

    wrap.innerHTML = filtered.map(shop => renderProductoTable(shop, stockMap, variantesMap)).join("");

 // Si venimos de búsqueda con múltiples resultados, mostrarlos todos
    if (window.__pendingProductoIds?.length > 0) {
      const pids = new Set(window.__pendingProductoIds);
      window.__pendingProductoIds = null;
      const filtrados = (window.__allProductos || []).filter(p => pids.has(String(p.id)));
      if (filtrados.length > 0) {
        // Group by shop
        const byShop = {};
        filtrados.forEach(p => {
          const key = p.shop_domain;
          if (!byShop[key]) byShop[key] = { shop_name: p.shop_name, shop_domain: p.shop_domain, products: [] };
          byShop[key].products.push(p);
        });
        wrap.innerHTML = `
          <div style="margin-bottom:14px;display:flex;align-items:center;gap:10px;">
            <button onclick="loadProductos()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:var(--input);border:1px solid var(--border);border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;color:var(--text);">← Volver</button>
            <span style="font-size:13px;color:var(--muted);">${filtrados.length} resultado${filtrados.length!==1?'s':''} encontrado${filtrados.length!==1?'s':''}</span>
          </div>
          ${Object.values(byShop).map(shop => renderProductoTable(shop, stockMap, variantesMap)).join('')}`;
        return;
      }
    }

 // Si venimos de notificación o búsqueda, mostrar solo ese producto
    if (window.__pendingProductoId) {
      const pid = window.__pendingProductoId;
      window.__pendingProductoId = null;
      const productoFiltrado = window.__allProductos?.find(p => String(p.id) === pid);
      if (productoFiltrado) {
        const shopDom = productoFiltrado.shop_domain;
        const shopNom = productoFiltrado.shop_name;
        const p = productoFiltrado;
        const pid2 = String(p.id);
        const stockInfo = stockMap[pid2] || { stock: 0, stock_minimo: 5 };
        wrap.innerHTML = `
          <div style="margin-bottom:14px;display:flex;align-items:center;gap:10px;">
            <button onclick="loadProductos()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:var(--input);border:1px solid var(--border);border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;color:var(--text);">← Volver</button>
            <span style="font-size:13px;color:var(--muted);">Mostrando producto desde notificación</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid var(--border);">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18"/><path d="M4.5 5h15l1.5 4"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/></svg>
            <span style="font-size:14px;font-weight:700;color:var(--text);">${escapeHtml(shopNom)}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px;">
            ${renderProductoCard(p, stockInfo, variantesMap, shopDom)}
          </div>
        `;
        return;
      }
    }

  } catch(e) {
    wrap.innerHTML = `<div style="color:#dc2626;padding:16px;text-align:center;">Error cargando productos</div>`;
  }
  window.__hideLoadingBar?.();

  // Sincronizar movimientos de stock en segundo plano (mes actual)
  fetch(`${API_BASE}/api/shopify/sync-stock-movements`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
    body: JSON.stringify({})
  }).then(r => r.json()).then(d => {
    if (d.applied > 0) {
      invalidateCache("shopify/stock"); // forzar recarga del stock actualizado
      loadProductos();
    }
  }).catch(() => {});
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
  const td   = (content, extra="") => `<td style="padding:10px 14px;border:1px solid var(--border);font-size:15px;color:var(--text);${extra}">${content}</td>`;
  const th   = (content, extra="") => `<th style="padding:11px 14px;border:1px solid var(--border);font-weight:600;font-size:13px;${extra}">${content}</th>`;

  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:var(--input);">
          ${th("Día","text-align:left;color:var(--text);")}
          ${th("Gasto Meta","text-align:right;background:#1877f2;color:#fff;border-color:#1565c0;")}
          ${th("Gasto TikTok","text-align:right;background:#000;color:#fff;border-color:#333;")}
          ${th("Facturación","text-align:right;color:var(--text);")}
          ${th("Cantidad Pedidos","text-align:right;color:var(--text);")}
          ${th("CPA","text-align:right;color:var(--text);")}
          ${th("ROAS","text-align:right;color:var(--text);")}
        </tr>
        <tr style="background:#22c55e;">
          <td style="padding:13px 16px;font-weight:700;color:#fff;border:1px solid #16a34a;font-size:15px;">Balance del mes</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #16a34a;">${fmt(totalMeta)}</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #16a34a;">${fmt(totalTiktok)}</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #16a34a;">${fmt(totalFact)}</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #16a34a;">${totalPedidos}</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #16a34a;">${fmt(totalCPA)}</td>
          <td style="padding:13px 16px;text-align:right;font-weight:700;color:#fff;border:1px solid #16a34a;">${fmt2(totalROAS)}</td>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background=''">
            ${td(r.label, "color:var(--text);white-space:nowrap;")}
            <td style="padding:10px 14px;border:1px solid var(--border);font-size:15px;text-align:right;background:rgba(24,119,242,.06);">
              <input type="number" min="0" step="0.01" value="${r.meta||""}" placeholder="0.00"
                data-date="${r.dateStr}" data-shop="${shop}" data-type="meta"
                onchange="saveAdsSpend(this)" onpaste="pegarDesdeExcel(event,this)"
                style="width:80px;padding:4px 8px;border:1.5px solid rgba(24,119,242,.4);border-radius:6px;font-size:13px;text-align:right;font-family:inherit;background:var(--card);color:#1877f2;font-weight:600;outline:none;">
            </td>
            <td style="padding:10px 14px;border:1px solid var(--border);font-size:15px;text-align:right;background:rgba(254,44,85,.05);">
              <input type="number" min="0" step="0.01" value="${r.tiktok||""}" placeholder="0.00"
                data-date="${r.dateStr}" data-shop="${shop}" data-type="tiktok"
                onchange="saveAdsSpend(this)" onpaste="pegarDesdeExcel(event,this)"
                style="width:80px;padding:4px 8px;border:1.5px solid rgba(254,44,85,.4);border-radius:6px;font-size:13px;text-align:right;font-family:inherit;background:var(--card);color:#fe2c55;font-weight:600;outline:none;">
            </td>
            ${td(r.facturacion > 0 ? fmt(r.facturacion) : "0,00 €", "text-align:right;color:" + (r.facturacion > 0 ? "var(--text)" : "var(--muted)") + ";")}
            ${td(r.pedidos > 0 ? r.pedidos : "0", "text-align:right;color:" + (r.pedidos > 0 ? "var(--text)" : "var(--muted)") + ";")}
            ${td(fmt(r.cpa), "text-align:right;")}
            ${td(fmt2(r.roas), `text-align:right;font-weight:${r.roas!=null&&r.roas>=2?'700':'400'};color:${r.roas!=null&&r.roas>=2?'#16a34a':r.roas!=null&&r.roas<1?'#dc2626':'var(--text)'};`)}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  window.__hideLoadingBar?.();

  // ── Selección de celdas estilo Excel para copiar ──────────────────────────
  // Limpiar listener previo si se recarga la tabla
  if (wrap._adsKeydown) document.removeEventListener("keydown", wrap._adsKeydown);

  const table = wrap.querySelector("table");
  if (table) {
    let lastSelected = null;
    const tbodyRows = table.querySelectorAll("tbody tr");

    tbodyRows.forEach((tr, rowIdx) => {
      tr.querySelectorAll("td").forEach((cell, colIdx) => {
        cell.dataset.col = colIdx;
        cell.dataset.row = rowIdx;
        cell.style.cursor = "pointer";
        const input = cell.querySelector("input");

        cell.addEventListener("mousedown", function(e) {
          if (input && !e.ctrlKey && !e.metaKey && !e.shiftKey) return; // dejar input editable
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) return; // permitir selección nativa de texto
          e.preventDefault();
          const col = parseInt(this.dataset.col);
          const row = parseInt(this.dataset.row);

          if (e.shiftKey && lastSelected && lastSelected.col === col) {
            const from = Math.min(lastSelected.row, row);
            const to   = Math.max(lastSelected.row, row);
            if (!e.ctrlKey && !e.metaKey) clearAdsSelection(table);
            tbodyRows.forEach((tr2, r) => {
              if (r >= from && r <= to) {
                const c = tr2.querySelectorAll("td")[col];
                if (c) c.classList.add("ads-sel");
              }
            });
          } else {
            if (!e.ctrlKey && !e.metaKey) clearAdsSelection(table);
            this.classList.toggle("ads-sel");
            lastSelected = { col, row };
          }
        });
      });
    });

    wrap._adsKeydown = function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        const selected = table.querySelectorAll("td.ads-sel");
        if (!selected.length) return;
        const byRow = {};
        selected.forEach(cell => {
          const r = cell.dataset.row;
          const c = cell.dataset.col;
          if (!byRow[r]) byRow[r] = {};
          const inp = cell.querySelector("input");
          const raw = inp ? (inp.value || "0") : cell.textContent.trim().replace(/\s*€/g,"").trim();
          byRow[r][c] = raw.replace(".", ","); // Excel español usa coma como decimal
        });
        const text = Object.keys(byRow).sort((a,b)=>a-b)
          .map(r => Object.keys(byRow[r]).sort((a,b)=>a-b).map(c => byRow[r][c]).join("\t"))
          .join("\n");
        // Copiar usando textarea (funciona en todos los browsers sin permisos)
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        // Flash verde para confirmar
        table.querySelectorAll("td.ads-sel").forEach(c => {
          c.style.outline = "2px solid #22c55e";
          setTimeout(() => { c.style.outline = ""; c.classList.remove("ads-sel"); }, 600);
        });
      }
      if (e.key === "Escape") clearAdsSelection(table);
    };
    document.addEventListener("keydown", wrap._adsKeydown);
  }
}

function clearAdsSelection(table) {
  table.querySelectorAll("td.ads-sel").forEach(c => c.classList.remove("ads-sel"));
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
        style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${monthNames.map((m,i)=>`<option value="${i+1}" ${i===now.getMonth()?"selected":""}>${m}</option>`).join("")}
      </select>
      <select id="gf-year-sel"
        style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${Array.from({length:27},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===now.getFullYear()?"selected":""}>${y}</option>`).join("")}
      </select>
      <button onclick="loadGastosFijosData()"
        style="padding:7px 16px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
        Ver
      </button>
      <button onclick="copiarMesAnteriorGF()"
        style="padding:7px 16px;background:rgba(34,197,94,.08);color:#22c55e;border:1px solid #86efac;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
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
  const inp = `width:100%;padding:6px 8px;border:1px solid #374151;border-radius:6px;font-size:13px;font-family:inherit;background:var(--card);color:var(--text);box-sizing:border-box;`;
  const totalValor = items.reduce((s,i) => s+(parseFloat(i.valor)||0), 0);
  const thStyle = `padding:11px 14px;border:1px solid #d1fae5;font-weight:600;color:#fff;text-align:`;

  const tablaGF = `
    <div style="background:var(--card);border:1px solid #374151;border-radius:12px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#22c55e;">
            <th style="${thStyle}left;">GASTO FIJO</th>
            <th style="${thStyle}right;">VALOR MES</th>
            <th style="${thStyle}right;">P. UNIT</th>
            <th style="${thStyle}right;">ESTIMADO</th>
            <th style="${thStyle}center;width:36px;"></th>
          </tr>
          <tr style="background:rgba(34,197,94,.08);">
            <td style="padding:10px 14px;border:1px solid #374151;font-weight:700;color:#22c55e;">TOTAL</td>
            <td style="padding:10px 14px;border:1px solid #374151;font-weight:700;color:#22c55e;text-align:right;">${fmt(totalValor)} €</td>
            <td style="padding:10px 14px;border:1px solid #374151;"></td>
            <td style="padding:10px 14px;border:1px solid #374151;font-weight:700;color:#22c55e;text-align:right;">— €</td>
            <td style="padding:10px 14px;border:1px solid #374151;"></td>
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
              <td style="padding:7px 12px;border:1px solid #374151;">
                ${esFijo
                  ? `<span style="font-weight:600;color:var(--text);">${item.nombre}</span>`
                  : `<input type="text" value="${escapeHtml(item.nombre||'')}" placeholder="Descripción..."
                      data-id="${item.id}" data-field="nombre" onchange="updateGastoFijo(this)"
                      style="${inp}">`
                }
              </td>
              <td style="padding:7px 12px;border:1px solid #374151;">
                <input type="number" min="0" step="0.01" value="${fmt(item.valor)}"
                  data-id="${item.id}" data-field="valor" data-mes="${mes}"
                  onchange="updateGastoFijoValor(this)"
                  onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();this.style.borderColor='#22c55e';setTimeout(()=>{this.style.borderColor='#e5e7eb'},1500);this.dispatchEvent(new Event('change'));}"
                  style="${inp}text-align:right;">
              </td>
              <td style="padding:7px 12px;border:1px solid #374151;">
                ${esFijo
                  ? `<input type="number" min="0" step="0.01" value="${fmt(item.precio_unit)}"
                      data-id="${item.id}" data-field="precio_unit" data-mes="${mes}"
                      onchange="updateGastoFijoPrecio(this)"
                      onkeydown="if(event.key==='Enter'){event.preventDefault();this.dispatchEvent(new Event('change'));}"
                      style="${inp}text-align:right;">`
                  : `<span style="color:#d1d5db;display:block;text-align:center;">—</span>`
                }
              </td>
              <td style="padding:7px 12px;border:1px solid #374151;text-align:right;color:#6b7280;">
                ${estimado!=null ? fmt(estimado)+" €" : "—"}
              </td>
              <td style="padding:7px 12px;border:1px solid #374151;text-align:center;">
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
          style="padding:7px 16px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
          + Añadir fila
        </button>
      </div>
    </div>
  `;

  const tablaIMP = `
    <div style="background:var(--card);border:1px solid #374151;border-radius:12px;overflow:hidden;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#22c55e;">
            <th style="${thStyle}left;">IMPUESTO</th>
            <th style="${thStyle}right;">%</th>
          </tr>
        </thead>
        <tbody>
          ${impuestos.map(imp => `
          <tr onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
            <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;">IVA</td>
            <td style="padding:10px 14px;border:1px solid #374151;text-align:right;">
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
    <div style="background:var(--card);border:1px solid #374151;border-radius:12px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#22c55e;">
            <th style="${thStyle}left;">PRECIO UNIT. ENVÍO</th>
            <th style="${thStyle}right;">€</th>
          </tr>
        </thead>
        <tbody>
          <tr onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
            <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;">MRW</td>
            <td style="padding:10px 14px;border:1px solid #374151;text-align:right;">
              <input type="number" min="0" step="0.01" value="${fmt(preciosGlobales.precio_mrw)}"
                id="precio-global-mrw"
                onchange="guardarPreciosGlobales()"
                onkeydown="if(event.key==='Enter'){event.preventDefault();this.dispatchEvent(new Event('change'));}"
                style="${inp}text-align:right;">
            </td>
          </tr>
          <tr onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
            <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;">LOGÍSTICA</td>
            <td style="padding:10px 14px;border:1px solid #374151;text-align:right;">
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
    <div style="margin-bottom:16px;padding:10px 16px;background:rgba(34,197,94,.08);border:1px solid #86efac;border-radius:8px;font-size:13px;color:#22c55e;font-weight:600;">
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
    input.style.borderColor = "#22c55e";
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
    input.style.borderColor = "#22c55e";
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
    input.style.borderColor = "#22c55e";
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

async function pegarDesdeExcel(e, inputOrigen) {
  const text = (e.clipboardData || window.clipboardData).getData("text");
  // Si es un solo valor, comportamiento normal
  const lines = text.trim().split(/\r?\n/).map(l => l.trim().split(/\t/)[0].replace(",", ".")).filter(l => l !== "");
  if (lines.length <= 1) return;

  e.preventDefault();
  const tipo = inputOrigen.dataset.type;
  const todosLosInputs = [...document.querySelectorAll(`input[data-type="${tipo}"]`)];
  const idxOrigen = todosLosInputs.indexOf(inputOrigen);

  const promises = [];
  lines.forEach((val, i) => {
    const input = todosLosInputs[idxOrigen + i];
    if (!input) return;
    const num = parseFloat(val);
    if (isNaN(num)) return;
    input.value = num;
    promises.push(
      fetch(`${API_BASE}/api/ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
        body: JSON.stringify({ shop: input.dataset.shop, date: input.dataset.date, type: tipo, spend: num })
      }).catch(() => {})
    );
  });

  await Promise.all(promises);
  invalidateCache("ads");
  loadAdsTable();
}

window.loadAdsTable    = loadAdsTable;
window.saveAdsSpend    = saveAdsSpend;
window.pegarDesdeExcel = pegarDesdeExcel;

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
  const inp = `padding:6px 8px;border:1px solid #374151;border-radius:6px;font-size:13px;font-family:inherit;background:var(--card);color:var(--text);width:100%;box-sizing:border-box;text-align:right;`;

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

    const ESTADOS_COSTO_GV = ["enviado","en_transito","en_preparacion","franquicia","entregado","destruido"];
    let costoProductos = 0;
    pedidosTienda.filter(o => ESTADOS_COSTO_GV.includes(o.fulfillment_status)).forEach(o => {
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
    let costoRecuperadoGV = 0;
    let numDevGV = 0;
    pedidosTienda.filter(o => o.fulfillment_status === "devuelto").forEach(o => {
      try {
        const raw = o.raw_json ? (typeof o.raw_json === "string" ? JSON.parse(o.raw_json) : o.raw_json) : null;
        if (!raw?.line_items) return;
        numDevGV++;
        raw.line_items.forEach(item => {
          const costo = parseFloat(stockMap[String(item.product_id)] || 0);
          const uds = parseInt(variantesMap[String(item.variant_id)] || 1);
          const qty = parseInt(item.quantity || 1);
          costoRecuperadoGV += costo * uds * qty;
        });
      } catch {}
    });
    const costoProductosNeto = costoProductos - costoRecuperadoGV;

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
    const total = ads.meta + ads.tiktok + shopify + costoProductosNeto + mrw + logistica + fijoXTienda + nominaXTienda + extrasTotal + ivaTotal;
    if (!window.__gastosPorTienda) window.__gastosPorTienda = {};
    window.__gastosPorTienda[store.domain] = total;

    return `
      <div style="background:var(--card);border:1px solid #374151;border-radius:12px;overflow:hidden;min-width:220px;flex:1;">
        <div style="background:#22c55e;padding:12px 16px;">
          <div style="font-weight:700;color:#fff;font-size:14px;">${escapeHtml(store.shop_name||store.domain)}</div>
          <div style="font-size:11px;color:#86efac;margin-top:2px;">${store.domain}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tbody>
            <tr>
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;color:#e5e7eb;">Gasto Meta</td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(ads.meta)} €</td>
            </tr>
            <tr style="background:#1f2937;">
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;color:#e5e7eb;">Gasto TikTok</td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(ads.tiktok)} €</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;color:#e5e7eb;">Productos</td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(costoProductosNeto)} €
                <div style="font-size:10px;color:#9ca3af;">${fmt(costoProductos)}€ bruto${costoRecuperadoGV>0?` − ${fmt(costoRecuperadoGV)}€ recuperado (${numDevGV} dev.)`:''}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;color:#e5e7eb;">MRW</td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(mrw)} €
                <div style="font-size:10px;color:#9ca3af;">${fmt(totalMRW)}€ ÷ ${totalEnviosGlobales} envíos globales (${enviosTiendaMRW.length} salidas + ${devueltosTienda} dev. esta tienda)</div>
              </td>
            </tr>
            <tr style="background:#1f2937;">
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;color:#e5e7eb;">Logística</td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(logistica)} €
                <div style="font-size:10px;color:#9ca3af;">${fmt(totalLogistica)}€ ÷ ${totalPedidosGlobales} envíos × ${enviosTiendaMRW.length} esta tienda</div>
              </td>
            </tr>
            <tr>
              <tr>
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;color:#e5e7eb;">Gastos Fijos</td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(fijoXTienda)} €
                <div style="font-size:10px;color:#9ca3af;">${fmt(totalOtrosFijos)}€ ÷ ${numTiendas} tiendas</div>
              </td>
            </tr>
            <tr style="background:#1f2937;">
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;color:#e5e7eb;">Nómina</td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;color:#6b7280;">${fmt(nominaXTienda)} €
                <div style="font-size:10px;color:#9ca3af;">Total nómina ÷ ${numTiendas} tiendas</div>
              </td>
            </tr>
            <tr style="background:#fefce8;">
              <td style="padding:10px 14px;border:1px solid #fef08a;font-weight:600;color:#854d0e;">IVA (${(ivaPorcentaje*100).toFixed(0)}%)</td>
              <td style="padding:10px 14px;border:1px solid #fef08a;text-align:right;color:#854d0e;font-weight:600;">${fmt(ivaTotal)} €
                <div style="font-size:10px;color:#a16207;">${entregadosTienda.length} pedidos entregados × ${(ivaPorcentaje*100).toFixed(0)}%</div>
              </td>
            </tr>
            <tr style="background:rgba(59,130,246,.08);">
              <td style="padding:10px 14px;border:1px solid #bfdbfe;font-weight:700;color:#2563eb;">Shopify</td>
              <td style="padding:10px 14px;border:1px solid #bfdbfe;">
                <input type="number" min="0" step="0.01"
                  value="${fmt(shopify)}"
                  data-shop="${store.domain}" data-mes="${mes}"
                  onchange="saveGastoVarioShopify(this)"
                  onkeydown="if(event.key==='Enter'){event.preventDefault();this.dispatchEvent(new Event('change'));}"
                  style="${inp}background:rgba(59,130,246,.08);color:#2563eb;font-weight:600;">
              </td>
            </tr>
            ${(gastosExtras[store.domain]||[]).map((g) => `
            <tr style="background:rgba(59,130,246,.08);">
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
                  style="${inp}background:rgba(59,130,246,.08);color:#2563eb;font-weight:600;flex:1;">
                <button onclick="deleteGastoExtra(${g.id})"
                  style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:14px;font-weight:700;padding:0;flex-shrink:0;">✕</button>
              </td>
            </tr>`).join("")}
            <tr style="background:rgba(59,130,246,.08);">
              <td colspan="2" style="padding:6px 14px;border:1px solid #bfdbfe;">
                <button onclick="addGastoExtra('${store.domain}','${mes}')"
                  style="background:none;border:none;cursor:pointer;color:#2563eb;font-size:12px;font-weight:600;padding:0;font-family:inherit;">
                  + Añadir concepto
                </button>
              </td>
            </tr>
            <tr style="background:rgba(34,197,94,.08);">
              <td style="padding:11px 14px;border:1px solid #374151;font-weight:700;color:#22c55e;">TOTAL</td>
              <td style="padding:11px 14px;border:1px solid #374151;text-align:right;font-weight:700;color:#22c55e;">${fmt(total)} €</td>
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
      btn.style.background = "#22c55e"; btn.style.color = "#fff"; btn.style.borderColor = "#22c55e";
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
              <input type="text" id="ree-q" placeholder="Buscar pedido..." oninput="renderReembolsos()"
                style="padding:7px 10px;border:1px solid #374151;border-radius:8px;font-size:13px;font-family:inherit;color:#f9fafb;background:#1f2937;width:160px;"/>
              ${window.__DPF.triggerBtn('ree', 'Período')}
              <input type="date" id="ree-date-from" value="" style="display:none;">
              <input type="date" id="ree-date-to" value="" style="display:none;">
              <select id="ree-shop" onchange="renderReembolsos()"
                style="padding:7px 10px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
                <option value="">Todas las tiendas</option>
              </select>
              <button onclick="clearReembolsosFilters()" style="padding:7px 14px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.4);border-radius:8px;color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Limpiar</button>
              <label style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:rgba(34,197,94,.08);border:1px solid #22c55e;border-radius:8px;color:#22c55e;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">
                ✅ Importar Pagados
                <input type="file" accept=".pdf" multiple style="display:none;" onchange="importarPagadosPDF(this)">
              </label>
            </div>
          </div>
          <div style="border-bottom:1px solid #1f2937;margin-bottom:12px;"></div>
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
    window.__DPF.create('ree', '', '', 'personalizado', 'Período', null, null, function() { window.renderReembolsos(); });
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
        style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${monthNames.map((m,i)=>`<option value="${i+1}" ${i===now.getMonth()?"selected":""}>${m}</option>`).join("")}
      </select>
      <select id="inf-year-sel" onchange="renderInformesIngresos()"
        style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
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
  const inp = `padding:6px 8px;border:1px solid #374151;border-radius:6px;font-size:13px;font-family:inherit;background:var(--card);color:var(--text);width:100%;box-sizing:border-box;`;
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
      <div style="background:var(--card);border:1px solid #374151;border-radius:12px;overflow:hidden;">
        <div style="background:#22c55e;padding:10px 14px;">
          <div style="font-weight:700;color:#fff;font-size:14px;">${escapeHtml(store.shop_name||store.domain)}</div>
          <div style="font-size:11px;color:#86efac;">${store.domain}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tbody>
            <tr>
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;color:#e5e7eb;">
                COD
                <div style="font-size:10px;color:#9ca3af;font-weight:400;">${fmt(totalCOD)} € — ${pedidosCOD.length} pedidos</div>
                <div style="font-size:10px;color:#dc2626;">Comisión MRW (${pedidosCOD.length}×0.67€) = −${fmt(descCOD)}€</div>
              </td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;font-weight:600;color:#e5e7eb;">${fmt(netoCOD)} €</td>
            </tr>
            <tr style="background:#1f2937;">
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;color:#e5e7eb;">
                TARJETA
                <div style="font-size:10px;color:#9ca3af;font-weight:400;">${fmt(totalPagado)} € — ${pedidosPagado.length} pedidos</div>
                <div style="font-size:10px;color:#dc2626;">Comisión tarjeta (4%) = −${fmt(descPagado)}€</div>
              </td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;font-weight:600;color:#e5e7eb;">${fmt(netoPagado)} €</td>
            </tr>
            <tr style="background:rgba(59,130,246,.08);">
              <td style="padding:8px 14px;border:1px solid #bfdbfe;">
                <input type="text" value="${escapeHtml(man1.nombre||'')}" placeholder="Nombre ingreso extra 1..."
                  data-shop="${store.domain}" data-mes="${mes}" data-col="1" data-field="nombre"
                  onchange="guardarIngresoManual(this)"
                  style="${inp}background:rgba(59,130,246,.08);color:#2563eb;font-weight:600;margin-bottom:4px;">
              </td>
              <td style="padding:8px 14px;border:1px solid #bfdbfe;">
                <input type="number" min="0" step="0.01" value="${fmt(man1.valor)}" placeholder="0.00"
                  data-shop="${store.domain}" data-mes="${mes}" data-col="1" data-field="valor"
                  onchange="guardarIngresoManual(this)"
                  style="${inp}text-align:right;background:rgba(59,130,246,.08);color:#2563eb;font-weight:600;">
              </td>
            </tr>
            <tr style="background:rgba(59,130,246,.08);">
              <td style="padding:8px 14px;border:1px solid #bfdbfe;">
                <input type="text" value="${escapeHtml(man2.nombre||'')}" placeholder="Nombre ingreso extra 2..."
                  data-shop="${store.domain}" data-mes="${mes}" data-col="2" data-field="nombre"
                  onchange="guardarIngresoManual(this)"
                  style="${inp}background:rgba(59,130,246,.08);color:#2563eb;font-weight:600;margin-bottom:4px;">
              </td>
              <td style="padding:8px 14px;border:1px solid #bfdbfe;">
                <input type="number" min="0" step="0.01" value="${fmt(man2.valor)}" placeholder="0.00"
                  data-shop="${store.domain}" data-mes="${mes}" data-col="2" data-field="valor"
                  onchange="guardarIngresoManual(this)"
                  style="${inp}text-align:right;background:rgba(59,130,246,.08);color:#2563eb;font-weight:600;">
              </td>
            </tr>
            <tr style="background:rgba(34,197,94,.08);">
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:700;color:#22c55e;">TOTAL</td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;font-weight:700;color:#22c55e;">${fmt(totalTienda)} €</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join("");

  wrap.innerHTML = `
    <div style="margin-bottom:16px;padding:10px 16px;background:rgba(34,197,94,.08);border:1px solid #86efac;border-radius:8px;font-size:13px;color:#22c55e;font-weight:600;">
      📅 ${mesLabel} — ${totalPedidosEntregados} pedidos entregados — Total ingresos: ${fmt(grandTotal)} €
    </div>
    <div style="background:#111827;border:1px solid #374151;border-radius:12px;padding:20px;">
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
    const totalEl = wrap.querySelector("tr[style*='rgba(34,197,94,.08)'] td:last-child");
    if (totalEl) totalEl.textContent = totalTienda.toFixed(2) + " €";

    // Actualizar el gran total del banner
    const allCards = document.querySelectorAll("#inf-ingresos-wrap div[style*='border-radius:12px']");
    let grandTotal = 0;
    allCards.forEach(card => {
      const totEl = card.querySelector("tr[style*='rgba(34,197,94,.08)'] td:last-child");
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
        style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
        ${monthNames.map((m,i)=>`<option value="${i+1}" ${i===now.getMonth()?"selected":""}>${m}</option>`).join("")}
      </select>
      <select id="inf-bal-year-sel" onchange="renderInformesBalance()"
        style="padding:7px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;background:var(--card);color:var(--text);font-family:inherit;">
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
    const resColor = d.resultado >= 0 ? "#22c55e" : "#dc2626";
    const resBg    = d.resultado >= 0 ? "rgba(34,197,94,.08)" : "#fef2f2";
    const resBorder= d.resultado >= 0 ? "#86efac" : "#fecaca";
    return `
      <div style="background:var(--card);border:1px solid #374151;border-radius:12px;overflow:hidden;" data-domain="${d.domain}">
        <div style="background:#22c55e;padding:10px 14px;">
          <div style="font-weight:700;color:#fff;font-size:14px;">${escapeHtml(d.name)}</div>
          <div style="font-size:11px;color:#86efac;">${d.domain}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tbody>
            <tr>
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;color:#e5e7eb;">Total Ingreso</td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;font-weight:600;color:#22c55e;">${fmt(d.totalIngreso)} €</td>
            </tr>
            <tr style="background:rgba(239,68,68,.1);">
              <td style="padding:10px 14px;border:1px solid #374151;font-weight:600;color:#e5e7eb;">Total Gasto</td>
              <td style="padding:10px 14px;border:1px solid #374151;text-align:right;font-weight:600;color:#dc2626;">− ${fmt(d.totalGasto)} €</td>
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
    `<label class="shop-check-label shop-check-row">
      <input type="checkbox" checked value="${d.domain}" onchange="recalcBalanceSuma()">
      ${escapeHtml(d.name)}
    </label>`
  ).join("");

  wrap.innerHTML = `
    <div style="margin-bottom:16px;padding:10px 16px;background:rgba(34,197,94,.08);border:1px solid #86efac;border-radius:8px;font-size:13px;color:#22c55e;font-weight:600;">
      📅 ${mesLabel}
    </div>
    <div style="background:#111827;border:1px solid #374151;border-radius:12px;padding:20px;">
      <div style="display:flex;gap:20px;align-items:flex-start;">
        <div style="flex:1;min-width:0;">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;" id="bal-cols">
            ${cols || `<div style="color:#6b7280;padding:16px;">No hay tiendas activas.</div>`}
          </div>
          <div id="bal-sumatoria" style="margin-top:24px;padding:18px 22px;background:rgba(34,197,94,.08);border:2px solid #22c55e;border-radius:12px;">
            <div style="font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Sumatoria seleccionada</div>
            <div id="bal-suma-filas" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;"></div>
            <div style="border-top:2px solid #22c55e;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;font-size:15px;color:#e5e7eb;">TOTAL</span>
              <span id="bal-suma-total" style="font-weight:800;font-size:24px;"></span>
            </div>
          </div>
        </div>
        <div style="width:200px;flex-shrink:0;background:var(--card);border:1px solid #374151;border-radius:12px;padding:14px;position:sticky;top:80px;">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Filtrar tiendas</div>
          <label class="shop-check-label all">
            <input type="checkbox" id="bal-check-all" checked onchange="toggleAllBalanceShops(this.checked)">
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
    `<div style="background:#111827;border:1px solid #374151;border-radius:8px;padding:8px 14px;font-size:12px;min-width:140px;">
      <div style="color:#6b7280;font-weight:600;margin-bottom:4px;">${escapeHtml(d.name)}</div>
      <div style="font-size:11px;color:#9ca3af;">Ingreso: <span style="color:#22c55e;font-weight:600;">${fmt(d.totalIngreso)} €</span></div>
      <div style="font-size:11px;color:#9ca3af;">Gasto: <span style="color:#dc2626;font-weight:600;">${fmt(d.totalGasto)} €</span></div>
      <div style="font-size:13px;font-weight:700;color:${d.resultado>=0?'#22c55e':'#dc2626'};margin-top:4px;border-top:1px solid #f3f4f6;padding-top:4px;">${fmt(d.resultado)} €</div>
    </div>`
  ).join("");

  if (totalEl) { totalEl.textContent = fmt(totalResultado) + " €"; totalEl.style.color = totalResultado >= 0 ? "#22c55e" : "#dc2626"; }

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
let ordersState = { q: "", status: "", shop: "", dateFrom: "", dateTo: "", page: 1, hasTracking: false };
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
  // Si hay búsqueda de texto, ignorar fechas para encontrar pedidos de cualquier fecha
  if (!ordersState.q) {
    if (ordersState.dateFrom)   params.set("from", ordersState.dateFrom);
    if (ordersState.dateTo)     params.set("to",   ordersState.dateTo);
  }
  if (ordersState.hasTracking) params.set("hasTracking", "1");

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

  ordersState = {
    q: "",
    status: "",
    shop: "",
    dateFrom: document.getElementById("filter-date-from")?.value || "",
    dateTo:   document.getElementById("filter-date-to")?.value   || "",
    page: 1
  };
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
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.tracking_number ? `<a href="https://www.mrw.es/seguimiento_envios/MRW_historico_nacional.asp?enviament=${encodeURIComponent(o.tracking_number)}" target="_blank" style="color:#22c55e;text-decoration:none;font-weight:500;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(o.tracking_number)}</a>` : "-"}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span class="status ${statusClass(o.fulfillment_status)}">${statusLabel(o.fulfillment_status)}</span></div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(o.customer_name || "-")}</div>
      <div style="display:flex;align-items:center;gap:6px;overflow:visible;">
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${o.total_price || 0} ${escapeHtml(o.currency || "")}</span>
        ${o.tracking_number ? `
        <button id="mrw-sync-btn-${o.id}" onclick="syncEnvioMRW(this,${o.id})" title="Sincronizar estado MRW"
          style="width:22px;height:22px;background:#0ea5e9;border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>` : ""}
        ${o.fulfillment_status !== "entregado" && o.fulfillment_status !== "cancelado" && o.fulfillment_status !== "destruido" && o.fulfillment_status !== "devuelto" ? `
        <div style="position:relative;flex-shrink:0;">
          <button onclick="toggleEstadoMenu(event,'menu-estado-${o.id}')" title="Cambiar estado"
            style="width:22px;height:22px;background:#4f46e5;border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="white"><circle cx="2" cy="5" r="1.2"/><circle cx="5" cy="5" r="1.2"/><circle cx="8" cy="5" r="1.2"/></svg>
          </button>
          <div id="menu-estado-${o.id}" style="display:none;position:absolute;right:0;top:calc(100% + 4px);background:#111827;border:1px solid #374151;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:999;min-width:140px;overflow:hidden;">
            <div onclick="cambiarEstadoPedido('${escapeAttr(o.order_id||"")}','${escapeAttr(o.order_number||"")}',${o.id||'null'},'entregado')" style="padding:9px 14px;font-size:12px;font-weight:600;color:#22c55e;cursor:pointer;display:flex;align-items:center;gap:7px;" onmouseover="this.style.background='rgba(34,197,94,.08)'" onmouseout="this.style.background=''">✓ Entregado</div>
            <div onclick="cambiarEstadoPedido('${escapeAttr(o.order_id||"")}','${escapeAttr(o.order_number||"")}',${o.id||'null'},'devuelto')" style="padding:9px 14px;font-size:12px;font-weight:600;color:#ea580c;cursor:pointer;display:flex;align-items:center;gap:7px;border-top:1px solid #f3f4f6;" onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background=''">↩ Devuelto</div>
            <div onclick="cambiarEstadoPedido('${escapeAttr(o.order_id||"")}','${escapeAttr(o.order_number||"")}',${o.id||'null'},'destruido')" style="padding:9px 14px;font-size:12px;font-weight:600;color:#c4b5fd;cursor:pointer;display:flex;align-items:center;gap:7px;border-top:1px solid #f3f4f6;" onmouseover="this.style.background='#faf5ff'" onmouseout="this.style.background=''">✕ Destruido</div>
            <div onclick="cambiarEstadoPedido('${escapeAttr(o.order_id||"")}','${escapeAttr(o.order_number||"")}',${o.id||'null'},'cancelado')" style="padding:9px 14px;font-size:12px;font-weight:600;color:#dc2626;cursor:pointer;display:flex;align-items:center;gap:7px;border-top:1px solid #f3f4f6;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background=''">✕ Cancelado</div>
          </div>
        </div>` : ""}
      </div>
    </div>`;
  }).join("");

if (pagination) {
    if (totalPages < 1) { pagination.innerHTML = ""; return; }
    const p = page;
    const delta = 2;
    let pages = "";

    // Botón anterior
    pages += `<button onclick="goToOrdersPage(${Math.max(1, p-1)})"
      style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #374151;
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
        style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #374151;
          background:var(--card);color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;">1</button>`;
      if (startPage > 2) pages += `<span style="padding:0 4px;color:#9ca3af;line-height:34px;">…</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === p;
      pages += `<button onclick="goToOrdersPage(${i})"
        style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid ${isActive?"#22c55e":"#e5e7eb"};
          background:${isActive?"#22c55e":"var(--card)"};color:${isActive?"#fff":"var(--text)"};
          font-size:13px;font-weight:${isActive?"700":"400"};cursor:pointer;font-family:inherit;">
        ${i}
      </button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages += `<span style="padding:0 4px;color:#9ca3af;line-height:34px;">…</span>`;
      pages += `<button onclick="goToOrdersPage(${totalPages})"
        style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #374151;
          background:var(--card);color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;">${totalPages}</button>`;
    }

    // Botón siguiente
    pages += `<button onclick="goToOrdersPage(${Math.min(totalPages, p+1)})"
      style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #374151;
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

async function marcarEntregado(orderId, orderNumber, internalId) {
  if (!confirm(`¿Estás seguro de que quieres marcar el pedido ${orderNumber} como entregado?\n\nEsta acción no se puede revertir.`)) return;
  try {
    const body = orderId ? { order_id: orderId } : { id: internalId };
    const res = await fetch(`${API_BASE}/api/orders/marcar-entregado`, {
      method: "POST",
      headers: { Authorization: "Bearer " + getActiveToken(), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) { alert(data.error || "Error al actualizar el pedido"); return; }
    showToast(`Pedido ${orderNumber} marcado como entregado`, "", "#22c55e");
    await fetchOrdersFiltered();
  } catch(e) { alert("Error de conexión"); }
}
window.marcarEntregado = marcarEntregado;

function toggleEstadoMenu(e, menuId) {
  e.stopPropagation();
  // Cerrar cualquier otro menú abierto
  document.querySelectorAll('[id^="menu-estado-"]').forEach(m => { if (m.id !== menuId) m.style.display = "none"; });
  const menu = document.getElementById(menuId);
  if (menu) menu.style.display = menu.style.display === "none" ? "block" : "none";
}
document.addEventListener("click", () => {
  document.querySelectorAll('[id^="menu-estado-"]').forEach(m => m.style.display = "none");
});

const _estadoLabels = { entregado: "entregado", devuelto: "devuelto", destruido: "destruido", cancelado: "cancelado" };
const _estadoColors = { entregado: "#22c55e", devuelto: "#ea580c", destruido: "#7c3aed", cancelado: "#dc2626" };

async function cambiarEstadoPedido(orderId, orderNumber, internalId, estado) {
  const label = _estadoLabels[estado] || estado;
  if (!confirm(`¿Estás seguro de que quieres marcar el pedido ${orderNumber} como ${label}?\n\nEsta acción no se puede revertir.`)) return;
  try {
    const body = { estado, ...(orderId ? { order_id: orderId } : { id: internalId }) };
    const res = await fetch(`${API_BASE}/api/orders/marcar-estado`, {
      method: "POST",
      headers: { Authorization: "Bearer " + getActiveToken(), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) { alert(data.error || "Error al actualizar el pedido"); return; }
    showToast(`Pedido ${orderNumber} marcado como ${label}`, "", _estadoColors[estado] || "#374151");
    await fetchOrdersFiltered();
  } catch(e) { alert("Error de conexión"); }
}
window.toggleEstadoMenu    = toggleEstadoMenu;
window.cambiarEstadoPedido = cambiarEstadoPedido;

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

  let saving = false;
  async function save() {
    if (saving) return;
    saving = true;
    const newName = input.value.trim().slice(0, 10);
    invalidateCache("shopify/stores");
    if (!newName) { fetchStores(); return; }

    try {
      await fetch(`${API_BASE}/api/shopify/rename/${storeId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + getActiveToken(),
        },
        body: JSON.stringify({ name: newName }),
      });
    } catch {}
    fetchStores();
  }

  input.addEventListener("blur", save);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { invalidateCache("shopify/stores"); fetchStores(); }
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
    background:#111827;
    border:1px solid #374151;
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
        <div style="width:36px;height:36px;border-radius:8px;background:#e8f5e9;display:flex;align-items:center;justify-content:center;font-weight:700;color:#22c55e;">
          S
        </div>
        <div>
          <h3 style="margin:0;">Reconectar tienda</h3>
          <div class="muted" style="font-size:13px;">Conexión segura con Shopify</div>
        </div>
      </div>

      <div style="border:1px solid #374151;border-radius:10px;padding:12px;margin-bottom:16px;background:#1f2937;">
        <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Tienda Shopify</div>
        <div style="font-weight:600;">${domain}</div>
      </div>

      <label style="font-size:13px;font-weight:500;">Token privado de Shopify</label>

      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding:10px 12px;border:1.5px solid #22c55e;border-radius:10px;background:rgba(34,197,94,.08);">
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

    // Sync ya completado en servidor — refrescar inmediatamente
    await fetchOrdersFiltered();
    await checkNotificaciones();

    // Auto-sincronizar MRW si está integrado
    try {
      const creds = await fetch(`${API_BASE}/api/tracking/mrw-credentials`, {
        headers: { Authorization: "Bearer " + getActiveToken() }
      }).then(r => r.json());
      if (creds.integrated) await sincronizarMRW();
    } catch(e) {}

    const syncedCount = data.synced ?? 0;
    if (btn) { btn.textContent = `✓ ${syncedCount} pedidos`; }
    if (syncedCount === 0) {
      showToast("ℹ️ Sincronizado", "No hay pedidos nuevos desde el 01/02/2026 en esta tienda.", "#6b7280");
    }
    setTimeout(() => {
      if (btn) { btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M1 4v6h6" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke-linecap="round" stroke-linejoin="round"/></svg>`; btn.disabled = false; btn.style.opacity = "1"; }
    }, 3000);
  } catch (e) {
    window.__hideLoadingBar?.();
    if (btn) { btn.textContent = "❌ Error"; btn.disabled = false; btn.style.opacity = "1"; }
    setTimeout(() => {
      if (btn) { btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M1 4v6h6" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
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
    background:#111827; border-left:1px solid #1f2937;
    box-shadow:-4px 0 20px rgba(0,0,0,0.5);
    z-index:999; display:flex; flex-direction:column;
    font-family:inherit;
  `;

  panel.innerHTML = `
    <div style="padding:20px 20px 14px; border-bottom:1px solid #1f2937; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:16px; font-weight:700;">Filtros</span>
      <span onclick="toggleFilterPanel()" style="cursor:pointer; font-size:20px; color:#6b7280; line-height:1;">×</span>
    </div>

    <div style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:20px;">

      <div>
        <label style="font-size:12px; font-weight:600; color:#e5e7eb; display:block; margin-bottom:8px;">Fecha</label>
        <input type="date" id="filter-date-from" value="${activeFilters.dateFrom}"
          style="width:100%; padding:8px 10px; border:1px solid #374151; border-radius:8px; font-size:13px; margin-bottom:6px;">
        <input type="date" id="filter-date-to" value="${activeFilters.dateTo}"
          style="width:100%; padding:8px 10px; border:1px solid #374151; border-radius:8px; font-size:13px;">
      </div>

      <div>
        <label style="font-size:12px; font-weight:600; color:#e5e7eb; display:block; margin-bottom:8px;">Estado logístico</label>
        <select id="filter-status"
          style="width:100%; padding:8px 10px; border:1px solid #374151; border-radius:8px; font-size:13px; background:#111827;">
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
        <label style="font-size:12px; font-weight:600; color:#e5e7eb; display:block; margin-bottom:8px;">Tiendas</label>
        <div style="border:1px solid #374151; border-radius:8px; overflow:hidden;">
          <div
            onclick="selectFilterShop('')"
            id="shop-opt-all"
            style="padding:10px 12px; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:8px;
              background:${!activeFilters.shop ? 'rgba(34,197,94,.1)' : 'transparent'};
              color:${!activeFilters.shop ? '#4ade80' : '#9ca3af'};
              font-weight:${!activeFilters.shop ? '600' : '400'};"
          >
            <span style="width:16px; height:16px; border-radius:50%; border:2px solid ${!activeFilters.shop ? '#22c55e' : '#374151'};
              background:${!activeFilters.shop ? '#22c55e' : 'transparent'}; display:inline-block; flex-shrink:0;"></span>
            Todas las tiendas
          </div>
          ${stores.map(s => `
            <div
              onclick="selectFilterShop('${s.domain}')"
              id="shop-opt-${s.id}"
              style="padding:10px 12px; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:8px;
                border-top:1px solid #1f2937;
                background:${activeFilters.shop===s.domain ? 'rgba(34,197,94,.1)' : 'transparent'};
                color:${activeFilters.shop===s.domain ? '#4ade80' : '#9ca3af'};
                font-weight:${activeFilters.shop===s.domain ? '600' : '400'};"
              onmouseover="this.style.background='rgba(255,255,255,.04)'"
              onmouseout="this.style.background='${activeFilters.shop===s.domain ? 'rgba(34,197,94,.1)' : 'transparent'}'"
            >
              <span style="width:16px; height:16px; border-radius:50%; border:2px solid ${activeFilters.shop===s.domain ? '#22c55e' : '#d1d5db'};
                background:${activeFilters.shop===s.domain ? '#22c55e' : 'transparent'}; display:inline-block; flex-shrink:0;"></span>
              ${escapeHtml(s.shop_name || s.domain)}
            </div>
          `).join("")}
        </div>
      </div>

    </div>

    <div style="padding:16px 20px; border-top:1px solid #1f2937; display:flex; gap:10px;">
      <button onclick="clearFilters()"
        style="flex:1; padding:10px; border:1px solid #374151; border-radius:8px; background:transparent; font-size:13px; cursor:pointer; font-weight:600; color:#9ca3af; font-family:inherit;" onmouseover="this.style.borderColor='#4b5563';this.style.color='#f9fafb';" onmouseout="this.style.borderColor='#374151';this.style.color='#9ca3af';">
        Limpiar
      </button>
      <button onclick="applyFilters()"
        style="flex:1; padding:10px; border:none; border-radius:8px; background:#22c55e; color:#052e16; font-size:13px; cursor:pointer; font-weight:700; font-family:inherit;" onmouseover="this.style.background='#16a34a';this.style.boxShadow='0 0 16px rgba(34,197,94,.4)';" onmouseout="this.style.background='#22c55e';this.style.boxShadow='none';">
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
  const shop     = document.getElementById("filter-shop-inline")?.value || "";
  const dateFrom = document.getElementById("filter-date-from")?.value || "";
  const dateTo   = document.getElementById("filter-date-to")?.value || "";
  const status   = ordersState.status || ""; // status is controlled by the tabs, not a dropdown

  if (dateFrom && dateTo && dateFrom > dateTo) {
    alert("❌ La fecha de inicio no puede ser mayor que la fecha de fin");
    return;
  }

  ordersState = { ...ordersState, status, shop, dateFrom, dateTo, page: 1 };
  fetchOrdersFiltered();
}

function clearFilters() {
  ordersState = { q: "", status: "", shop: "", dateFrom: "", dateTo: "", page: 1, hasTracking: false };
  fetchOrdersFiltered();
  toggleFilterPanel();
}

function clearFiltersInline() {
  ordersState = { q: "", status: "", shop: "", dateFrom: "", dateTo: "", page: 1, hasTracking: false };
  const df = document.getElementById("filter-date-from");
  const dt = document.getElementById("filter-date-to");
  const sh = document.getElementById("filter-shop-inline");
  if (df) df.value = "";
  if (dt) dt.value = "";
  if (sh) sh.value = "";
  const lbl = document.getElementById("filter-picker-label"); if (lbl) lbl.textContent = "Período";
  const s = window.__DPF._inst["filter"];
  if (s) { s.startDate=null; s.endDate=null; s.preset="personalizado"; s.presetLabel="Período"; }
  // Reset tabs: activate "Todos"
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelector(".tab")?.classList.add("active");
  fetchOrdersFiltered();
}
window.clearFiltersInline = clearFiltersInline;

function _clearSearchOnTabSwitch() {
  const searchEl = document.getElementById("search");
  if (searchEl) searchEl.value = "";
  ordersState = { ...ordersState, q: "" };
}
function filterByTab(el, status) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
  _clearSearchOnTabSwitch();
  ordersState = { ...ordersState, status: status || "", hasTracking: false, page: 1 };
  fetchOrdersFiltered();
}
function filterByTabMulti(el, statuses) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
  _clearSearchOnTabSwitch();
  ordersState = { ...ordersState, status: statuses.join(","), hasTracking: false, page: 1 };
  fetchOrdersFiltered();
}
function filterByTabPendienteMRW(el) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
  _clearSearchOnTabSwitch();
  ordersState = { ...ordersState, status: "pendiente", hasTracking: true, page: 1 };
  fetchOrdersFiltered();
}
window.filterByTab = filterByTab;
window.filterByTabMulti = filterByTabMulti;
window.filterByTabPendienteMRW = filterByTabPendienteMRW;



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
    q:    document.getElementById("ree-q")?.value?.trim() || "",
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
  if (reembolsosState.q)    params.set("q",    reembolsosState.q);
  if (reembolsosState.shop) params.set("shop", reembolsosState.shop);
  if (!reembolsosState.q) {
    if (reembolsosState.from) params.set("from", reembolsosState.from);
    if (reembolsosState.to)   params.set("to",   reembolsosState.to);
  }
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
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.tracking_number ? `<a href="https://www.mrw.es/seguimiento_envios/MRW_historico_nacional.asp?enviament=${encodeURIComponent(o.tracking_number)}" target="_blank" style="color:#22c55e;text-decoration:none;font-weight:500;font-size:12px;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(o.tracking_number)}</a>` : "-"}</div>
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.created_at ? new Date(o.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day:"2-digit", month:"2-digit", year:"numeric" }) : "-"}</div>
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${escapeHtml(o.customer_name || "-")}</div>
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.total_price || 0} ${escapeHtml(o.currency || "")}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            ${estadoPago === "cobrado"
              ? `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;background:rgba(34,197,94,.12);border:1px solid #86efac;border-radius:999px;font-size:12px;font-weight:600;color:#22c55e;">✅ Pagado</span>
                 ${o.fecha_pago ? `<span style="font-size:11px;color:#6b7280;">${new Date(o.fecha_pago).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"})}</span>` : ""}`
              : `<span class="status yellow" style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;">⏳ Pendiente</span>
                 <button onclick="confirmarPagadoReembolso(${o.id})" style="padding:4px 12px;font-size:12px;font-weight:600;background:#22c55e;color:#fff;border:none;border-radius:999px;cursor:pointer;">Marcar pagado</button>`
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
      pagesHtml += `<button onclick="goToReePage(${Math.max(1,p-1)})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #374151;background:var(--card);color:${p===1?"#d1d5db":"var(--text)"};font-size:13px;cursor:pointer;font-family:inherit;" ${p===1?"disabled":""}>‹</button>`;
      let sp = Math.max(1,p-delta), ep = Math.min(pages,p+delta);
      if (sp > 1) { pagesHtml += `<button onclick="goToReePage(1)" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #374151;background:var(--card);color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;">1</button>`; if (sp>2) pagesHtml += `<span style="padding:0 4px;color:#9ca3af;line-height:34px;">…</span>`; }
      for (let i=sp;i<=ep;i++) { const a=i===p; pagesHtml += `<button onclick="goToReePage(${i})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid ${a?"#22c55e":"#e5e7eb"};background:${a?"#22c55e":"var(--card)"};color:${a?"#fff":"var(--text)"};font-size:13px;font-weight:${a?"700":"400"};cursor:pointer;font-family:inherit;">${i}</button>`; }
      if (ep < pages) { if (ep<pages-1) pagesHtml += `<span style="padding:0 4px;color:#9ca3af;line-height:34px;">…</span>`; pagesHtml += `<button onclick="goToReePage(${pages})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #374151;background:var(--card);color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;">${pages}</button>`; }
      pagesHtml += `<button onclick="goToReePage(${Math.min(pages,p+1)})" style="min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #374151;background:var(--card);color:${p===pages?"#d1d5db":"var(--text)"};font-size:13px;cursor:pointer;font-family:inherit;" ${p===pages?"disabled":""}>›</button>`;
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

function confirmarPagadoReembolso(orderId) {
  if (!confirm("¿Estás seguro de que quieres marcar este reembolso como pagado?\n\nEsta acción no se puede revertir.")) return;
  cambiarEstadoReembolso(orderId, "cobrado");
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
  const q  = document.getElementById("ree-q");
  if (df) df.value = "";
  if (dt) dt.value = "";
  if (sh) sh.value = "";
  if (q)  q.value  = "";
  const lbl = document.getElementById("ree-picker-label"); if (lbl) lbl.textContent = "Período";
  const s = window.__DPF._inst["ree"];
  if (s) { s.startDate=null; s.endDate=null; s.preset="personalizado"; s.presetLabel="Período"; }
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
window.cambiarEstadoReembolso  = cambiarEstadoReembolso;
window.confirmarPagadoReembolso = confirmarPagadoReembolso;
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

// Refrescar sidebar cada 5 minutos automáticamente
setInterval(loadSidebarReembolsos, 5 * 60 * 1000);

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
    const estadosGuardados = JSON.parse(localStorage.getItem("orders_estados_" + (currentUser?.id || "anon")) || "{}");
    const nuevosEstados = {};
    const notisActuales = JSON.parse(localStorage.getItem("notifications_" + (currentUser?.id || "anon")) || "[]");
    const notisIds = new Set(notisActuales.map(n => n.id));
    const nuevasNotis = [...notisActuales];

    // Registro permanente para notificaciones de una sola vez (entregado/franquicia)
    // Este registro NO se borra al limpiar notificaciones
    const permKey = `notis_perm_${currentUser?.id || "anon"}`;
    const permShown = new Set(JSON.parse(localStorage.getItem(permKey) || "[]"));
    const permNuevos = [];

    for (const o of orders) {
      const id = String(o.id || o.order_id);
      const estado = o.fulfillment_status;
      const nombre = o.order_number || id;
      nuevosEstados[id] = estado;

      const estadoAnterior = estadosGuardados[id];

      const ahoraISO = new Date().toISOString();
      const ahoraMadrid = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const horaDetectada = ahoraMadrid; // "20/03/2026, 14:35"

      // 1. Entregado — solo UNA VEZ para siempre (usa registro permanente)
      if (estado === "entregado" && estadoAnterior && estadoAnterior !== "entregado") {
        const notiId = `entregado_${id}`;
        if (!permShown.has(notiId)) {
          const txt = `${nombre} — ${o.customer_name || ""} · Su pedido fue entregado a las ${horaDetectada}`;
          nuevasNotis.unshift({ id: notiId, title: "✅ Pedido entregado", text: txt, date: ahoraISO });
          notisIds.add(notiId);
          permShown.add(notiId);
          permNuevos.push(notiId);
          showToast("✅ Pedido entregado", txt, "#22c55e");
        }
      }

      // 2. Franquicia — solo UNA VEZ para siempre (usa registro permanente)
      if (estado === "franquicia" && estadoAnterior && estadoAnterior !== "franquicia") {
        const notiId = `franquicia_${id}`;
        if (!permShown.has(notiId)) {
          const txt = `${nombre} — ${o.customer_name || ""} · Dejado en franquicia a las ${horaDetectada}. Llamar al cliente.`;
          nuevasNotis.unshift({ id: notiId, title: "🏪 Pedido en franquicia", text: txt, date: ahoraISO });
          notisIds.add(notiId);
          permShown.add(notiId);
          permNuevos.push(notiId);
          showToast("🏪 Pedido en franquicia", txt, "#f59e0b");
        }
      }

      // 3. Más de 7 días sin resolver — una vez por día
      const estadosSinResolver = ["en_transito", "franquicia", "enviado", "en_preparacion"];
      if (estadosSinResolver.includes(estado) && o.created_at) {
        const fechaPedido = new Date(o.created_at);
        const diasTranscurridos = Math.floor((ahora - fechaPedido) / (1000 * 60 * 60 * 24));
        if (diasTranscurridos >= 7) {
          const notiId = `7dias__${id}`;
          const hoy = ahora.toISOString().slice(0, 10);
          const shownKey = `notis_shown_${currentUser?.id || "anon"}_${hoy}`;
          const shownHoy = JSON.parse(localStorage.getItem(shownKey) || "[]");
          if (!notisIds.has(notiId) && !shownHoy.includes(notiId)) {
            const txt = `${nombre} — ${o.customer_name || ""} (${estado})`;
            nuevasNotis.unshift({ id: notiId, title: `⚠️ ${diasTranscurridos} días sin resolver`, text: txt, date: ahoraISO });
            notisIds.add(notiId);
            shownHoy.push(notiId);
            localStorage.setItem(shownKey, JSON.stringify(shownHoy));
            showToast(`⚠️ ${diasTranscurridos} días sin resolver`, txt, "#f59e0b");
          }
        }
      }
    }

    localStorage.setItem("orders_estados_" + (currentUser?.id || "anon"), JSON.stringify(nuevosEstados));
    // Limitar a 300 notificaciones para no saturar localStorage
    localStorage.setItem("notifications_" + (currentUser?.id || "anon"), JSON.stringify(nuevasNotis.slice(0, 300)));
    // Guardar registro permanente de notificaciones ya enviadas (entregado/franquicia)
    if (permNuevos.length > 0) {
      localStorage.setItem(permKey, JSON.stringify([...permShown].slice(-3000)));
    }

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
    background:#111827;
    border:1px solid #374151;
    border-left:4px solid ${color || "#22c55e"};
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
      <div style="font-size:13px;font-weight:700;color:#f9fafb;margin-bottom:3px;">${escapeHtml(title)}</div>
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

window.irAPedidoDesdeNotif = irAPedidoDesdeNotif;

async function syncEnvioMRW(btn, orderId) {
  btn.disabled = true;
  btn.style.opacity = "0.5";
  try {
    const res = await fetch(`${API_BASE}/api/tracking/mrw-sync-one`, {
      method: "POST",
      headers: { Authorization: "Bearer " + getActiveToken(), "Content-Type": "application/json" },
      body: JSON.stringify({ orderId })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast("❌ Error", data.error || "No se pudo sincronizar", "#dc2626");
      return;
    }
    if (data.updated) {
      showToast("✅ Estado actualizado", `Nuevo estado: ${statusLabel(data.status)}`, "#22c55e");
      invalidateCache("orders");
      allOrders = [];
      await fetchOrdersFiltered();
    } else if (data.debug) {
      // MRW no devolvió EstadoDescripcion — mostrar qué devolvió para diagnóstico
      const info = data.debug.length ? data.debug.join(" | ") : "Respuesta vacía";
      showToast("⚠️ MRW sin estado", info, "#f59e0b");
    } else {
      showToast("ℹ️ Sin cambios", `Estado actual: ${statusLabel(data.status)}`, "#6b7280");
    }
  } catch(e) {
    showToast("❌ Error", "No se pudo conectar con MRW", "#dc2626");
  } finally {
    btn.disabled = false;
    btn.style.opacity = "1";
  }
}
window.syncEnvioMRW = syncEnvioMRW;

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

async function abrirHistoricoStock(productId, productName, currentStock, groupId) {
  const h = { Authorization: "Bearer " + getActiveToken() };
  // Modal backdrop
  const existing = document.getElementById("historico-stock-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "historico-stock-modal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;";
  modal.innerHTML = `
    <div style="background:var(--card);border-radius:12px;width:680px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-weight:700;font-size:15px;color:var(--text);">Histórico de stock</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">${escapeHtml(productName)}</div>
        </div>
        <button onclick="document.getElementById('historico-stock-modal').remove()"
          style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);line-height:1;">×</button>
      </div>
      <div id="historico-stock-body" style="padding:16px;overflow-y:auto;flex:1;">
        <div style="color:var(--muted);text-align:center;padding:24px;">Cargando...</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });

  try {
    const historyUrl = groupId
      ? `${API_BASE}/api/shopify/stock-history?group_id=${encodeURIComponent(groupId)}`
      : `${API_BASE}/api/shopify/stock-history?product_id=${encodeURIComponent(productId)}`;
    const rows = await fetch(historyUrl, { headers: h }).then(r => r.json());
    const body = document.getElementById("historico-stock-body");
    if (!body) return;
    if (!Array.isArray(rows) || rows.length === 0) {
      body.innerHTML = `<div style="color:var(--muted);text-align:center;padding:24px;">Sin movimientos registrados aún.<br><span style="font-size:12px;">Los movimientos se generan automáticamente al cargar esta sección.</span></div>`;
      return;
    }

    // Calcular saldo acumulado: rows vienen DESC (más reciente primero)
    // El saldo al final del día más reciente = stock actual
    // Retrocedemos día a día
    let saldo = currentStock ?? 0;
    const rowsConSaldo = rows.map(r => {
      const salida   = parseInt(r.uds_salida || 0);
      const dev      = parseInt(r.uds_devolucion || 0);
      const entrada  = parseInt(r.uds_entrada || 0);
      const neto     = dev + entrada - salida;
      const saldoFin = saldo;
      saldo = saldo - neto;
      return { ...r, salida, dev, entrada, neto, saldoFin };
    });

    body.innerHTML = `
      <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--input);">
            <th style="padding:8px 12px;border:1px solid var(--border);text-align:left;font-weight:600;color:var(--text);">Fecha</th>
            <th style="padding:8px 12px;border:1px solid var(--border);text-align:center;font-weight:600;color:#dc2626;">Pedidos env.</th>
            <th style="padding:8px 12px;border:1px solid var(--border);text-align:center;font-weight:600;color:#dc2626;">Uds. salida</th>
            <th style="padding:8px 12px;border:1px solid var(--border);text-align:center;font-weight:600;color:#16a34a;">Devueltos</th>
            <th style="padding:8px 12px;border:1px solid var(--border);text-align:center;font-weight:600;color:#16a34a;">Uds. devolución</th>
            <th style="padding:8px 12px;border:1px solid var(--border);text-align:center;font-weight:600;color:#7c3aed;">Entrada mercancía</th>
            <th style="padding:8px 12px;border:1px solid var(--border);text-align:center;font-weight:600;color:var(--text);">Neto</th>
            <th style="padding:8px 12px;border:1px solid var(--border);text-align:center;font-weight:700;color:#2563eb;background:rgba(59,130,246,.08);">Stock final día</th>
          </tr>
        </thead>
        <tbody>
          ${rowsConSaldo.map(r => `
            <tr onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background=''">
              <td style="padding:8px 12px;border:1px solid var(--border);font-weight:500;color:var(--text);">${r.fecha}</td>
              <td style="padding:8px 12px;border:1px solid var(--border);text-align:center;color:#dc2626;">${r.pedidos_enviados || 0}</td>
              <td style="padding:8px 12px;border:1px solid var(--border);text-align:center;color:#dc2626;font-weight:600;">${r.salida > 0 ? '-'+r.salida : '0'}</td>
              <td style="padding:8px 12px;border:1px solid var(--border);text-align:center;color:#16a34a;">${r.pedidos_devueltos || 0}</td>
              <td style="padding:8px 12px;border:1px solid var(--border);text-align:center;color:#16a34a;font-weight:600;">${r.dev > 0 ? '+'+r.dev : '0'}</td>
              <td style="padding:8px 12px;border:1px solid var(--border);text-align:center;color:#7c3aed;font-weight:600;">${r.entrada > 0 ? '+'+r.entrada : '0'}</td>
              <td style="padding:8px 12px;border:1px solid var(--border);text-align:center;font-weight:600;color:${r.neto>=0?'#16a34a':'#dc2626'};">${r.neto>=0?'+':''}${r.neto}</td>
              <td style="padding:8px 12px;border:1px solid var(--border);text-align:center;font-weight:700;font-size:14px;background:rgba(59,130,246,.08);color:${r.saldoFin<0?'#dc2626':r.saldoFin===0?'#d97706':'#2563eb'};">${r.saldoFin}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      </div>`;
  } catch(e) {
    const body = document.getElementById("historico-stock-body");
    if (body) body.innerHTML = `<div style="color:#dc2626;padding:16px;text-align:center;">Error cargando historial</div>`;
  }
}
window.abrirHistoricoStock = abrirHistoricoStock;

async function abrirVincularStock() {
  const h = { Authorization: "Bearer " + getActiveToken() };
  const existing = document.getElementById("vincular-stock-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "vincular-stock-modal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;";
  modal.innerHTML = `
    <div style="background:var(--card);border-radius:12px;width:720px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.35);">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <div style="font-weight:700;font-size:15px;color:var(--text);">Vincular stock entre productos</div>
        </div>
        <button onclick="document.getElementById('vincular-stock-modal').remove()"
          style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);line-height:1;">×</button>
      </div>
      <div id="vincular-stock-body" style="padding:16px;overflow-y:auto;flex:1;">
        <div style="color:var(--muted);text-align:center;padding:32px;">Cargando...</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });

  const [stockData, groups] = await Promise.all([
    fetch(`${API_BASE}/api/shopify/stock`, { headers: h }).then(r => r.json()).catch(() => []),
    fetch(`${API_BASE}/api/shopify/product-groups`, { headers: h }).then(r => r.json()).catch(() => []),
  ]);

  const stockMap = {};
  if (Array.isArray(stockData)) stockData.forEach(s => { stockMap[s.product_id] = s; });

  const allProducts = window.__allProductos || [];
  const selected = new Set();
  let searchVal = "";

  let editingGroupId = null;

  function renderGroups() {
    const el = document.getElementById("vincular-groups-panel");
    if (!el) return;
    const selectedCount = selected.size;
    if (groups.length === 0) { el.innerHTML = ""; return; }
    el.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:6px;">Grupos actuales</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">
        ${groups.map(g => {
          const members = g.members || [];
          const isEditing = editingGroupId === g.id;
          return `
          <div style="border:1px solid ${isEditing?'rgba(139,92,246,.4)':'var(--border)'};border-radius:8px;background:var(--input);overflow:hidden;">
            <!-- Group header row -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;gap:8px;">
              <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span style="font-size:13px;font-weight:700;color:#7c3aed;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(g.name)}</span>
                <span style="font-size:11px;font-weight:400;color:var(--muted);flex-shrink:0;">${members.length} producto${members.length!==1?'s':''}</span>
              </div>
              <div style="display:flex;gap:5px;flex-shrink:0;">
                ${selectedCount > 0 ? `<button onclick="window.__vincularAddToGroup(${g.id},'${escapeHtml(g.name)}')"
                  style="padding:4px 10px;background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.3);border-radius:6px;font-size:12px;color:#7c3aed;font-weight:600;cursor:pointer;font-family:inherit;">
                  + Añadir (${selectedCount})
                </button>` : ''}
                <button onclick="window.__vincularToggleEdit(${g.id})"
                  style="padding:4px 10px;background:${isEditing?'rgba(139,92,246,.12)':'var(--card)'};border:1px solid ${isEditing?'rgba(139,92,246,.3)':'var(--border)'};border-radius:6px;font-size:12px;color:${isEditing?'#7c3aed':'var(--text)'};font-weight:600;cursor:pointer;font-family:inherit;">
                  ${isEditing ? 'Cerrar' : 'Editar'}
                </button>
                <button onclick="window.__vincularDeleteGroup(${g.id})"
                  style="padding:4px 10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:6px;font-size:12px;color:#dc2626;font-weight:600;cursor:pointer;font-family:inherit;">
                  Eliminar
                </button>
              </div>
            </div>
            <!-- Members list (visible only when editing) -->
            ${isEditing ? `
            <div style="border-top:1px solid var(--border);">
              ${members.length === 0 ? '<div style="padding:10px 12px;font-size:12px;color:var(--muted);">Sin productos en este grupo</div>' :
                members.map(m => {
                  const p = allProducts.find(x => String(x.id) === String(m.product_id));
                  const name = p ? p.title : m.product_id;
                  const si = stockMap[m.product_id] || {};
                  return `
                  <div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid var(--border);">
                    <div style="flex:1;min-width:0;">
                      <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
                      <div style="font-size:11px;color:var(--muted);">${escapeHtml(p?.shop_name||m.shop_domain||'')}</div>
                    </div>
                    <div style="font-size:12px;font-weight:700;color:${(si.stock??1)<0?'#dc2626':(si.stock??1)===0?'#d97706':'#16a34a'};flex-shrink:0;white-space:nowrap;">Stock: ${si.stock??'—'}</div>
                    <button onclick="window.__vincularRemoveMember(${g.id},'${escapeHtml(m.product_id)}')"
                      style="padding:3px 8px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:5px;font-size:11px;color:#dc2626;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0;">
                      Desvincular
                    </button>
                  </div>`;
                }).join("")}
            </div>` : ''}
          </div>`;
        }).join("")}
      </div>`;
  }

  window.__vincularToggleEdit = (groupId) => {
    editingGroupId = editingGroupId === groupId ? null : groupId;
    renderGroups();
  };

  function renderProductList() {
    const el = document.getElementById("vincular-product-list");
    const countEl = document.getElementById("vincular-product-count");
    if (!el) return;

    const filtered = allProducts.filter(p => {
      if (!searchVal) return true;
      return (p.title || "").toLowerCase().includes(searchVal) ||
             (p.shop_domain || p.shop_name || "").toLowerCase().includes(searchVal);
    });

    if (countEl) countEl.textContent = `Productos (${filtered.length})`;

    el.innerHTML = filtered.length === 0
      ? '<div style="color:var(--muted);text-align:center;padding:16px;font-size:13px;">Sin resultados</div>'
      : filtered.map(p => {
          const pid = String(p.id);
          const si = stockMap[pid] || {};
          const isSel = selected.has(pid);
          return `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;cursor:pointer;background:${isSel?'rgba(139,92,246,.08)':'transparent'};border:1px solid ${isSel?'rgba(139,92,246,.3)':'transparent'};">
            <input type="checkbox" data-pid="${pid}" data-shop="${escapeHtml(p.shop_domain||si.shop_domain||'')}" ${isSel?'checked':''} onchange="window.__vincularToggle(this)" class="shop-check-input" style="width:16px;height:16px;cursor:pointer;flex-shrink:0;accent-color:#7c3aed;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.title)}</div>
              <div style="font-size:11px;color:var(--muted);">${escapeHtml(p.shop_name||p.shop_domain||'')}${si.group_name?` · <span style="color:#7c3aed;font-weight:600;">${escapeHtml(si.group_name)}</span>`:''}</div>
            </div>
            <div style="font-size:13px;font-weight:700;color:${(si.stock??1)<0?'#dc2626':(si.stock??1)===0?'#d97706':'#16a34a'};flex-shrink:0;">${si.stock??'—'}</div>
          </label>`;
        }).join("");
  }

  function renderSelectedCount() {
    const el = document.getElementById("vincular-sel-count");
    if (el) el.textContent = `${selected.size} seleccionado${selected.size!==1?'s':''}`;
    const btnLabel = document.getElementById("vincular-btn-crear-label");
    if (btnLabel) btnLabel.textContent = `Crear grupo${selected.size > 0 ? ' ('+selected.size+')' : ''}`;
    renderGroups();
  }

  // Render static shell once
  const body = document.getElementById("vincular-stock-body");
  body.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">
      <input id="vincular-buscar" type="text" placeholder="Buscar producto..."
        style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;background:var(--input);color:var(--text);outline:none;">
      <span id="vincular-sel-count" style="font-size:12px;color:var(--muted);white-space:nowrap;">0 seleccionados</span>
    </div>
    <div id="vincular-groups-panel"></div>
    <div style="margin-bottom:14px;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--input);">
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px;">Crear nuevo grupo con la selección</div>
      <div style="display:flex;gap:8px;">
        <input id="nuevo-grupo-nombre" type="text" placeholder="Nombre del grupo..."
          style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:inherit;background:var(--card);color:var(--text);outline:none;">
        <button onclick="window.__vincularCrearGrupo()"
          style="padding:7px 14px;background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.3);border-radius:7px;font-size:13px;color:#7c3aed;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;">
          <span id="vincular-btn-crear-label">Crear grupo</span>
        </button>
      </div>
    </div>
    <div id="vincular-product-count" style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:6px;">Productos (${allProducts.length})</div>
    <div id="vincular-product-list" style="display:flex;flex-direction:column;gap:4px;max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px;"></div>`;

  // Wire search input — only updates product list, never replaces the input itself
  document.getElementById("vincular-buscar").addEventListener("input", e => {
    searchVal = e.target.value.toLowerCase();
    renderProductList();
  });

  window.__vincularToggle = (checkbox) => {
    const pid = checkbox.dataset.pid;
    if (checkbox.checked) selected.add(pid);
    else selected.delete(pid);
    renderSelectedCount();
    // Update just this row's highlight without re-rendering the list
    const label = checkbox.closest("label");
    if (label) {
      label.style.background = checkbox.checked ? "rgba(139,92,246,.08)" : "transparent";
      label.style.border = `1px solid ${checkbox.checked ? "rgba(139,92,246,.3)" : "transparent"}`;
    }
  };

  async function refreshData() {
    const [updatedGroups, updatedStock] = await Promise.all([
      fetch(`${API_BASE}/api/shopify/product-groups`, { headers: h }).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/shopify/stock`, { headers: h }).then(r => r.json()).catch(() => []),
    ]);
    groups.length = 0; updatedGroups.forEach(g => groups.push(g));
    if (Array.isArray(updatedStock)) updatedStock.forEach(s => { stockMap[s.product_id] = s; });
    invalidateCache("shopify/stock");
    loadProductos();
  }

  window.__vincularAddToGroup = async (groupId, groupName) => {
    if (selected.size === 0) { alert("Selecciona al menos un producto"); return; }
    const products = allProducts.filter(p => selected.has(String(p.id)));
    for (const p of products) {
      const pid = String(p.id);
      await fetch(`${API_BASE}/api/shopify/product-groups/${groupId}/members`,
        { method: "POST", headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: pid, shop_domain: p.shop_domain || stockMap[pid]?.shop_domain || "" }) });
    }
    selected.clear();
    await refreshData();
    renderGroups();
    renderProductList();
    renderSelectedCount();
    showToast(`Productos añadidos al grupo "${groupName}"`, "", "#7c3aed");
  };

  window.__vincularRemoveMember = async (groupId, productId) => {
    await fetch(`${API_BASE}/api/shopify/product-groups/${groupId}/members/${encodeURIComponent(productId)}`,
      { method: "DELETE", headers: h });
    await refreshData();
    renderGroups();
    renderProductList();
    showToast("Producto desvinculado del grupo", "", "#374151");
  };

  window.__vincularDeleteGroup = async (groupId) => {
    if (!confirm("¿Eliminar este grupo? Los productos quedarán sin vincular.")) return;
    await fetch(`${API_BASE}/api/shopify/product-groups/${groupId}`, { method: "DELETE", headers: h });
    await refreshData();
    renderGroups();
    renderProductList();
  };

  window.__vincularCrearGrupo = async () => {
    const nombre = document.getElementById("nuevo-grupo-nombre")?.value?.trim();
    if (!nombre) { alert("Escribe un nombre para el grupo"); return; }
    if (selected.size === 0) { alert("Selecciona al menos un producto"); return; }
    const grp = await fetch(`${API_BASE}/api/shopify/product-groups`,
      { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ name: nombre }) }).then(r => r.json());
    if (!grp?.id) return;
    await window.__vincularAddToGroup(grp.id, nombre);
    document.getElementById("nuevo-grupo-nombre").value = "";
  };

  renderGroups();
  renderProductList();
}
window.abrirVincularStock = abrirVincularStock;

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

async function guardarStockMinimo(shopDomain, productId, stockMinimo) {
  try {
    await fetch(`${API_BASE}/api/shopify/stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getActiveToken() },
      body: JSON.stringify({ shop_domain: shopDomain, product_id: productId, stock: null, stock_minimo: parseInt(stockMinimo)||5 })
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
        <div style="display:flex;align-items:center;gap:8px;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text);">Entrada de mercancía</h3>
        </div>
        <span onclick="closeModal()" style="cursor:pointer;font-size:22px;color:var(--muted);line-height:1;">×</span>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:16px;background:var(--input);padding:4px;border-radius:10px;border:1px solid var(--border);">
        <button onclick="switchEntradaTab('nueva')" id="tab-nueva"
          style="flex:1;padding:7px 16px;border-radius:7px;border:none;background:var(--card);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:0 1px 4px rgba(0,0,0,.08);">
          Nueva entrada
        </button>
        <button onclick="switchEntradaTab('historial')" id="tab-historial"
          style="flex:1;padding:7px 16px;border-radius:7px;border:none;background:transparent;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">
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
  const activeStyle = { background: "var(--card)", color: "var(--text)", boxShadow: "0 1px 4px rgba(0,0,0,.08)" };
  const inactiveStyle = { background: "transparent", color: "var(--muted)", boxShadow: "none" };
  if (tab === "nueva") {
    Object.assign(btnNueva.style, activeStyle);
    Object.assign(btnHist.style, inactiveStyle);
    await cargarTabNuevaEntrada();
  } else {
    Object.assign(btnHist.style, activeStyle);
    Object.assign(btnNueva.style, inactiveStyle);
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
      <input id="entrada-search" type="text" placeholder="Buscar producto por nombre..."
        oninput="filtrarProductosEntrada()"
        style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--input);color:var(--text);outline:none;">
      <div id="entrada-search-results" style="margin-top:8px;border:1px solid var(--border);border-radius:8px;overflow:hidden;display:none;"></div>
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
      <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--input);">
            <th style="padding:10px 14px;border:1px solid var(--border);text-align:left;font-weight:600;color:var(--text);">Fecha</th>
            <th style="padding:10px 14px;border:1px solid var(--border);text-align:left;font-weight:600;color:var(--text);">Producto</th>
            <th style="padding:10px 14px;border:1px solid var(--border);text-align:left;font-weight:600;color:var(--text);width:80px;">Tienda</th>
            <th style="padding:10px 14px;border:1px solid var(--border);text-align:center;font-weight:600;color:#16a34a;width:80px;">Cantidad</th>
            <th style="padding:10px 14px;border:1px solid var(--border);text-align:center;font-weight:600;color:var(--muted);width:80px;">Anterior</th>
            <th style="padding:10px 14px;border:1px solid var(--border);text-align:center;font-weight:600;color:#2563eb;width:80px;">Nuevo stock</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
          <tr onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background=''">
            <td style="padding:10px 14px;border:1px solid var(--border);color:var(--muted);white-space:nowrap;">
              ${r.created_at ? new Date(r.created_at).toLocaleString("es-ES") : "-"}
            </td>
            <td style="padding:10px 14px;border:1px solid var(--border);font-weight:600;color:var(--text);">
              ${escapeHtml(r.product_name)}
            </td>
            <td style="padding:10px 14px;border:1px solid var(--border);font-size:11px;color:var(--muted);">
              ${escapeHtml(r.shop_domain)}
            </td>
            <td style="padding:10px 14px;border:1px solid var(--border);text-align:center;font-weight:700;color:#16a34a;">+${r.cantidad}</td>
            <td style="padding:10px 14px;border:1px solid var(--border);text-align:center;color:var(--muted);">${r.stock_anterior}</td>
            <td style="padding:10px 14px;border:1px solid var(--border);text-align:center;font-weight:700;color:#2563eb;">${r.stock_nuevo}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      </div>
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
    resultsEl.innerHTML = `<div style="padding:12px 14px;color:var(--muted);font-size:13px;">No se encontraron productos</div>`;
    return;
  }

  resultsEl.style.display = "block";
  resultsEl.innerHTML = matches.map(p => `
    <div onclick="seleccionarProductoEntrada('${String(p.id)}')"
      style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;"
      onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background=''">
      ${p.image ? `<img src="${p.image}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0;">` : `<div style="width:32px;height:32px;border-radius:4px;background:var(--input);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--border)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>`}
      <div>
        <div style="font-weight:600;color:var(--text);">${escapeHtml(p.title)}</div>
        <div style="font-size:11px;color:var(--muted);">${escapeHtml(p.shop_name || p.shop_domain)}</div>
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
    <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;">
      <div style="background:rgba(34,197,94,.1);border-bottom:1px solid rgba(34,197,94,.2);padding:14px 18px;display:flex;align-items:center;gap:12px;">
        ${p.image ? `<img src="${p.image}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:2px solid rgba(34,197,94,.3);">` : `<div style="width:48px;height:48px;border-radius:8px;background:rgba(34,197,94,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>`}
        <div>
          <div style="font-weight:700;color:var(--text);font-size:14px;">${escapeHtml(p.title)}</div>
          <div style="font-size:12px;color:#16a34a;font-weight:500;">${escapeHtml(p.shop_name || p.shop_domain)}</div>
        </div>
      </div>
      <div style="padding:20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;align-items:end;">
        <div style="text-align:center;padding:14px;background:var(--input);border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:10px;color:var(--muted);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Stock actual</div>
          <div style="font-size:28px;font-weight:700;color:var(--text);">${stockActual}</div>
          <div style="font-size:11px;color:var(--muted);">unidades</div>
        </div>
        <div style="text-align:center;padding:14px;background:rgba(34,197,94,.06);border-radius:10px;border:2px solid rgba(34,197,94,.25);">
          <div style="font-size:10px;color:var(--muted);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Cantidad a ingresar</div>
          <input type="number" min="1" id="entrada-qty-selected" placeholder="0"
            oninput="actualizarPreviewNuevo(${stockActual})"
            style="width:100%;padding:6px 4px;border:none;background:transparent;font-size:22px;text-align:center;font-family:inherit;font-weight:700;color:#16a34a;outline:none;">
        </div>
        <div style="text-align:center;padding:14px;background:rgba(37,99,235,.06);border-radius:10px;border:1px solid rgba(37,99,235,.15);">
          <div style="font-size:10px;color:var(--muted);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Stock nuevo</div>
          <div style="font-size:28px;font-weight:700;color:#2563eb;" id="entrada-preview-nuevo">${stockActual}</div>
          <div style="font-size:11px;color:var(--muted);">unidades</div>
        </div>
      </div>
      <div style="padding:0 20px 20px;">
        <button onclick="confirmarEntradaSeleccionada('${pid}','${escapeAttr(p.title)}','${p.shop_domain}',${stockActual})"
          style="width:100%;padding:12px;background:#22c55e;color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 2px 12px rgba(34,197,94,.25);transition:background .15s;"
          onmouseover="this.style.background='#16a34a'" onmouseout="this.style.background='#22c55e'">
          Registrar entrada de mercancía
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
    el.style.color = qty > 0 ? "#2563eb" : "var(--muted)";
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
      showToast("✅ Entrada registrada", `${productName} — +${qty} uds (stock: ${data.stock_nuevo})`, "#22c55e");
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
    const btnDesintegrar = document.getElementById("btn-mrw-desintegrar");
    const btnExcel = document.getElementById("btn-importar-excel");
    if (data.integrated) {
      if (btnIntegrar) btnIntegrar.style.display = "none";
      if (btnDesintegrar) btnDesintegrar.style.display = "inline-flex";
      if (btnExcel) btnExcel.style.display = "none";
    } else {
      if (btnIntegrar) btnIntegrar.style.display = "inline-flex";
      if (btnDesintegrar) btnDesintegrar.style.display = "none";
      if (btnExcel) btnExcel.style.display = "inline-flex";
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
        <div style="width:40px;height:40px;border-radius:10px;background:rgba(59,130,246,.1);display:flex;align-items:center;justify-content:center;font-size:20px;">🚚</div>
        <div>
          <h3 style="margin:0;font-size:16px;font-weight:700;">Integrar MRW Webservice</h3>
          <div style="font-size:12px;color:#6b7280;">Sincronización automática de estados de envío</div>
        </div>
      </div>
      <div style="background:rgba(59,130,246,.08);border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;font-size:13px;color:#93c5fd;margin-bottom:16px;">
        💡 Necesitas las credenciales SAGEC de MRW (Login y Contraseña del WebService TrackingServices)
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Login SAGEC *</label>
          <input id="mrw-login" type="text" placeholder="Ej: CD01234Ejemplo"
            style="width:100%;padding:9px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--card);color:var(--text);">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Contraseña SAGEC *</label>
          <input id="mrw-pass" type="password" placeholder="Contraseña"
            style="width:100%;padding:9px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--card);color:var(--text);">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Franquicia</label>
            <input id="mrw-franquicia" type="text" placeholder="Ej: 01234"
              style="width:100%;padding:9px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--card);color:var(--text);">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#e5e7eb;display:block;margin-bottom:4px;">Abonado</label>
            <input id="mrw-abonado" type="text" placeholder="Ej: 603835"
              style="width:100%;padding:9px 12px;border:1px solid #374151;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;background:var(--card);color:var(--text);">
          </div>
        </div>
        <div id="mrw-modal-msg" style="font-size:13px;min-height:18px;"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button onclick="closeModal()" style="flex:1;padding:10px;border:1px solid #374151;border-radius:8px;background:#111827;font-size:13px;cursor:pointer;font-weight:600;">Cancelar</button>
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
      showToast("✅ MRW integrado", "La sincronización automática está activa", "#22c55e");
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
      <div style="background:#22c55e;height:8px;width:${pct}%;transition:width 0.3s;border-radius:6px;"></div>
    </div>
    <div style="color:#9ca3af;font-size:12px;">${done} de ${total} pedidos (${pct}%)</div>
  `;
}

function ocultarBarraProgresoMRW() {
  const bar = document.getElementById("mrw-progress-bar");
  if (bar) bar.remove();
}

async function sincronizarMRW(esAutomatico = false) {
  // Evitar sincronizaciones concurrentes que consuman memoria
  if (window.__mrwSyncing) return;
  window.__mrwSyncing = true;

  const btn = document.getElementById("btn-mrw-sync");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Sincronizando..."; }

  // Polling de progreso
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
      if (data.updated > 0) {
        showToast("✅ MRW sincronizado", `${data.updated} pedido${data.updated > 1 ? "s" : ""} actualizado${data.updated > 1 ? "s" : ""}`, "#22c55e");
        invalidateCache("orders");
        allOrders = [];
        await fetchOrdersFiltered();
        if (document.getElementById("sec-metricas")?.style.display !== "none") {
          await loadMetricas();
        }
      } else {
        showToast("— MRW sincronizado", "Sin cambios de estado esta vez", "#6b7280");
      }
    } else {
      showToast("❌ Error MRW", data.error || "Error desconocido", "#dc2626");
    }
  } catch(e) {
    clearInterval(pollingInterval);
    ocultarBarraProgresoMRW();
    showToast("❌ Error", "No se pudo conectar con MRW", "#dc2626");
  } finally {
    window.__mrwSyncing = false;
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