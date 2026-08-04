/**
 * server.js — Nexura Card Delivery Platform, back-end Express + PostgreSQL.
 * ------------------------------------------------------------------
 * - Sert les fichiers statiques du front-end.
 * - Expose une API REST sous /api/* adossée à une vraie base de
 *   données PostgreSQL (Neon, Supabase, ou tout Postgres accessible
 *   via DATABASE_URL — voir server/db.js).
 * - Authentification par cookie de session (admin et client) stockée
 *   elle aussi en base de données.
 * ------------------------------------------------------------------
 */
const { loadEnv } = require("./env");
loadEnv();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const {
  query, queryOne, init,
  STEPS, STEP_COMMENTS, CARD_TYPES,
  uid, generateTrackingId, nowISO, addDays,
  hashPassword, verifyPassword,
} = require("./db");

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";
const ADMIN_COOKIE = "nexura_admin_session";
const CLIENT_COOKIE = "nexura_client_session";

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());

/* =========================================================
   SESSIONS (stockées en base — table `sessions`)
   ========================================================= */
async function createSession(type, subject) {
  const token = crypto.randomBytes(32).toString("hex");
  await query("INSERT INTO sessions (token, type, subject, created_at) VALUES ($1,$2,$3,$4)", [token, type, subject, nowISO()]);
  return token;
}
async function readSession(token, type) {
  if (!token) return null;
  return queryOne("SELECT * FROM sessions WHERE token = $1 AND type = $2", [token, type]);
}
async function destroySession(token) {
  if (!token) return;
  await query("DELETE FROM sessions WHERE token = $1", [token]);
}
function cookieOpts() {
  return { httpOnly: true, sameSite: "lax", secure: IS_PROD, maxAge: 1000 * 60 * 60 * 24 * 30 };
}

function requireAdmin(req, res, next) {
  readSession(req.cookies[ADMIN_COOKIE], "admin")
    .then((session) => {
      if (!session) return res.status(401).json({ error: "No autenticado." });
      req.adminId = session.subject;
      next();
    })
    .catch(next);
}
function requireClient(req, res, next) {
  readSession(req.cookies[CLIENT_COOKIE], "client")
    .then((session) => {
      if (!session) return res.status(401).json({ error: "No autenticado." });
      req.trackingId = session.subject;
      next();
    })
    .catch(next);
}

/* Petit helper pour éviter un try/catch répété sur chaque route async. */
function h(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

/* =========================================================
   SÉRIALISATION (snake_case SQL -> camelCase JSON, identique
   à la forme utilisée par le front-end)
   ========================================================= */
async function serializeShipment(row) {
  const events = (await query("SELECT * FROM shipment_events WHERE shipment_id = $1 ORDER BY step_index ASC", [row.id]))
    .map((e) => ({ stepIndex: e.step_index, stepKey: e.step_key, date: e.date, agent: e.agent, comment: e.comment, status: e.status }));
  return {
    id: row.id,
    trackingId: row.tracking_id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientInitials: row.client_initials,
    shippingAddress: row.shipping_address,
    cardType: row.card_type,
    currentStepIndex: row.current_step_index,
    status: row.status,
    delayed: !!row.delayed,
    agent: row.agent,
    createdAt: row.created_at,
    estimatedDelivery: row.estimated_delivery,
    lastUpdate: row.last_update,
    events,
  };
}
function getShipmentRow(id) {
  return queryOne("SELECT * FROM shipments WHERE id = $1", [id]);
}

async function logActivity(text, actor = "Administrador Nexura") {
  await query("INSERT INTO activity_log (id, date, actor, text) VALUES ($1,$2,$3,$4)", [uid("log"), nowISO(), actor, text]);
  const rows = await query("SELECT id FROM activity_log ORDER BY date DESC OFFSET 100");
  for (const r of rows) await query("DELETE FROM activity_log WHERE id = $1", [r.id]);
}

function notifRow(n) {
  return {
    id: n.id, title: n.title, message: n.message, audience: n.audience, type: n.type,
    createdAt: n.created_at, sentAt: n.sent_at, scheduledAt: n.scheduled_at, read: !!n.read,
  };
}

/* =========================================================
   AUTH
   ========================================================= */
app.post("/api/auth/admin/login", h(async (req, res) => {
  const { email, password } = req.body || {};
  const admin = await queryOne("SELECT * FROM admins WHERE email = $1", [(email || "").trim().toLowerCase()]);
  if (!admin || !verifyPassword(password || "", admin.password_hash)) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }
  const token = await createSession("admin", admin.id);
  res.cookie(ADMIN_COOKIE, token, cookieOpts());
  res.json({ ok: true });
}));

