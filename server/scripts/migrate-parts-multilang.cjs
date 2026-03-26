#!/usr/bin/env node
/**
 * Migrate SQLite `parts` table to multi-language schema:
 *   - name_ch: original Chinese name
 *   - name_en: English translation
 *   - name_fr: French translation
 *   - name_ar: Arabic translation
 *
 * Translation strategy:
 *   - Route 1: web/data/final_data_i18n.json (part_no -> en_name/fr_name/alb_name)
 *   - Route 2: glossary-auto-parts.cjs (translate Chinese name via glossary)
 *
 * Safety:
 *   - Creates a DB backup (parts.db + optional -wal/-shm) before rebuilding.
 *
 * Run (on server, repo root `/home/admin/fx-link`):
 *   cd /home/admin/fx-link
 *   node server/scripts/migrate-parts-multilang.cjs
 *
 * Optional:
 *   PARTS_DB_PATH=/home/admin/fx-link/server/data/parts.db \
 *   FINAL_DATA_I18N_PATH=/home/admin/fx-link/web/data/final_data_i18n.json \
 *   FORCE_REBUILD=1 \
 *   LIMIT_PARTS=5000 \
 *   BATCH_SIZE=20000
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const SERVER_DIR = path.dirname(__filename); // server/scripts
const REPO_DIR = path.join(SERVER_DIR, ".."); // server/
const REPO_ROOT = path.join(SERVER_DIR, "..", ".."); // project root

const DB_PATH =
  process.env.PARTS_DB_PATH || path.join(REPO_DIR, "data", "parts.db");
const FINAL_DATA_I18N_PATH =
  process.env.FINAL_DATA_I18N_PATH ||
  path.join(REPO_ROOT, "web", "data", "final_data_i18n.json");

const GLOSSARY_PATH =
  process.env.GLOSSARY_PATH ||
  path.join(REPO_ROOT, "web", "scripts", "glossary-auto-parts.cjs");

const FORCE_REBUILD = process.env.FORCE_REBUILD === "1";
const LIMIT_PARTS = process.env.LIMIT_PARTS
  ? Number(process.env.LIMIT_PARTS)
  : null;
const BATCH_SIZE = process.env.BATCH_SIZE
  ? Number(process.env.BATCH_SIZE)
  : 20000;

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collapseSpaces(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function chooseFirstNonEmpty(items, field) {
  if (!Array.isArray(items)) return "";
  for (const it of items) {
    const v = it?.[field];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function loadFinalDataI18n() {
  if (!fileExists(FINAL_DATA_I18N_PATH)) {
    throw new Error(`[migrate] final_data_i18n not found: ${FINAL_DATA_I18N_PATH}`);
  }
  const raw = fs.readFileSync(FINAL_DATA_I18N_PATH, "utf-8");
  const data = JSON.parse(raw);
  // Map part_no => { en_name, fr_name, alb_name }
  const map = new Map();
  for (const [partNo, items] of Object.entries(data)) {
    const en = chooseFirstNonEmpty(items, "en_name");
    const fr = chooseFirstNonEmpty(items, "fr_name");
    const ar = chooseFirstNonEmpty(items, "alb_name");
    if (en || fr || ar) map.set(partNo, { en_name: en, fr_name: fr, alb_name: ar });
  }
  return map;
}

function createTranslator(glossary) {
  const sortedKeys = Object.keys(glossary).sort((a, b) => b.length - a.length);
  const compiled = sortedKeys
    .map((key) => {
      const t = glossary[key] || {};
      if (!t.en && !t.fr && !t.ar) return null;
      return {
        key,
        en: t.en,
        fr: t.fr,
        ar: t.ar,
        re: new RegExp(escapeRegExp(key), "g"),
      };
    })
    .filter(Boolean);

  return function translateNameCN(name) {
    if (!name || typeof name !== "string") {
      return { en: "", fr: "", ar: "" };
    }
    const text = name.trim();
    if (!text) return { en: "", fr: "", ar: "" };

    // Match keys against original text (same behavior as add-i18n-names.cjs).
    let en = text;
    let fr = text;
    let ar = text;

    for (const item of compiled) {
      if (!text.includes(item.key)) continue;
      en = en.replace(item.re, ` ${item.en} `);
      fr = fr.replace(item.re, ` ${item.fr} `);
      ar = ar.replace(item.re, ` ${item.ar} `);
    }

    return {
      en: collapseSpaces(en),
      fr: collapseSpaces(fr),
      ar: collapseSpaces(ar),
    };
  };
}

function backupDb(dbPath) {
  if (!fileExists(dbPath)) {
    throw new Error(`[migrate] DB not found: ${dbPath}`);
  }
  const dir = path.dirname(dbPath);
  const base = path.basename(dbPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupBase = path.join(dir, `${base}.bak.${stamp}`);

  fs.copyFileSync(dbPath, backupBase);
  // Also copy WAL/SHM when present.
  const wal = `${dbPath}-wal`;
  const shm = `${dbPath}-shm`;
  if (fileExists(wal)) fs.copyFileSync(wal, `${backupBase}-wal`);
  if (fileExists(shm)) fs.copyFileSync(shm, `${backupBase}-shm`);

  return backupBase;
}

function tableHasColumns(db, tableName, requiredCols) {
  const cols = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((c) => c.name);
  return requiredCols.every((c) => cols.includes(c));
}

function main() {
  if (!fileExists(DB_PATH)) {
    // eslint-disable-next-line no-console
    console.error(`[migrate] DB not found: ${DB_PATH}`);
    process.exit(1);
  }
  const glossary = require(GLOSSARY_PATH);
  const translator = createTranslator(glossary);
  const finalMap = loadFinalDataI18n();

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  const alreadyMigrated =
    tableHasColumns(db, "parts", ["name_ch", "name_en", "name_fr", "name_ar"]);

  if (alreadyMigrated && !FORCE_REBUILD) {
    // eslint-disable-next-line no-console
    console.log(
      "[migrate] parts table already has multi-language columns; set FORCE_REBUILD=1 to rebuild."
    );
    db.close();
    return;
  }

  // Backup first (safety).
  const backupBase = backupDb(DB_PATH);
  // eslint-disable-next-line no-console
  console.log("[migrate] DB backup created:", backupBase);

  // Detect source Chinese column (old schema uses name_en for Chinese).
  const cols = db.prepare(`PRAGMA table_info(parts)`).all();
  const colNames = cols.map((c) => c.name);
  const sourceChineseCol = colNames.includes("name_ch") ? "name_ch" : "name_en";

  // Rebuild table
  const tx = db.transaction(() => {
    db.exec("DROP TABLE IF EXISTS parts_new;");
    db.exec(`
      CREATE TABLE parts_new (
        part_no TEXT PRIMARY KEY,
        brand TEXT NOT NULL,
        name_ch TEXT NOT NULL,
        name_en TEXT NOT NULL,
        name_fr TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        price REAL
      );
    `);
    db.exec("CREATE INDEX idx_parts_new_part_no ON parts_new(part_no);");

    const insert = db.prepare(`
      INSERT INTO parts_new (part_no, brand, name_ch, name_en, name_fr, name_ar, price)
      VALUES (@part_no, @brand, @name_ch, @name_en, @name_fr, @name_ar, @price)
    `);

    // IMPORTANT:
    // better-sqlite3 doesn't allow executing other statements while an
    // `iterate()` cursor is still open on the same connection.
    // Therefore we avoid iterate() and use pagination by `part_no`.
    const sourceExpr = sourceChineseCol === "name_ch" ? "name_ch" : "name_en";
    const selectStmt = db.prepare(`
      SELECT
        part_no,
        brand,
        ${sourceExpr} AS name_ch_src,
        price
      FROM parts
      WHERE part_no > @last
      ORDER BY part_no
      LIMIT @limit
    `);

    let count = 0;
    const translationCache = new Map(); // name_ch_src -> { en, fr, ar }
    let lastPartNo = "";

    while (true) {
      const rows = selectStmt.all({
        last: lastPartNo,
        limit: BATCH_SIZE,
      });
      if (!rows || rows.length === 0) break;

      for (const row of rows) {
        const partNo = row.part_no;
        const brand = row.brand;
        const name_ch = row.name_ch_src ? String(row.name_ch_src).trim() : "";
        const price = row.price;

        if (!partNo || !name_ch) continue;

        const mapped = finalMap.get(String(partNo));
        let name_en = mapped?.en_name || "";
        let name_fr = mapped?.fr_name || "";
        let name_ar = mapped?.alb_name || "";

        if (!name_en || !name_fr || !name_ar) {
          let cached = translationCache.get(name_ch);
          if (!cached) {
            cached = translator(name_ch);
            translationCache.set(name_ch, cached);
          }
          name_en = name_en || cached.en;
          name_fr = name_fr || cached.fr;
          name_ar = name_ar || cached.ar;
        }

        // Final fallback guarantees NOT NULL
        name_en = collapseSpaces(name_en) || name_ch;
        name_fr = collapseSpaces(name_fr) || name_ch;
        name_ar = collapseSpaces(name_ar) || name_ch;

        insert.run({
          part_no: String(partNo),
          brand: String(brand || ""),
          name_ch,
          name_en,
          name_fr,
          name_ar,
          price: Number.isFinite(price) ? price : null,
        });

        count += 1;
        lastPartNo = String(partNo);

        if (LIMIT_PARTS && count >= LIMIT_PARTS) break;
      }

      if (LIMIT_PARTS && count >= LIMIT_PARTS) break;

      // Safety: in case of unexpected ordering / empty progress
      if (!lastPartNo) break;
    }

    db.exec("DROP TABLE parts;");
    db.exec("ALTER TABLE parts_new RENAME TO parts;");
    db.exec("CREATE INDEX IF NOT EXISTS idx_parts_part_no ON parts(part_no);");
  });

  // eslint-disable-next-line no-console
  console.log(
    `[migrate] Running migration. DB_PATH=${DB_PATH} FORCE_REBUILD=${FORCE_REBUILD} LIMIT_PARTS=${LIMIT_PARTS || "ALL"}`
  );
  tx();
  db.close();
  // eslint-disable-next-line no-console
  console.log("[migrate] Done.");
}

main();

