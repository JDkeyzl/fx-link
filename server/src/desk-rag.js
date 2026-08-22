const fs = require("fs");
const path = require("path");
const { getDeskDb } = require("./desk-db");

const DEFAULT_KNOWLEDGE_DIR = path.join(__dirname, "..", "data", "knowledge");
const EMBED_DIM = Number(process.env.RAG_EMBED_DIM || 256);

function ensureRagSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS desk_knowledge_chunks (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      embedding_json TEXT,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  // FTS may already exist from a previous ingest.
  const fts = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='desk_knowledge_fts'`
    )
    .get();
  if (!fts) {
    db.exec(`
      CREATE VIRTUAL TABLE desk_knowledge_fts USING fts5(
        id UNINDEXED,
        title,
        body,
        tokenize = 'unicode61'
      );
    `);
  }
}

function splitMarkdownChunks(raw, sourceFile) {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const parts = text.split(/\n(?=##\s+)/);
  const chunks = [];
  for (let i = 0; i < parts.length; i += 1) {
    const block = parts[i].trim();
    if (!block) continue;
    const titleMatch = block.match(/^#\s+(.+)$/m) || block.match(/^##\s+(.+)$/m);
    const title = (titleMatch?.[1] || path.basename(sourceFile, ".md")).trim();
    // Keep chunks reasonably small for retrieval context.
    if (block.length <= 1800) {
      chunks.push({ title, body: block, source: sourceFile });
      continue;
    }
    const paras = block.split(/\n{2,}/);
    let buf = "";
    let part = 0;
    for (const p of paras) {
      if ((buf + "\n\n" + p).length > 1600 && buf) {
        chunks.push({
          title: `${title} (${++part})`,
          body: buf.trim(),
          source: sourceFile,
        });
        buf = p;
      } else {
        buf = buf ? `${buf}\n\n${p}` : p;
      }
    }
    if (buf.trim()) {
      chunks.push({
        title: part ? `${title} (${++part})` : title,
        body: buf.trim(),
        source: sourceFile,
      });
    }
  }
  return chunks;
}

/** Feature-hashing local embedding — offline, deterministic, fine for small KB. */
function embedLocal(text, dim = EMBED_DIM) {
  const v = new Float64Array(dim);
  const tokens = String(text || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i += 1) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = h >>> 0;
    v[idx % dim] += 1;
    v[(idx >>> 8) % dim] += 0.5;
  }
  let norm = 0;
  for (let i = 0; i < dim; i += 1) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Array(dim);
  for (let i = 0; i < dim; i += 1) out[i] = v[i] / norm;
  return out;
}

function cosine(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

async function embedCloud(text) {
  const apiKey =
    process.env.EMBEDDING_API_KEY ||
    process.env.LLM_API_KEY ||
    process.env.DEEPSEEK_API_KEY;
  const baseURL = (
    process.env.EMBEDDING_BASE_URL || ""
  ).replace(/\/$/, "");
  const model =
    process.env.EMBEDDING_MODEL || "text-embedding-3-small";
  if (!apiKey || !baseURL) return null;
  const res = await fetch(`${baseURL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: text.slice(0, 8000) }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) return null;
  return vec;
}

async function embedText(text) {
  try {
    const cloud = await embedCloud(text);
    if (cloud) return { vector: cloud, backend: "cloud" };
  } catch (err) {
    console.warn("[rag] cloud embedding failed, using local:", err.message);
  }
  return { vector: embedLocal(text), backend: "local" };
}

function chunkId(source, index, title) {
  const base = `${source}::${index}::${title}`.toLowerCase();
  let h = 0;
  for (let i = 0; i < base.length; i += 1) h = (h * 33 + base.charCodeAt(i)) >>> 0;
  return `k_${h.toString(16)}`;
}

