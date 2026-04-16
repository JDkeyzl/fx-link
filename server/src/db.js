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

    -- Manual/automatic correction overrides used by hidden translation console.
    CREATE TABLE IF NOT EXISTS part_translation_overrides (
      part_no TEXT PRIMARY KEY,
      name_ch TEXT,
      name_en TEXT,
      name_fr TEXT,
      name_ar TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      updated_by TEXT,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS translation_batch_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL,
      locale_field TEXT NOT NULL,
      find_text TEXT NOT NULL,
      replace_text TEXT NOT NULL,
      is_regex INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS translation_correction_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- High-confidence translation anchors saved from single manual edits.
    -- This table is append-only for audit/reuse in future MT pipeline.
    CREATE TABLE IF NOT EXISTS translation_anchor_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_no TEXT NOT NULL,
      name_ch TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_fr TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_translation_batch_rules_active
      ON translation_batch_rules(is_active, locale_field);
    CREATE INDEX IF NOT EXISTS idx_translation_logs_created_at
      ON translation_correction_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_translation_anchor_memory_part_no
      ON translation_anchor_memory(part_no);
    CREATE INDEX IF NOT EXISTS idx_translation_anchor_memory_created_at
      ON translation_anchor_memory(created_at DESC);
  `);

  const partCols = db.prepare(`PRAGMA table_info(parts)`).all();
  const hasImagePath = partCols.some((c) => c.name === "image_path");
  const hasImageUploaded = partCols.some((c) => c.name === "image_uploaded");
  const hasImageUploadedAt = partCols.some((c) => c.name === "image_uploaded_at");
  const hasImageUploadFailed = partCols.some((c) => c.name === "image_upload_failed");
  const hasImageUploadFailedAt = partCols.some((c) => c.name === "image_upload_failed_at");
  const hasImageUploadError = partCols.some((c) => c.name === "image_upload_error");
  if (!hasImagePath) {
    db.exec(`ALTER TABLE parts ADD COLUMN image_path TEXT`);
  }
  if (!hasImageUploaded) {
    db.exec(`ALTER TABLE parts ADD COLUMN image_uploaded INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasImageUploadedAt) {
    db.exec(`ALTER TABLE parts ADD COLUMN image_uploaded_at TEXT`);
  }
  if (!hasImageUploadFailed) {
    db.exec(`ALTER TABLE parts ADD COLUMN image_upload_failed INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasImageUploadFailedAt) {
    db.exec(`ALTER TABLE parts ADD COLUMN image_upload_failed_at TEXT`);
  }
  if (!hasImageUploadError) {
    db.exec(`ALTER TABLE parts ADD COLUMN image_upload_error TEXT`);
  }
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_parts_image_uploaded_at ON parts(image_uploaded, image_uploaded_at DESC)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_parts_image_upload_failed_at ON parts(image_upload_failed, image_upload_failed_at DESC)`
  );
}

module.exports = {
  openDb,
  initSchema,
  resolveDbPath,
};

