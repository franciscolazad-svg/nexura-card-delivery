/**
 * admin-shell.js — barre latérale et en-tête du portail administrateur.
 */

const ADMIN_NAV = [
  { key: "dashboard", href: "dashboard.html", label: "Resumen general", icon: "dashboard" },
  { key: "shipments", href: "shipments.html", label: "Envíos", icon: "box" },
  { key: "agents", href: "agents.html", label: "Agentes", icon: "users2" },
  { key: "notifications", href: "notifications.html", label: "Notificaciones", icon: "bell" },
  { key: "settings", href: "settings.html", label: "Configuración", icon: "gear" },
];

const ADMIN_ICONS = {
  ...ICONS,
  users2: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
};

async function renderAdminShell(activeKey) {
  const settings = await window.DataService.getSettings();
  const nav = ADMIN_NAV.map(
    (item) => `
      <a class="nav-item ${item.key === activeKey ? "active" : ""}" href="${item.href}">
        ${ADMIN_ICONS[item.icon]}<span>${item.label}</span>
      </a>`
  ).join("");

  document.getElementById("shell-sidebar").innerHTML = `
    <div class="brand">
      <div class="brand-mark" style="background:linear-gradient(135deg,#a37fe8,#6a35b8);"><img src="../assets/logo-mono.svg" alt="Nexura" style="width:70%;height:70%;color:#1a1206;" /></div>
      <div>
        <div class="brand-name">${settings.platformName || "Nexura"}</div>
        <div class="brand-tag">Admin</div>
      </div>
    </div>
    <div class="nav-group">
      <div class="nav-label">Gestión</div>
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
        <span class="icon-sun">${ADMIN_ICONS.sun}</span><span class="icon-moon">${ADMIN_ICONS.moon}</span>
      </button>
      <button class="icon-btn" id="logout-btn" title="Cerrar sesión">${ADMIN_ICONS.logout}</button>
      <div class="avatar" title="Administrador Nexura">AN</div>
    `;
    document.getElementById("theme-toggle-btn").addEventListener("click", toggleTheme);
    document.getElementById("logout-btn").addEventListener("click", async () => {
      await window.DataService.setAdminSession(false);
      window.location.href = "../index.html";
    });
  }
}

window.AdminShell = { ADMIN_ICONS, renderAdminShell };
