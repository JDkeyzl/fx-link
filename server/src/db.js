const path = require("path");
const Database = require("better-sqlite3");

function getEnv(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v;
}

function resolveDbPath() {
  // Default: server/data/parts.db
  const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  const dbPath = process.env.DB_PATH || path.join(dataDir, "parts.db");
  return dbPath;
}

function openDb() {
  const dbPath = resolveDbPath();
  const dir = path.dirname(dbPath);
  // Ensure directory exists (best-effort; will throw if cannot).
  // eslint-disable-next-line no-sync
  require("fs").mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  // Better concurrency for reads; harmless if we only read after ingestion.
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parts (
      part_no TEXT PRIMARY KEY,
      brand TEXT NOT NULL,
      -- name_ch: original Chinese name (was previously stored in name_en)
      name_ch TEXT NOT NULL,
      -- name_en/name_fr/name_ar: translated names (fallback to name_ch)
      name_en TEXT NOT NULL,
      name_fr TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      price REAL
    );
    -- Explicit lookup index (PK already indexes part_no; this keeps intent clear for ops/audits).
    CREATE INDEX IF NOT EXISTS idx_parts_part_no ON parts(part_no);
  `);
}

module.exports = {
  openDb,
  initSchema,
  resolveDbPath,
};