app.post("/api/auth/admin/logout", h(async (req, res) => {
  await destroySession(req.cookies[ADMIN_COOKIE]);
  res.clearCookie(ADMIN_COOKIE);
  res.json({ ok: true });
}));

app.get("/api/auth/admin/me", h(async (req, res) => {
  const session = await readSession(req.cookies[ADMIN_COOKIE], "admin");
  res.json({ loggedIn: !!session });
}));

app.post("/api/auth/client/login", h(async (req, res) => {
  const code = ((req.body || {}).trackingCode || "").trim().toUpperCase();
  const shipment = await queryOne("SELECT * FROM shipments WHERE UPPER(tracking_id) = $1", [code]);
  if (!shipment) return res.status(404).json({ error: "Código de seguimiento no válido." });
  const token = await createSession("client", shipment.tracking_id);
  res.cookie(CLIENT_COOKIE, token, cookieOpts());
  res.json({ ok: true, trackingId: shipment.tracking_id });
}));

app.post("/api/auth/client/logout", h(async (req, res) => {
  await destroySession(req.cookies[CLIENT_COOKIE]);
  res.clearCookie(CLIENT_COOKIE);
  res.json({ ok: true });
}));

app.get("/api/auth/client/me", h(async (req, res) => {
  const session = await readSession(req.cookies[CLIENT_COOKIE], "client");
  res.json({ trackingId: session ? session.subject : null });
}));

/* =========================================================
   SHIPMENTS (envíos)
   ========================================================= */
app.get("/api/shipments/by-tracking/:code", h(async (req, res) => {
  const code = (req.params.code || "").trim().toUpperCase();
  const row = await queryOne("SELECT * FROM shipments WHERE UPPER(tracking_id) = $1", [code]);
  if (!row) return res.json(null);
  res.json(await serializeShipment(row));
}));

app.get("/api/shipments", requireAdmin, h(async (req, res) => {
  const rows = await query("SELECT * FROM shipments ORDER BY created_at DESC");
  res.json(await Promise.all(rows.map(serializeShipment)));
}));

app.get("/api/shipments/:id", requireAdmin, h(async (req, res) => {
  const row = await getShipmentRow(req.params.id);
  if (!row) return res.status(404).json({ error: "Envío no encontrado" });
  res.json(await serializeShipment(row));
}));

app.post("/api/shipments", requireAdmin, h(async (req, res) => {
  const fields = req.body || {};
  const client = await queryOne("SELECT * FROM clients WHERE id = $1", [fields.clientId]);
  if (!client) return res.status(400).json({ error: "Cliente no válido." });

  const id = uid("shp");
  const trackingId = generateTrackingId();
  const created = nowISO();
  const fallbackAgent = await queryOne("SELECT name FROM agents LIMIT 1");
  const agentName = fields.agent || (fallbackAgent || {}).name || "";

  await query(
    `INSERT INTO shipments (id, tracking_id, client_id, client_name, client_email, client_initials, shipping_address, card_type, current_step_index, status, delayed, agent, created_at, estimated_delivery, last_update)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,'En curso',false,$9,$10,$11,$12)`,
    [id, trackingId, client.id, client.name, client.email, client.initials, client.address, fields.cardType || CARD_TYPES[0], agentName, created, addDays(created, 10), created]
  );
  await query(
    `INSERT INTO shipment_events (shipment_id, step_index, step_key, date, agent, comment, status) VALUES ($1,0,$2,$3,$4,$5,'current')`,
    [id, STEPS[0].key, created, agentName, STEP_COMMENTS.request_received]
  );

  await logActivity(`Nuevo envío creado para ${client.name} (${trackingId}).`);
  res.status(201).json(await serializeShipment(await getShipmentRow(id)));
}));

app.delete("/api/shipments/:id", requireAdmin, h(async (req, res) => {
  const row = await getShipmentRow(req.params.id);
  if (!row) return res.status(404).json({ error: "Envío no encontrado" });
  await query("DELETE FROM shipments WHERE id = $1", [req.params.id]);
  await logActivity(`Envío ${row.tracking_id} eliminado.`);
  res.json({ ok: true });
}));

