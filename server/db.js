/**
 * db.js — couche base de données SQL (PostgreSQL via `pg`).
 * ------------------------------------------------------------------
 * Fonctionne avec n'importe quel PostgreSQL accessible via une
 * connection string standard (`DATABASE_URL`) : Neon, Supabase,
 * Render Postgres, un serveur auto-hébergé, etc.
 *
 * Toutes les fonctions exportées sont asynchrones (le driver `pg`
 * est asynchrone par nature) — voir server.js qui les attend
 * (`await`) partout.
 * ------------------------------------------------------------------
 */
const crypto = require("crypto");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("ERREUR : la variable d'environnement DATABASE_URL n'est pas définie.");
  console.error("Exemple : postgres://user:password@host/dbname?sslmode=require");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}
async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}

/* =========================================================
   CONSTANTES PARTAGÉES (mêmes valeurs que côté front-end)
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

const STEP_COMMENTS = {
  request_received: "Solicitud registrada en el sistema Nexura.",
  identity_verification: "Documentos de identidad validados por el equipo de cumplimiento.",
  card_production: "Tarjeta en proceso de personalización en fábrica segura.",
  card_printed: "Impresión finalizada, control de calidad realizado.",
  packaging: "Tarjeta sellada en un sobre seguro antifraude.",
  shipped: "Paquete entregado al transportista asociado.",
  in_transit: "Paquete en camino hacia el centro regional.",
  local_distribution: "Llegada al centro de distribución local.",
  out_for_delivery: "El repartidor va camino a la dirección del cliente.",
  delivered: "Paquete entregado en mano al cliente.",
};

const CARD_TYPES = ["Nexura Classic Débito", "Nexura Gold Débito", "Nexura World Elite", "Nexura Tarjeta Virtual"];

/* =========================================================
   UTILITAIRES
   ========================================================= */