async function ingestKnowledgeDir(dir = DEFAULT_KNOWLEDGE_DIR) {
  const db = getDeskDb();
  ensureRagSchema(db);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .filter((f) => f.toLowerCase() !== "readme.md")
    .sort();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO desk_knowledge_chunks
      (id, source, title, body, embedding_json, updated_at)
    VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `);
  const clearFts = db.prepare(`DELETE FROM desk_knowledge_fts`);
  const insertFts = db.prepare(
    `INSERT INTO desk_knowledge_fts (id, title, body) VALUES (?, ?, ?)`
  );

  const tx = db.transaction((rows) => {
    db.prepare(`DELETE FROM desk_knowledge_chunks`).run();
    clearFts.run();
    for (const row of rows) {
      insert.run(
        row.id,
        row.source,
        row.title,
        row.body,
        JSON.stringify(row.embedding)
      );
      insertFts.run(row.id, row.title, row.body);
    }
  });

  const prepared = [];
  let backend = "local";
  for (const file of files) {
    const full = path.join(dir, file);
    const raw = fs.readFileSync(full, "utf8");
    const pieces = splitMarkdownChunks(raw, file);
    for (let i = 0; i < pieces.length; i += 1) {
      const p = pieces[i];
      const { vector, backend: b } = await embedText(`${p.title}\n${p.body}`);
      backend = b;
      prepared.push({
        id: chunkId(file, i, p.title),
        source: p.source,
        title: p.title,
        body: p.body,
        embedding: vector,
      });
    }
  }
  tx(prepared);
  return {
    files: files.length,
    chunks: prepared.length,
    embeddingBackend: backend,
    dir,
  };
}

function ftsQuery(raw) {
  const tokens = String(raw || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  if (!tokens.length) return null;
  return tokens.map((t) => `"${t.replace(/"/g, "")}"`).join(" OR ");
}

function searchKnowledge(query, { limit = 4 } = {}) {
  const db = getDeskDb();
  ensureRagSchema(db);
  const lim = Math.min(8, Math.max(1, Number(limit) || 4));
  const q = String(query || "").trim();
  if (q.length < 2) {
    return { query: q, items: [], mode: "none", error: "query too short" };
  }

  const count = db
    .prepare(`SELECT COUNT(*) AS c FROM desk_knowledge_chunks`)
    .get()?.c;
  if (!count) {
    return {
      query: q,
      items: [],
      mode: "empty",
      error: "Knowledge base empty. Run: npm run ingest-knowledge",
    };
  }

  const qVec = embedLocal(q);
  const all = db
    .prepare(
      `SELECT id, source, title, body, embedding_json FROM desk_knowledge_chunks`
    )
    .all();

  const denseScored = all
    .map((row) => {
      let emb = null;
      try {
        emb = JSON.parse(row.embedding_json || "null");
      } catch {
        emb = null;
      }
      // If cloud embeddings have different dim, fall back to local re-hash of body.
      let score = 0;
      if (Array.isArray(emb) && emb.length === qVec.length) {
        score = cosine(qVec, emb);
      } else {
        score = cosine(qVec, embedLocal(`${row.title}\n${row.body}`));
      }
      return { ...row, score, mode: "dense" };
    })
    .sort((a, b) => b.score - a.score);

  let ftsHits = [];
  const ftsQ = ftsQuery(q);
  if (ftsQ) {
    try {
      ftsHits = db
        .prepare(
          `SELECT id, bm25(desk_knowledge_fts) AS rank
           FROM desk_knowledge_fts
           WHERE desk_knowledge_fts MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(ftsQ, lim);
    } catch {
      ftsHits = [];
    }
  }

  const ftsBoost = new Map(
    ftsHits.map((r, i) => [r.id, 1 - i / Math.max(ftsHits.length, 1)])
  );

  const merged = denseScored.map((row) => ({
    id: row.id,
    source: row.source,
    title: row.title,
    body: row.body.slice(0, 1200),
    score: Number(
      (row.score + (ftsBoost.get(row.id) || 0) * 0.35).toFixed(4)
    ),
  }));

  merged.sort((a, b) => b.score - a.score);
  return {
    query: q,
    mode: "hybrid_fts_dense",
    disclaimer:
      "Knowledge snippets for trade/process guidance only. Never use for inventing part prices.",
    items: merged.slice(0, lim),
  };
}

function ragStatus() {
  const db = getDeskDb();
  ensureRagSchema(db);
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM desk_knowledge_chunks`)
    .get();
  return {
    chunks: Number(row?.c || 0),
    knowledgeDir: DEFAULT_KNOWLEDGE_DIR,
    embedding: process.env.EMBEDDING_BASE_URL
      ? "cloud_or_local_fallback"
      : "local_feature_hash",
  };
}

module.exports = {
  ingestKnowledgeDir,
  searchKnowledge,
  ragStatus,
  DEFAULT_KNOWLEDGE_DIR,
  ensureRagSchema,
};