app.post("/api/shipments/:id/advance", requireAdmin, h(async (req, res) => {
  const row = await getShipmentRow(req.params.id);
  if (!row) return res.status(404).json({ error: "Envío no encontrado" });

  const { stepIndex, comment, agent, customDate } = req.body || {};
  const date = customDate ? new Date(customDate).toISOString() : nowISO();
  const agentName = agent || row.agent;

  await query("UPDATE shipment_events SET status = 'done' WHERE shipment_id = $1 AND step_index < $2", [row.id, stepIndex]);
  await query("DELETE FROM shipment_events WHERE shipment_id = $1 AND step_index >= $2", [row.id, stepIndex]);
  await query(
    `INSERT INTO shipment_events (shipment_id, step_index, step_key, date, agent, comment, status) VALUES ($1,$2,$3,$4,$5,$6,'current')`,
    [row.id, stepIndex, STEPS[stepIndex].key, date, agentName, comment || STEP_COMMENTS[STEPS[stepIndex].key] || ""]
  );

  const newStatus = stepIndex === STEPS.length - 1 ? "Entregada" : row.delayed ? "Retrasada" : "En curso";
  await query("UPDATE shipments SET current_step_index=$1, status=$2, agent=$3, last_update=$4 WHERE id=$5", [stepIndex, newStatus, agentName, nowISO(), row.id]);

  await logActivity(`Etapa "${STEPS[stepIndex].label}" publicada para ${row.tracking_id}.`);

  await query(
    `INSERT INTO notifications (id, title, message, audience, type, created_at, sent_at, scheduled_at, read)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,false)`,
    [uid("ntf"), "Actualización de tu envío", `Tu tarjeta (${row.tracking_id}) ahora está: ${STEPS[stepIndex].label}.`, row.client_id, stepIndex === STEPS.length - 1 ? "success" : "info", nowISO(), nowISO()]
  );

  res.json(await serializeShipment(await getShipmentRow(row.id)));
}));

app.post("/api/shipments/:id/delayed", requireAdmin, h(async (req, res) => {
  const row = await getShipmentRow(req.params.id);
  if (!row) return res.status(404).json({ error: "Envío no encontrado" });
  const delayed = !!(req.body || {}).delayed;
  const status = row.current_step_index === STEPS.length - 1 ? "Entregada" : delayed ? "Retrasada" : "En curso";
  await query("UPDATE shipments SET delayed=$1, status=$2, last_update=$3 WHERE id=$4", [delayed, status, nowISO(), row.id]);
  res.json(await serializeShipment(await getShipmentRow(row.id)));
}));

/* =========================================================
   CLIENTS
   ========================================================= */
app.get("/api/clients", requireAdmin, h(async (req, res) => {
  res.json(await query("SELECT * FROM clients"));
}));

app.post("/api/clients", requireAdmin, h(async (req, res) => {
  const fields = req.body || {};
  if (!fields.name || !fields.email) return res.status(400).json({ error: "El nombre y el correo son obligatorios." });
  const initials = fields.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const client = { id: uid("usr"), name: fields.name.trim(), email: fields.email.trim(), initials, address: fields.address || "" };
  await query("INSERT INTO clients (id, name, email, initials, address) VALUES ($1,$2,$3,$4,$5)", [client.id, client.name, client.email, client.initials, client.address]);
  await logActivity(`Cliente ${client.name} añadido.`);
  res.status(201).json(client);
}));

/* =========================================================
   AGENTS
   ========================================================= */
app.get("/api/agents", requireAdmin, h(async (req, res) => {
  res.json(await query("SELECT * FROM agents"));
}));

app.post("/api/agents", requireAdmin, h(async (req, res) => {
  const fields = req.body || {};
  if (!fields.name || !fields.email) return res.status(400).json({ error: "El nombre y el correo son obligatorios." });
  const agent = { id: uid("agt"), name: fields.name, role: fields.role || "", email: fields.email, phone: fields.phone || "", status: fields.status || "Activo" };
  await query("INSERT INTO agents (id, name, role, email, phone, status) VALUES ($1,$2,$3,$4,$5,$6)", [agent.id, agent.name, agent.role, agent.email, agent.phone, agent.status]);
  await logActivity(`Agente ${agent.name} añadido al equipo.`);
  res.status(201).json(agent);
}));

