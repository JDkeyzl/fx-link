const { openDb, initSchema } = require("./db");

let db;

const DEFAULT_USD_CNY_RATE = 7.2;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Statuses where quote lines cannot be edited. */
const LOCKED_QUOTE_STATUSES = new Set(["pending_review", "approved", "confirmed"]);

function isQuoteLocked(status) {
  return LOCKED_QUOTE_STATUSES.has(String(status || ""));
}

function getDeskDb() {
  if (!db) {
    db = openDb();
    initSchema(db);
    db.exec(`
      CREATE TABLE IF NOT EXISTS desk_sessions (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        requirements_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS desk_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_trace_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (session_id) REFERENCES desk_sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_desk_messages_session
        ON desk_messages(session_id, id);

      CREATE TABLE IF NOT EXISTS desk_quotes (
        session_id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'draft',
        usd_cny_rate REAL,
        confirmed_at TEXT,
        submitted_at TEXT,
        reviewed_at TEXT,
        review_note TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (session_id) REFERENCES desk_sessions(id)
      );
      CREATE TABLE IF NOT EXISTS desk_quote_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        part_no TEXT NOT NULL,
        brand TEXT,
        name_en TEXT,
        name_ch TEXT,
        qty REAL NOT NULL,
        unit_price_cny REAL NOT NULL,
        unit_price_usd REAL NOT NULL,
        UNIQUE(session_id, part_no),
        FOREIGN KEY (session_id) REFERENCES desk_sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_desk_quote_lines_session
        ON desk_quote_lines(session_id);

      CREATE TABLE IF NOT EXISTS desk_contacts (
        session_id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        company TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (session_id) REFERENCES desk_sessions(id)
      );
    `);

    migrateQuoteColumns(db);
    db.prepare(
      `UPDATE desk_quotes SET status = 'approved' WHERE status = 'confirmed'`
    ).run();
  }
  return db;
}

function migrateQuoteColumns(database) {
  const cols = database
    .prepare(`PRAGMA table_info(desk_quotes)`)
    .all()
    .map((c) => c.name);
  const add = (name, type) => {
    if (!cols.includes(name)) {
      database.exec(`ALTER TABLE desk_quotes ADD COLUMN ${name} ${type}`);
    }
  };
  add("submitted_at", "TEXT");
  add("reviewed_at", "TEXT");
  add("review_note", "TEXT");
}

function createSession() {
  const id = `desk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  getDeskDb()
    .prepare(`INSERT INTO desk_sessions (id) VALUES (?)`)
    .run(id);
  return { id, requirements: {} };
}

function getSession(sessionId) {
  const row = getDeskDb()
    .prepare(`SELECT id, requirements_json FROM desk_sessions WHERE id = ?`)
    .get(sessionId);
  if (!row) return null;
  let requirements = {};
  try {
    requirements = JSON.parse(row.requirements_json || "{}");
  } catch {
    requirements = {};
  }
  return { id: row.id, requirements };
}

function touchSession(sessionId) {
  getDeskDb()
    .prepare(
      `UPDATE desk_sessions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    )
    .run(sessionId);
}

function saveRequirements(sessionId, requirements) {
  getDeskDb()
    .prepare(
      `UPDATE desk_sessions
       SET requirements_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    )
    .run(JSON.stringify(requirements || {}), sessionId);
}

function appendMessage(sessionId, role, content, toolTrace = null) {
  getDeskDb()
    .prepare(
      `INSERT INTO desk_messages (session_id, role, content, tool_trace_json)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      sessionId,
      role,
      content,
      toolTrace ? JSON.stringify(toolTrace) : null
    );
  touchSession(sessionId);
}

function listMessages(sessionId, limit = 40) {
  const rows = getDeskDb()
    .prepare(
      `SELECT role, content, tool_trace_json, created_at
       FROM desk_messages
       WHERE session_id = ?
       ORDER BY id ASC
       LIMIT ?`
    )
    .all(sessionId, limit);
  return rows.map((r) => ({
    role: r.role,
    content: r.content,
    toolTrace: r.tool_trace_json ? JSON.parse(r.tool_trace_json) : null,
    createdAt: r.created_at,
  }));
}

