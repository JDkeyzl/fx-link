const express = require("express");
const { runDeskTurn, MAX_MESSAGE_CHARS } = require("../desk-agent");
const {
  createSession,
  getSession,
  listMessages,
  getQuote,
  getContact,
  upsertContact,
  removeQuoteLine,
  submitQuoteForReview,
  reviewQuote,
  listLeadsForReview,
  getLeadDetail,
} = require("../desk-db");
const { ragStatus, ingestKnowledgeDir } = require("../desk-rag");

const router = express.Router();

/** Simple in-memory rate limit per IP for chat (production-safe default on single node). */
const chatHits = new Map();
const CHAT_LIMIT = Number(process.env.DESK_CHAT_RATE_LIMIT || 30);
const CHAT_WINDOW_MS = Number(process.env.DESK_CHAT_RATE_WINDOW_MS || 60_000);

function rateLimitChat(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  let bucket = chatHits.get(ip);
  if (!bucket || now - bucket.start > CHAT_WINDOW_MS) {
    bucket = { start: now, count: 0 };
    chatHits.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > CHAT_LIMIT) {
    return res.status(429).json({
      error: "Too many requests",
      message: "Please wait a moment before sending more desk messages.",
    });
  }
  return next();
}

function requireDeskAdmin(req, res) {
  const key = req.headers["x-admin-upload-key"] || req.headers["x-admin-key"];
  const expected =
    process.env.ADMIN_UPLOAD_KEY ||
    process.env.ADMIN_TRANSLATION_KEY ||
    "";
  if (!expected || key !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/api/desk/health", (_req, res) => {
  const llmConfigured = Boolean(
    process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY
  );
  return res.json({
    ok: true,
    llmConfigured,
    rag: ragStatus(),
    maxMessageChars: MAX_MESSAGE_CHARS,
  });
});

router.post("/api/desk/session", (_req, res) => {
  try {
    const session = createSession();
    return res.json({
      sessionId: session.id,
      requirements: {},
      messages: [],
      quote: getQuote(session.id),
      contact: getContact(session.id),
    });
  } catch (err) {
    console.error("POST /api/desk/session", err);
    return res.status(500).json({ error: "Failed to create session" });
  }
});

router.get("/api/desk/session/:id", (req, res) => {
  const id = String(req.params.id || "").slice(0, 80);
  const session = getSession(id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  return res.json({
    sessionId: session.id,
    requirements: session.requirements,
    messages: listMessages(session.id, 80),
    quote: getQuote(session.id),
    contact: getContact(session.id),
    rag: ragStatus(),
  });
});

router.post("/api/desk/knowledge/reindex", async (req, res) => {
  if (!requireDeskAdmin(req, res)) return;
  try {
    const result = await ingestKnowledgeDir();
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("reindex knowledge", err);
    return res.status(500).json({
      error: "Reindex failed",
      message: err instanceof Error ? err.message : "Unknown",
    });
  }
});

router.post("/api/desk/contact", (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "").slice(0, 80);
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }
    const result = upsertContact(
      sessionId,
      {
        name: req.body?.name,
        email: req.body?.email,
        phone: req.body?.phone,
        company: req.body?.company,
      },
      { merge: false }
    );
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({
      ok: true,
      contact: result.contact,
      requirements: result.requirements,
      quote: getQuote(sessionId),
    });
  } catch (err) {
    console.error("POST /api/desk/contact", err);
    return res.status(500).json({ error: "Save contact failed" });
  }
});

router.post("/api/desk/quote/submit", (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "").slice(0, 80);
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }
    const result = submitQuoteForReview(sessionId);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result);
  } catch (err) {
    console.error("POST /api/desk/quote/submit", err);
    return res.status(500).json({ error: "Submit failed" });
  }
});

/** Legacy alias → submit for review */
router.post("/api/desk/quote/confirm", (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "").slice(0, 80);
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }
    const result = submitQuoteForReview(sessionId);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result);
  } catch (err) {
    console.error("POST /api/desk/quote/confirm", err);
    return res.status(500).json({ error: "Confirm failed" });
  }
});

router.post("/api/desk/quote/line/remove", (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "").slice(0, 80);
    const partNo = String(req.body?.part_no || "").trim();
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }
    if (!partNo) {
      return res.status(400).json({ error: "part_no required" });
    }
    const result = removeQuoteLine(sessionId, partNo);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result);
  } catch (err) {
    console.error("POST /api/desk/quote/line/remove", err);
    return res.status(500).json({ error: "Remove line failed" });
  }
});

router.get("/api/desk/review/leads", (req, res) => {
  if (!requireDeskAdmin(req, res)) return;
  try {
    const result = listLeadsForReview({
      status: req.query.status,
      q: req.query.q,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("GET /api/desk/review/leads", err);
    return res.status(500).json({ error: "List leads failed" });
  }
});

router.get("/api/desk/review/leads/:sessionId", (req, res) => {
  if (!requireDeskAdmin(req, res)) return;
  try {
    const sessionId = String(req.params.sessionId || "").slice(0, 80);
    const detail = getLeadDetail(sessionId);
    if (!detail) return res.status(404).json({ error: "Session not found" });
    return res.json({ ok: true, ...detail });
  } catch (err) {
    console.error("GET /api/desk/review/leads/:id", err);
    return res.status(500).json({ error: "Lead detail failed" });
  }
});

router.post("/api/desk/review/leads/:sessionId", (req, res) => {
  if (!requireDeskAdmin(req, res)) return;
  try {
    const sessionId = String(req.params.sessionId || "").slice(0, 80);
    const result = reviewQuote(sessionId, {
      decision: req.body?.decision,
      note: req.body?.note,
    });
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result);
  } catch (err) {
    console.error("POST /api/desk/review/leads/:id", err);
    return res.status(500).json({ error: "Review decision failed" });
  }
});

router.post("/api/desk/chat", rateLimitChat, async (req, res) => {
  try {
    const message = req.body?.message;
    const sessionId = req.body?.sessionId || null;
    const result = await runDeskTurn({ sessionId, message });
    return res.json(result);
  } catch (err) {
    console.error("POST /api/desk/chat", err);
    if (err.code === "LLM_CONFIG") {
      return res.status(503).json({
        error: "LLM not configured",
        message: err.message,
      });
    }
    if (err.code === "BAD_REQUEST") {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === "TIMEOUT") {
      return res.status(504).json({
        error: "Gateway Timeout",
        message: err.message,
      });
    }
    return res.status(500).json({
      error: "Desk chat failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

module.exports = router;
