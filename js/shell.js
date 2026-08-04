/**
 * shell.js — éléments d'interface partagés entre les pages du portail client.
 */

const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="11" width="8" height="10" rx="2"/><rect x="3" y="14" width="8" height="7" rx="2"/></svg>`,
  track: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>`,
  history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3.5v5c0 5-3.4 8.5-8 9.5-4.6-1-8-4.5-8-9.5v-5L12 3z"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
  card: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="6" width="14" height="11" rx="1.5"/><path d="M15 10h4l4 4v3h-8z"/><circle cx="6" cy="19" r="1.8"/><circle cx="17.5" cy="19" r="1.8"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m21 8-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2.5"/><path d="m3 6 9 7 9-7"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1.1.4 2.2.7 3.2a2 2 0 0 1-.5 2.1L8 10.3a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c1 .4 2.1.6 3.2.8a2 2 0 0 1 1.7 2z"/></svg>`,
};

const NAV_ITEMS = [
  { key: "dashboard", href: "dashboard.html", label: "Panel principal", icon: "dashboard" },
  { key: "history", href: "history.html", label: "Historial", icon: "history" },
  { key: "notifications", href: "notifications.html", label: "Notificaciones", icon: "bell" },
];

function pad(n) { return String(n).padStart(2, "0"); }

function fmtDate(iso) {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtTime(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDateTime(iso) {
  return `${fmtDate(iso)} · ${fmtTime(iso)}`;
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "justo ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} d`;
  return fmtDate(iso);
}

function initials(name) {
  return (name || "").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function applyStoredTheme() {
  const saved = localStorage.getItem("nexura:theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  return saved;
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("nexura:theme", next);
  return next;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toast(message, type = "success") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const icons = {
    success: ICONS.check,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/></svg>`,
  };
  const el = document.createElement("div");
  el.className = `toast ${type === "error" ? "error" : type === "info" ? "info" : ""}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || icons.success}</span><span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s, transform .3s";
    el.style.opacity = "0";
    el.style.transform = "translateX(20px) scale(0.96)";
    setTimeout(() => el.remove(), 320);
  }, 3600);
}

async function requireClientSession() {
  await window.DataService.init();
  const trackingId = await window.DataService.getSession();
  if (!trackingId) {
    window.location.href = "../index.html";
    return null;
  }
  const shipment = await window.DataService.getShipmentByTrackingId(trackingId);
  if (!shipment) {
    window.location.href = "../index.html";
    return null;
  }
  return {
    id: shipment.clientId,
    name: shipment.clientName,
    email: shipment.clientEmail,
    initials: shipment.clientInitials,
    shipmentId: shipment.id,
    trackingId: shipment.trackingId,
  };
}

async function requireAdminSession() {
  await window.DataService.init();
  const active = await window.DataService.getAdminSession();
  if (!active) {
    window.location.href = "../index.html";
    return false;
  }
  return true;
}

async function renderShell(activeKey, client) {
  const notifs = await window.DataService.getNotifications(client.id);
  const unread = notifs.filter((n) => !n.read).length;
  const settings = await window.DataService.getSettings();

  const nav = NAV_ITEMS.map(
    (item) => `
      <a class="nav-item ${item.key === activeKey ? "active" : ""}" href="${item.href}">
        ${ICONS[item.icon]}<span>${item.label}</span>
      </a>`
  ).join("");

  document.getElementById("shell-sidebar").innerHTML = `
    <div class="brand">
      <div class="brand-mark"><img src="../assets/logo.svg" alt="Nexura" style="width:100%;height:100%;display:block;" /></div>
      <div>
        <div class="brand-name">${settings.platformName || "Nexura"}</div>
        <div class="brand-tag">Card Delivery</div>
      </div>
    </div>
    <div class="nav-group">
      <div class="nav-label">Seguimiento de tarjeta</div>
      ${nav}
    </div>
    <div class="sidebar-foot">
      <div class="sandbox-pill"><span class="dot"></span> Entorno de demostración</div>
    </div>
  `;

  const topRight = document.getElementById("shell-topbar-right");
  if (topRight) {
    topRight.innerHTML = `
      <button class="icon-btn theme-toggle-btn" id="theme-toggle-btn" title="Cambiar tema">
        <span class="icon-sun">${ICONS.sun}</span><span class="icon-moon">${ICONS.moon}</span>
      </button>
      <button class="icon-btn" id="notif-shortcut" title="Notificaciones">
        ${ICONS.bell}
        ${unread > 0 ? `<span class="badge-dot">${unread}</span>` : ""}
      </button>
      <button class="icon-btn" id="logout-btn" title="Cerrar sesión">${ICONS.logout}</button>
      <div class="avatar" title="${client.name}">${client.initials || initials(client.name)}</div>
    `;
    document.getElementById("theme-toggle-btn").addEventListener("click", toggleTheme);
    document.getElementById("notif-shortcut").addEventListener("click", () => (window.location.href = "notifications.html"));
    document.getElementById("logout-btn").addEventListener("click", async () => {
      await window.DataService.clientLogout();
      window.location.href = "../index.html";
    });
  }
}

window.Shell = {
  ICONS,
  fmtDate,
  fmtTime,
  fmtDateTime,
  timeAgo,
  initials,
  toast,
  wait,
  applyStoredTheme,
  toggleTheme,
  requireClientSession,
  requireAdminSession,
  renderShell,
};