app.put("/api/agents/:id", requireAdmin, h(async (req, res) => {
  const existing = await queryOne("SELECT * FROM agents WHERE id = $1", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Agente no encontrado" });
  const merged = { ...existing, ...req.body, id: existing.id };
  await query("UPDATE agents SET name=$1, role=$2, email=$3, phone=$4, status=$5 WHERE id=$6", [merged.name, merged.role, merged.email, merged.phone, merged.status, merged.id]);
  res.json(merged);
}));

app.delete("/api/agents/:id", requireAdmin, h(async (req, res) => {
  const existing = await queryOne("SELECT * FROM agents WHERE id = $1", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Agente no encontrado" });
  await query("DELETE FROM agents WHERE id = $1", [req.params.id]);
  await logActivity(`Agente ${existing.name} eliminado del equipo.`);
  res.json({ ok: true });
}));

app.get("/api/agents/:name/load", requireAdmin, h(async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const row = await queryOne(
    `SELECT COUNT(DISTINCT s.id)::int AS n
     FROM shipments s JOIN shipment_events e ON e.shipment_id = s.id
     WHERE e.agent = $1 AND s.current_step_index < $2`,
    [name, STEPS.length - 1]
  );
  res.json({ load: row ? row.n : 0 });
}));

/* =========================================================
   NOTIFICATIONS
   ========================================================= */
app.get("/api/notifications/mine", requireClient, h(async (req, res) => {
  const shipment = await queryOne("SELECT client_id FROM shipments WHERE tracking_id = $1", [req.trackingId]);
  if (!shipment) return res.json([]);
  const rows = await query("SELECT * FROM notifications WHERE audience = 'all' OR audience = $1 ORDER BY created_at DESC", [shipment.client_id]);
  res.json(rows.map(notifRow));
}));

app.get("/api/notifications/all", requireAdmin, h(async (req, res) => {
  res.json((await query("SELECT * FROM notifications ORDER BY created_at DESC")).map(notifRow));
}));

app.post("/api/notifications", requireAdmin, h(async (req, res) => {
  const fields = req.body || {};
  const notif = {
    id: uid("ntf"), title: fields.title, message: fields.message, audience: fields.audience, type: fields.type || "info",
    createdAt: nowISO(), sentAt: fields.scheduledAt ? null : nowISO(), scheduledAt: fields.scheduledAt || null, read: false,
  };
  await query(
    `INSERT INTO notifications (id, title, message, audience, type, created_at, sent_at, scheduled_at, read) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [notif.id, notif.title, notif.message, notif.audience, notif.type, notif.createdAt, notif.sentAt, notif.scheduledAt, notif.read]
  );
  const audienceLabel = fields.audience === "all" ? "todos los clientes" : "un cliente";
  await logActivity(`Notificación "${fields.title}" ${fields.scheduledAt ? "programada" : "enviada"} a ${audienceLabel}.`);
  res.status(201).json(notif);
}));

app.delete("/api/notifications/:id", requireAdmin, h(async (req, res) => {
  await query("DELETE FROM notifications WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

app.post("/api/notifications/:id/read", requireClient, h(async (req, res) => {
  await query("UPDATE notifications SET read = true WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

app.post("/api/notifications/mark-all-read", requireClient, h(async (req, res) => {
  const shipment = await queryOne("SELECT client_id FROM shipments WHERE tracking_id = $1", [req.trackingId]);
  if (shipment) await query("UPDATE notifications SET read = true WHERE audience = 'all' OR audience = $1", [shipment.client_id]);
  res.json({ ok: true });
}));

/* =========================================================
   SETTINGS (branding — lecture publique, écriture admin)
   ========================================================= */
async function currentSettings() {
  const row = await queryOne("SELECT * FROM settings WHERE id = 1");
  return {
    platformName: row.platform_name, tagline: row.tagline, primaryColor: row.primary_color,
    footerText: row.footer_text, supportEmail: row.support_email, supportPhone: row.support_phone,
  };
}

app.get("/api/settings", h(async (req, res) => {
  res.json(await currentSettings());
}));

app.put("/api/settings", requireAdmin, h(async (req, res) => {
  const merged = { ...(await currentSettings()), ...(req.body || {}) };
  await query(
    `UPDATE settings SET platform_name=$1, tagline=$2, primary_color=$3, footer_text=$4, support_email=$5, support_phone=$6 WHERE id = 1`,
    [merged.platformName, merged.tagline, merged.primaryColor, merged.footerText, merged.supportEmail, merged.supportPhone]
  );
  await logActivity("Configuración global de la plataforma actualizada.");
  res.json(merged);
}));

/* =========================================================
   JOURNAL D'ACTIVITÉ
   ========================================================= */
app.get("/api/activity-log", requireAdmin, h(async (req, res) => {
  res.json(await query("SELECT * FROM activity_log ORDER BY date DESC LIMIT 100"));
}));

app.post("/api/activity-log", requireAdmin, h(async (req, res) => {
  const { text, actor } = req.body || {};
  await logActivity(text, actor || "Administrador Nexura");
  res.status(201).json({ ok: true });
}));

/* =========================================================
   STATISTIQUES
   ========================================================= */
app.get("/api/stats", requireAdmin, h(async (req, res) => {
  const shipments = await query("SELECT current_step_index, delayed FROM shipments");
  const total = shipments.length;
  const production = shipments.filter((s) => s.current_step_index >= 1 && s.current_step_index <= 3).length;
  const shipped = shipments.filter((s) => s.current_step_index >= 5 && s.current_step_index <= 6).length;
  const inTransit = shipments.filter((s) => s.current_step_index >= 6 && s.