function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}
function generateTrackingId() {
  const part = () => crypto.randomBytes(3).toString("hex").toUpperCase();
  return `NX-CARD-${part()}${part()}`;
}
function nowISO() {
  return new Date().toISOString();
}
function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(check, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* =========================================================
   SCHÉMA SQL
   ========================================================= */
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      initials TEXT,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      email TEXT,
      phone TEXT,
      status TEXT DEFAULT 'Activo'
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      tracking_id TEXT UNIQUE NOT NULL,
      client_id TEXT REFERENCES clients(id),
      client_name TEXT,
      client_email TEXT,
      client_initials TEXT,
      shipping_address TEXT,
      card_type TEXT,
      current_step_index INTEGER DEFAULT 0,
      status TEXT,
      delayed BOOLEAN DEFAULT FALSE,
      agent TEXT,
      created_at TEXT,
      estimated_delivery TEXT,
      last_update TEXT
    );

    CREATE TABLE IF NOT EXISTS shipment_events (
      id SERIAL PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      step_index INTEGER,
      step_key TEXT,
      date TEXT,
      agent TEXT,
      comment TEXT,
      status TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_shipment ON shipment_events(shipment_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT,
      message TEXT,
      audience TEXT,
      type TEXT,
      created_at TEXT,
      sent_at TEXT,
      scheduled_at TEXT,
      read BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      platform_name TEXT,
      tagline TEXT,
      primary_color TEXT,
      footer_text TEXT,
      support_email TEXT,
      support_phone TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      date TEXT,
      actor TEXT,
      text TEXT
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      created_at TEXT
    );
  `);
}

/* =========================================================
   SEED — données de démonstration (une seule fois, si la base
   est vide)
   ========================================================= */
async function buildEvents(stepIdx, createdISO) {
  const events = [];
  let cursor = new Date(createdISO);
  for (let step = 0; step <= stepIdx; step++) {
    events.push({
      stepIndex: step,
      stepKey: STEPS[step].key,
      date: cursor.toISOString(),
      status: step < stepIdx ? "done" : "current",
    });
    cursor = new Date(cursor.getTime() + (6 + Math.random() * 20) * 3600 * 1000);
  }
  return events;
}

async function seedIfEmpty() {
  const { count } = await queryOne("SELECT COUNT(*)::int AS count FROM shipments");
  if (count > 0) return;

  const agents = [
    { id: "agt_001", name: "Sofia Marchetti", role: "Agente de verificación", email: "sofia.marchetti@nexura.app", phone: "+1 (305) 555-0110", status: "Activo" },
    { id: "agt_002", name: "Karim Bensalem", role: "Responsable de producción", email: "karim.bensalem@nexura.app", phone: "+1 (305) 555-0121", status: "Activo" },
    { id: "agt_003", name: "Elena Kovač", role: "Agente de logística", email: "elena.kovac@nexura.app", phone: "+1 (786) 555-0134", status: "Activo" },
    { id: "agt_004", name: "Marcus Webb", role: "Mensajero regional", email: "marcus.webb@nexura.app", phone: "+1 (786) 555-0145", status: "Activo" },
    { id: "agt_005", name: "Priya Nandan", role: "Soporte al cliente", email: "priya.nandan@nexura.app", phone: "+1 (954) 555-0158", status: "Inactivo" },
  ];
  const agentNames = agents.map((a) => a.name);

  const clients = [
    { id: "usr_001", name: "Camila Herrera", email: "camila.herrera@nexura.app", initials: "CH", address: "1420 Ocean Drive, Miami, FL" },
    { id: "usr_002", name: "Mateo Rojas", email: "mateo.rojas@nexura.app", initials: "MR", address: "88 Palm Avenue, Orlando, FL" },
    { id: "usr_003", name: "Lucía Fernández", email: "lucia.fernandez@nexura.app", initials: "LF", address: "212 Bayfront St, Tampa, FL" },
    { id: "usr_004", name: "Noah Bennett", email: "noah.bennett@nexura.app", initials: "NB", address: "77 Harbor Road, Fort Lauderdale, FL" },
  ];

  for (const a of agents) {
    await pool.query(
      `INSERT INTO agents (id, name, role, email, phone, status) VALUES ($1,$2,$3,$4,$5,$6)`,
      [a.id, a.name, a.role, a.email, a.phone, a.status]
    );
  }
  for (const c of clients) {
    await pool.query(
      `INSERT INTO clients (id, name, email, initials, address) VALUES ($1,$2,$3,$4,$5)`,
      [c.id, c.name, c.email, c.initials, c.address]
    );
  }

  const base = new Date();
  base.setDate(base.getDate() - 9);

  const defs = [
    { client: clients[0], stepIdx: 2, delayed: false, cardType: CARD_TYPES[0] },
    { client: clients[1], stepIdx: 5, delayed: false, cardType: CARD_TYPES[1] },
    { client: clients[2], stepIdx: 6, delayed: true, cardType: CARD_TYPES[2] },
    { client: clients[3], stepIdx: 9, delayed: false, cardType: CARD_TYPES[0] },
    { client: clients[0], stepIdx: 8, delayed: false, cardType: CARD_TYPES[3] },
    { client: clients[1], stepIdx: 1, delayed: false, cardType: CARD_TYPES[0] },
  ];

  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const created = addDays(base.toISOString(), i * 0.6);
    const shipmentId = uid("shp");
    const trackingId = generateTrackingId();
    const events = await buildEvents(d.stepIdx, created);
    const lastDate = events[events.length - 1].date;

    // La ligne "shipments" doit exister AVANT ses "shipment_events"
    // (contrainte de clé étrangère).
    await pool.query(
      `INSERT INTO shipments (id, tracking_id, client_id, client_name, client_email, client_initials, shipping_address, card_type, current_step_index, status, delayed, agent, created_at, estimated_delivery, last_update)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        shipmentId, trackingId, d.client.id, d.client.name, d.client.email, d.client.initials, d.client.address,
        d.cardType, d.stepIdx, d.stepIdx === 9 ? "Entregada" : d.delayed ? "Retrasada" : "En curso", d.delayed,
        agentNames[d.stepIdx % agentNames.length], created, addDays(created, 10), lastDate,
      ]
    );
    for (const e of events) {
      await pool.query(
        `INSERT INTO shipment_events (shipment_id, step_index, step_key, date, agent, comment, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [shipmentId, e.stepIndex, e.stepKey, e.date, agentNames[e.stepIndex % agentNames.length], STEP_COMMENTS[STEPS[e.stepIndex].key] || "", e.status]
      );
    }
  }

  await pool.query(
    `INSERT INTO settings (id, platform_name, tagline, primary_color, footer_text, support_email, support_phone)
     VALUES (1,$1,$2,$3,$4,$5,$6)`,
    [
      "Nexura Card Delivery", "Track Your Card. Anytime. Anywhere.", "#8452d9",
      "© 2026 Nexura Card Delivery. Plataforma de seguimiento logístico — sin datos bancarios reales.",
      "support@nexura-cards.app", "+1 (800) 555-0199",
    ]
  );

  await pool.query(
    `INSERT INTO activity_log (id, date, actor, text) VALUES ($1,$2,$3,$4)`,
    [uid("log"), nowISO(), "Sistema", "Base de datos inicializada con datos de demostración."]
  );

  // Compte admin par défaut — configurable via ADMIN_EMAIL / ADMIN_PASSWORD.
  // !! À changer avant tout déploiement public !!
  const adminEmail = process.env.ADMIN_EMAIL || "admin@nexura.app";
  const adminPassword = process.env.ADMIN_PASSWORD || "Eur@059535";
  await pool.query(
    `INSERT INTO admins (id, name, email, password_hash) VALUES ($1,$2,$3,$4)`,
    [uid("admin"), "Administrador Nexura", adminEmail, hashPassword(adminPassword)]
  );
}

async function init() {
  await initSchema();
  await seedIfEmpty();
}

module.exports = {
  pool, query, queryOne, init,
  STEPS, STEP_COMMENTS, CARD_TYPES,
  uid, generateTrackingId, nowISO, addDays,
  hashPassword, verifyPassword,
};