function readAppUsdCnyRate() {
  const row = getDeskDb()
    .prepare(`SELECT value FROM app_settings WHERE key = 'usd_cny_rate' LIMIT 1`)
    .get();
  const rate = Number.parseFloat(String(row?.value ?? String(DEFAULT_USD_CNY_RATE)));
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_CNY_RATE;
}

function ensureQuoteDraft(sessionId, usdCnyRate) {
  const existing = getDeskDb()
    .prepare(`SELECT session_id, status FROM desk_quotes WHERE session_id = ?`)
    .get(sessionId);
  if (existing) return existing;
  const rate = usdCnyRate ?? readAppUsdCnyRate();
  getDeskDb()
    .prepare(
      `INSERT INTO desk_quotes (session_id, status, usd_cny_rate, updated_at)
       VALUES (?, 'draft', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
    )
    .run(sessionId, rate);
  return { session_id: sessionId, status: "draft" };
}

function emptyContact() {
  return {
    name: "",
    email: "",
    phone: "",
    company: "",
    updated_at: null,
  };
}

function getContact(sessionId) {
  if (!getSession(sessionId)) return null;
  const row = getDeskDb()
    .prepare(
      `SELECT name, email, phone, company, updated_at
       FROM desk_contacts WHERE session_id = ?`
    )
    .get(sessionId);
  if (!row) return emptyContact();
  return {
    name: row.name || "",
    email: row.email || "",
    phone: row.phone || "",
    company: row.company || "",
    updated_at: row.updated_at || null,
  };
}

function contactHintFromFields(fields) {
  const parts = [];
  if (fields.name) parts.push(fields.name);
  if (fields.email) parts.push(fields.email);
  if (fields.phone) parts.push(fields.phone);
  if (fields.company) parts.push(fields.company);
  return parts.join(" · ").slice(0, 500);
}

function normalizeContactInput(input) {
  const name = String(input?.name ?? "").trim().slice(0, 120);
  const email = String(input?.email ?? "").trim().slice(0, 200).toLowerCase();
  const phone = String(input?.phone ?? "").trim().slice(0, 80);
  const company = String(input?.company ?? "").trim().slice(0, 160);
  return { name, email, phone, company };
}

function isValidEmail(email) {
  return Boolean(email) && EMAIL_RE.test(email);
}

function upsertContact(sessionId, input, { merge = true } = {}) {
  if (!getSession(sessionId)) {
    return { ok: false, error: "session not found" };
  }
  const incoming = normalizeContactInput(input);
  const prev = getContact(sessionId) || emptyContact();

  const next = merge
    ? {
        name: input?.name !== undefined ? incoming.name : prev.name,
        email: input?.email !== undefined ? incoming.email : prev.email,
        phone: input?.phone !== undefined ? incoming.phone : prev.phone,
        company: input?.company !== undefined ? incoming.company : prev.company,
      }
    : incoming;

  if (next.email && !isValidEmail(next.email)) {
    return { ok: false, error: "Invalid email format" };
  }

  getDeskDb()
    .prepare(
      `INSERT INTO desk_contacts (session_id, name, email, phone, company, updated_at)
       VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(session_id) DO UPDATE SET
         name = excluded.name,
         email = excluded.email,
         phone = excluded.phone,
         company = excluded.company,
         updated_at = excluded.updated_at`
    )
    .run(
      sessionId,
      next.name || null,
      next.email || null,
      next.phone || null,
      next.company || null
    );

  const session = getSession(sessionId);
  const requirements = { ...(session?.requirements || {}) };
  const hint = contactHintFromFields(next);
  if (hint) requirements.contact_hint = hint;
  else delete requirements.contact_hint;
  saveRequirements(sessionId, requirements);
  touchSession(sessionId);

  return {
    ok: true,
    contact: getContact(sessionId),
    requirements,
  };
}

function emptyQuote(sessionId) {
  return {
    sessionId,
    status: "draft",
    usd_cny_rate: readAppUsdCnyRate(),
    confirmed_at: null,
    submitted_at: null,
    reviewed_at: null,
    review_note: null,
    lines: [],
    totals: { cny: 0, usd: 0, line_count: 0 },
  };
}

function getQuote(sessionId) {
  if (!getSession(sessionId)) return null;
  const header = getDeskDb()
    .prepare(
      `SELECT session_id, status, usd_cny_rate, confirmed_at,
              submitted_at, reviewed_at, review_note, updated_at
       FROM desk_quotes WHERE session_id = ?`
    )
    .get(sessionId);
  if (!header) return emptyQuote(sessionId);

  const lines = getDeskDb()
    .prepare(
      `SELECT id, part_no, brand, name_en, name_ch, qty,
              unit_price_cny, unit_price_usd
       FROM desk_quote_lines
       WHERE session_id = ?
       ORDER BY id ASC`
    )
    .all(sessionId)
    .map((r) => {
      const qty = Number(r.qty) || 0;
      const cny = Number(r.unit_price_cny) || 0;
      const usd = Number(r.unit_price_usd) || 0;
      return {
        id: r.id,
        part_no: r.part_no,
        brand: r.brand,
        name_en: r.name_en,
        name_ch: r.name_ch,
        qty,
        unit_price_cny: cny,
        unit_price_usd: usd,
        line_total_cny: Number((qty * cny).toFixed(2)),
        line_total_usd: Number((qty * usd).toFixed(2)),
      };
    });

  const totals = lines.reduce(
    (acc, line) => {
      acc.cny += line.line_total_cny;
      acc.usd += line.line_total_usd;
      acc.line_count += 1;
      return acc;
    },
    { cny: 0, usd: 0, line_count: 0 }
  );

  let status = header.status || "draft";
  if (status === "confirmed") status = "approved";

  return {
    sessionId,
    status,
    usd_cny_rate: Number(header.usd_cny_rate) || readAppUsdCnyRate(),
    confirmed_at: header.confirmed_at || null,
    submitted_at: header.submitted_at || null,
    reviewed_at: header.reviewed_at || null,
    review_note: header.review_note || null,
    updated_at: header.updated_at || null,
    lines,
    totals: {
      cny: Number(totals.cny.toFixed(2)),
      usd: Number(totals.usd.toFixed(2)),
      line_count: totals.line_count,
    },
  };
}

function upsertQuoteLine(sessionId, line) {
  if (!getSession(sessionId)) {
    return { ok: false, error: "session not found" };
  }
  const header = ensureQuoteDraft(sessionId);
  if (isQuoteLocked(header.status)) {
    return {
      ok: false,
      error:
        "Quote is locked (pending review or approved). Start a new chat to draft again.",
    };
  }

  const partNo = String(line.part_no || "").trim();
  const qty = Number(line.qty);
  if (!partNo) return { ok: false, error: "part_no required" };
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, error: "qty must be a positive number" };
  }

  const rate = readAppUsdCnyRate();
  const unitCny = Number(line.unit_price_cny);
  const unitUsd = Number(line.unit_price_usd);
  if (!Number.isFinite(unitCny) || unitCny < 0) {
    return { ok: false, error: "unit_price_cny invalid" };
  }

  getDeskDb()
    .prepare(
      `UPDATE desk_quotes
       SET usd_cny_rate = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE session_id = ? AND status IN ('draft', 'rejected')`
    )
    .run(rate, sessionId);

  getDeskDb()
    .prepare(
      `INSERT INTO desk_quote_lines
        (session_id, part_no, brand, name_en, name_ch, qty, unit_price_cny, unit_price_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, part_no) DO UPDATE SET
         brand = excluded.brand,
         name_en = excluded.name_en,
         name_ch = excluded.name_ch,
         qty = excluded.qty,
         unit_price_cny = excluded.unit_price_cny,
         unit_price_usd = excluded.unit_price_usd`
    )
    .run(
      sessionId,
      partNo,
      line.brand || null,
      line.name_en || null,
      line.name_ch || null,
      qty,
      Number(unitCny.toFixed(2)),
      Number.isFinite(unitUsd)
        ? Number(unitUsd.toFixed(2))
        : Number((unitCny / rate).toFixed(2))
    );

  touchSession(sessionId);
  return { ok: true, quote: getQuote(sessionId) };
}

function removeQuoteLine(sessionId, partNo) {
  if (!getSession(sessionId)) {
    return { ok: false, error: "session not found" };
  }
  const header = getDeskDb()
    .prepare(`SELECT status FROM desk_quotes WHERE session_id = ?`)
    .get(sessionId);
  if (isQuoteLocked(header?.status)) {
    return { ok: false, error: "Quote is locked." };
  }
  const key = String(partNo || "").trim();
  if (!key) return { ok: false, error: "part_no required" };

  const info = getDeskDb()
    .prepare(`DELETE FROM desk_quote_lines WHERE session_id = ? AND part_no = ?`)
    .run(sessionId, key);
  if (info.changes === 0) {
    return { ok: false, error: "line not found" };
  }
  getDeskDb()
    .prepare(
      `UPDATE desk_quotes
       SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE session_id = ?`
    )
    .run(sessionId);
  touchSession(sessionId);
  return { ok: true, quote: getQuote(sessionId) };
}

/** @deprecated Prefer submitQuoteForReview */
function confirmQuote(sessionId) {
  return submitQuoteForReview(sessionId);
}

function submitQuoteForReview(sessionId) {
  if (!getSession(sessionId)) {
    return { ok: false, error: "session not found" };
  }
  ensureQuoteDraft(sessionId);
  const quote = getQuote(sessionId);
  if (!quote.lines.length) {
    return { ok: false, error: "Cannot submit an empty quote." };
  }
  if (quote.status === "pending_review") {
    return { ok: true, quote, already: true };
  }
  if (quote.status === "approved") {
    return { ok: false, error: "Quote already approved." };
  }
  if (quote.status !== "draft" && quote.status !== "rejected") {
    return { ok: false, error: `Cannot submit from status ${quote.status}` };
  }

  const contact = getContact(sessionId);
  if (!contact?.email || !isValidEmail(contact.email)) {
    return {
      ok: false,
      error: "A valid email is required before submitting for review.",
    };
  }

  getDeskDb()
    .prepare(
      `UPDATE desk_quotes
       SET status = 'pending_review',
           submitted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
           reviewed_at = NULL,
           review_note = NULL,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE session_id = ?`
    )
    .run(sessionId);
  touchSession(sessionId);
  return { ok: true, quote: getQuote(sessionId), contact };
}

function reviewQuote(sessionId, { decision, note } = {}) {
  if (!getSession(sessionId)) {
    return { ok: false, error: "session not found" };
  }
  const quote = getQuote(sessionId);
  if (!quote || quote.status !== "pending_review") {
    return {
      ok: false,
      error: "Only quotes pending review can be decided.",
    };
  }
  const d = String(decision || "").toLowerCase();
  if (d !== "approved" && d !== "rejected") {
    return { ok: false, error: "decision must be approved or rejected" };
  }
  const reviewNote = String(note || "").trim().slice(0, 1000) || null;

  if (d === "approved") {
    getDeskDb()
      .prepare(
        `UPDATE desk_quotes
         SET status = 'approved',
             confirmed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             review_note = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE session_id = ?`
      )
      .run(reviewNote, sessionId);
  } else {
    getDeskDb()
      .prepare(
        `UPDATE desk_quotes
         SET status = 'rejected',
             reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             review_note = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE session_id = ?`
      )
      .run(reviewNote, sessionId);
  }
  touchSession(sessionId);
  return {
    ok: true,
    quote: getQuote(sessionId),
    contact: getContact(sessionId),
  };
}

function listLeadsForReview({ status, q, limit = 50, offset = 0 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);
  const params = [];
  let where = `WHERE q.session_id IS NOT NULL`;

  if (status && status !== "all") {
    where += ` AND q.status = ?`;
    params.push(String(status));
  } else {
    where += ` AND q.status IN ('pending_review', 'approved', 'rejected')`;
  }

  const query = String(q || "").trim().slice(0, 120);
  if (query) {
    where += ` AND (
      IFNULL(c.email, '') LIKE ? OR
      IFNULL(c.name, '') LIKE ? OR
      IFNULL(c.phone, '') LIKE ? OR
      IFNULL(c.company, '') LIKE ? OR
      q.session_id LIKE ?
    )`;
    const like = `%${query}%`;
    params.push(like, like, like, like, like);
  }

  const rows = getDeskDb()
    .prepare(
      `SELECT
         q.session_id AS session_id,
         q.status AS status,
         q.submitted_at AS submitted_at,
         q.reviewed_at AS reviewed_at,
         q.review_note AS review_note,
         q.updated_at AS updated_at,
         q.usd_cny_rate AS usd_cny_rate,
         c.name AS name,
         c.email AS email,
         c.phone AS phone,
         c.company AS company,
         (SELECT COUNT(*) FROM desk_quote_lines l WHERE l.session_id = q.session_id) AS line_count,
         (SELECT IFNULL(SUM(l.qty * l.unit_price_cny), 0) FROM desk_quote_lines l WHERE l.session_id = q.session_id) AS total_cny,
         (SELECT IFNULL(SUM(l.qty * l.unit_price_usd), 0) FROM desk_quote_lines l WHERE l.session_id = q.session_id) AS total_usd
       FROM desk_quotes q
       LEFT JOIN desk_contacts c ON c.session_id = q.session_id
       LEFT JOIN desk_sessions s ON s.id = q.session_id
       ${where}
       ORDER BY
         CASE q.status WHEN 'pending_review' THEN 0 ELSE 1 END,
         IFNULL(q.submitted_at, q.updated_at) DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, lim, off);

  return {
    items: rows.map((r) => ({
      sessionId: r.session_id,
      status: r.status === "confirmed" ? "approved" : r.status,
      submitted_at: r.submitted_at,
      reviewed_at: r.reviewed_at,
      review_note: r.review_note,
      updated_at: r.updated_at,
      usd_cny_rate: Number(r.usd_cny_rate) || readAppUsdCnyRate(),
      contact: {
        name: r.name || "",
        email: r.email || "",
        phone: r.phone || "",
        company: r.company || "",
      },
      totals: {
        cny: Number(Number(r.total_cny || 0).toFixed(2)),
        usd: Number(Number(r.total_usd || 0).toFixed(2)),
        line_count: Number(r.line_count) || 0,
      },
    })),
    limit: lim,
    offset: off,
  };
}

function getLeadDetail(sessionId) {
  const session = getSession(sessionId);
  if (!session) return null;
  return {
    sessionId: session.id,
    requirements: session.requirements,
    contact: getContact(sessionId),
    quote: getQuote(sessionId),
    messages: listMessages(sessionId, 40),
  };
}

module.exports = {
  getDeskDb,
  createSession,
  getSession,
  saveRequirements,
  appendMessage,
  listMessages,
  getQuote,
  upsertQuoteLine,
  removeQuoteLine,
  confirmQuote,
  submitQuoteForReview,
  reviewQuote,
  getContact,
  upsertContact,
  listLeadsForReview,
  getLeadDetail,
  isValidEmail,
  isQuoteLocked,
  readAppUsdCnyRate,
  DEFAULT_USD_CNY_RATE,
};
