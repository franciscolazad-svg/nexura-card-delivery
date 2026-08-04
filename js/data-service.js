/**
 * data-service.js
 * ------------------------------------------------------------------
 * Capa de acceso a datos — Nexura Card Delivery Platform.
 *
 * ARQUITECTURA:
 * Este archivo ya NO almacena nada en el navegador. Es un cliente
 * REST muy fino que llama a la API del servidor (server/server.js),
 * la cual lee y escribe en una base de datos SQL real (SQLite,
 * ver server/db.js). La sesión (código de seguimiento del cliente,
 * sesión del administrador) se gestiona mediante una cookie segura
 * enviada automáticamente por el navegador — ya no hay nada en
 * localStorage.
 *
 * Ninguna página (portal cliente, portal admin...) necesita conocer
 * este detalle: todas siguen llamando únicamente a `DataService.*`,
 * exactamente igual que antes.
 * ------------------------------------------------------------------
 */

const API_BASE = "/api";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "same-origin",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  if (!res.ok) {
    const message = (data && data.error) || `Error ${res.status}`;
    throw new Error(message);
  }
  return data;
}

const get = (path) => apiFetch(path);
const post = (path, body) => apiFetch(path, { method: "POST", body: JSON.stringify(body || {}) });
const put = (path, body) => apiFetch(path, { method: "PUT", body: JSON.stringify(body || {}) });
const del = (path) => apiFetch(path, { method: "DELETE" });

/* =========================================================
   ÉTAPES DU CYCLE DE VIE D'UNE EXPÉDITION
   (constantes purement d'affichage — dupliquées côté serveur
   dans server/db.js pour générer les événements)
   ========================================================= */
const STEPS = [
  { key: "request_received", label: "Solicitud recibida", short: "Recibida" },
  { key: "identity_verification", label: "Verificación de identidad", short: "Verificación" },
  { key: "card_production", label: "Producción de la tarjeta", short: "Producción" },
  { key: "card_printed", label: "Tarjeta impresa", short: "Impresa" },
  { key: "packaging", label: "Embalaje", short: "Embalaje" },
  { key: "shipped", label: "Enviada", short: "Enviada" },
  { key: "in_transit", label: "En tránsito", short: "Tránsito" },
  { key: "local_distribution", label: "Centro de distribución local", short: "Centro local" },
  { key: "out_for_delivery", label: "En reparto", short: "Reparto" },
  { key: "delivered", label: "Entregada", short: "Entregada" },
];

const CARD_TYPES = ["Nexura Classic Débito", "Nexura Gold Débito", "Nexura World Elite", "Nexura Tarjeta Virtual"];

function computePercent(stepIndex) {
  return Math.round((stepIndex / (STEPS.length - 1)) * 100);
}

window.DataService = {
  STEPS,
  CARD_TYPES,
  computePercent,

  async init() {
    // La base de datos ya está lista del lado del servidor
    // (inicializada y sembrada automáticamente al arrancar).
    // No hay nada que preparar en el navegador.
  },

  /* ---------- SESSION ---------- */
  async setSession(trackingId) {
    await post("/auth/client/login", { trackingCode: trackingId });
  },
  async getSession() {
    const { trackingId } = await get("/auth/client/me");
    return trackingId;
  },
  async clientLogout() {
    await post("/auth/client/logout");
  },
  async setAdminSession(active, email, password) {
    if (!active) {
      await post("/auth/admin/logout");
      return;
    }
    await post("/auth/admin/login", { email, password });
  },
  async getAdminSession() {
    const { loggedIn } = await get("/auth/admin/me");
    return loggedIn;
  },

  /* ---------- CLIENTS ---------- */
  async getClients() {
    return get("/clients");
  },

  /* ---------- EXPÉDITIONS ---------- */
  async getShipments() {
    return get("/shipments");
  },
  async getShipment(id) {
    return get(`/shipments/${encodeURIComponent(id)}`);
  },
  async getShipmentByTrackingId(trackingId) {
    return get(`/shipments/by-tracking/${encodeURIComponent((trackingId || "").trim())}`);
  },
  async createShipment(fields) {
    return post("/shipments", fields);
  },
  async deleteShipment(id) {
    await del(`/shipments/${encodeURIComponent(id)}`);
    return true;
  },
  async advanceShipment(id, { stepIndex, comment, agent, customDate }) {
    return post(`/shipments/${encodeURIComponent(id)}/advance`, { stepIndex, comment, agent, customDate });
  },
  async setDelayed(id, delayed) {
    return post(`/shipments/${encodeURIComponent(id)}/delayed`, { delayed });
  },

  /* ---------- AGENTS ---------- */
  async getAgents() {
    return get("/agents");
  },
  async createAgent(fields) {
    return post("/agents", fields);
  },
  async updateAgent(id, fields) {
    return put(`/agents/${encodeURIComponent(id)}`, fields);
  },
  async deleteAgent(id) {
    await del(`/agents/${encodeURIComponent(id)}`);
    return true;
  },
  async agentLoad(agentName) {
    const { load } = await get(`/agents/${encodeURIComponent(agentName)}/load`);
    return load;
  },

  /* ---------- NOTIFICATIONS ---------- */
  async getNotifications() {
    return get("/notifications/mine");
  },
  async getAllNotifications() {
    return get("/notifications/all");
  },
  async markNotificationRead(id) {
    await post(`/notifications/${encodeURIComponent(id)}/read`);
  },
  async markAllRead() {
    await post("/notifications/mark-all-read");
  },
  async createNotification(fields) {
    return post("/notifications", fields);
  },
  async deleteNotification(id) {
    await del(`/notifications/${encodeURIComponent(id)}`);
  },

  /* ---------- PARAMÈTRES ---------- */
  async getSettings() {
    return get("/settings");
  },
  async updateSettings(fields) {
    return put("/settings", fields);
  },

  /* ---------- JOURNAL D'ACTIVITÉ ---------- */
  async getActivityLog() {
    return get("/activity-log");
  },
  async logActivity(text, actor) {
    await post("/activity-log", { text, actor });
  },

  /* ---------- STATISTIQUES (admin dashboard) ---------- */
  async getStats() {
    return get("/stats");
  },
};
