#!/usr/bin/env node
/**
 * 从当前 `server/data/parts.db` 统计仍存在于 name_en/name_fr/name_ar 中的中文片段，
 * 调用在线翻译补充到 `web/scripts/glossary-extra-auto-parts.json`（用于 glossary-auto-parts.cjs 运行时合并）。
 *
 * 用法示例：
 *   node scripts/expand-glossary-extra-from-db.cjs DB_PATH=... MAX_SEGMENTS=500 MIN_LEN=1
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const Database = require("better-sqlite3");

function getEnv(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v;
}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "parts.db");
const EXTRA_GLOSSARY_JSON = path.join(
  __dirname,
  "..",
  "..",
  "web",
  "scripts",
  "glossary-extra-auto-parts.json"
);
const SEGMENT_TRANSLATION_CACHE_FILE = path.join(__dirname, "..", "data", "segment-translation-cache.json");

const MAX_SEGMENTS = Number(getEnv("MAX_SEGMENTS", "500"));
const MIN_LEN = Number(getEnv("MIN_LEN", "1"));
const MAX_CJK_SEGMENT_FREQ = Number(getEnv("MAX_CJK_SEGMENT_FREQ", "1000000000"));

const SL = "zh-CN";

function collapseSpaces(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function translateSegmentOnline(segment, tl) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
    SL
  )}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(segment)}`;
  try {
    const out = execFileSync("curl", ["-fsSL", url], {
      encoding: "utf-8",
      timeout: Number(getEnv("ONLINE_TRANSLATION_TIMEOUT_MS", "1200")),
      maxBuffer: 1024 * 1024,
    });
    const data = JSON.parse(out);
    const parts = Array.isArray(data?.[0]) ? data[0] : [];
    const text = parts
      .map((it) => (Array.isArray(it) && typeof it[0] === "string" ? it[0] : ""))
      .join("")
      .trim();
    return text;
  } catch {
    return "";
  }
}

let segmentCache = {};
if (fs.existsSync(SEGMENT_TRANSLATION_CACHE_FILE)) {
  try {
    segmentCache = JSON.parse(fs.readFileSync(SEGMENT_TRANSLATION_CACHE_FILE, "utf-8"));
  } catch {
    segmentCache = {};
  }
}

// Load existing glossary (base + extra) so we don't translate segments already covered.
const baseGlossary = require(path.join(__dirname, "..", "..", "web", "scripts", "glossary-auto-parts.cjs"));
let extraGlossary = {};
if (fs.existsSync(EXTRA_GLOSSARY_JSON)) {
  try {
    extraGlossary = JSON.parse(fs.readFileSync(EXTRA_GLOSSARY_JSON, "utf-8"));
  } catch {
    extraGlossary = {};
  }
}
const covered = new Set([...Object.keys(baseGlossary || {}), ...Object.keys(extraGlossary || {})]);

const cjkSegRe = /[\u3400-\u9fff]+/g;
function* extractSegments(text) {
  const s = String(text || "");
  if (!cjkSegRe.test(s)) return;
  cjkSegRe.lastIndex = 0;
  let m;
  while ((m = cjkSegRe.exec(s)) !== null) {
    const seg = m[0];
    if (seg.length < MIN_LEN) continue;
    yield seg;
  }
}

const freq = new Map();
const db = new Database(DB_PATH, { readonly: true });
const stmt = db.prepare("SELECT name_en, name_fr, name_ar FROM parts WHERE name_en IS NOT NULL");

// Iterate and count CJK segments frequencies in untranslated records.
for (const row of stmt.iterate()) {
  for (const field of ["name_en", "name_fr", "name_ar"]) {
    const value = row[field];
    const hasCjk = /[\u3400-\u9fff]/.test(String(value || ""));
    if (!hasCjk) continue;
    for (const seg of extractSegments(value)) {
      // If already covered in glossary, skip counting to reduce work.
      if (covered.has(seg)) continue;
      freq.set(seg, (freq.get(seg) || 0) + 1);
    }
  }
}

const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
console.log(`[expand] DB=${DB_PATH}`);
console.log(`[expand] MIN_LEN=${MIN_LEN} MAX_SEGMENTS=${MAX_SEGMENTS}`);
console.log(`[expand] uncovered CJK segments candidates=${sorted.length}`);

const toAdd = [];
for (const [seg, n] of sorted) {
  if (n > MAX_CJK_SEGMENT_FREQ) continue;
  toAdd.push(seg);
  if (toAdd.length >= MAX_SEGMENTS) break;
}

console.log(`[expand] will translate segments=${toAdd.length}`);

const outExtra = { ...(extraGlossary || {}) };
let translated = 0;

for (const seg of toAdd) {
  if (outExtra[seg]) continue;
  if (!segmentCache[seg]) segmentCache[seg] = { en: "", fr: "", ar: "" };
  const cached = segmentCache[seg];

  if (!cached.en) cached.en = translateSegmentOnline(seg, "en");
  if (!cached.fr) cached.fr = translateSegmentOnline(seg, "fr");
  if (!cached.ar) cached.ar = translateSegmentOnline(seg, "ar");

  const entry = {
    en: collapseSpaces(cached.en) || "",
    fr: collapseSpaces(cached.fr) || "",
    ar: collapseSpaces(cached.ar) || "",
  };
  // Only add when at least one language was translated; empty entries are useless.
  if (entry.en || entry.fr || entry.ar) {
    outExtra[seg] = entry;
    translated += 1;
  }
}

fs.writeFileSync(EXTRA_GLOSSARY_JSON, JSON.stringify(outExtra, null, 2), "utf-8");
fs.writeFileSync(SEGMENT_TRANSLATION_CACHE_FILE, JSON.stringify(segmentCache, null, 2), "utf-8");

console.log(`[expand] translated=${translated}`);
console.log(`[expand] wrote extra glossary: ${EXTRA_GLOSSARY_JSON}`);

