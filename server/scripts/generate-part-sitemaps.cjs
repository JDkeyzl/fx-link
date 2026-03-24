#!/usr/bin/env node
/**
 * Export all part_no from SQLite into multiple sitemap.xml files (max URLs per file).
 *
 * Usage:
 *   SITE_URL=http://crealink.shop node scripts/generate-part-sitemaps.cjs
 *
 * Env:
 *   SITE_URL          – canonical site origin (no trailing slash)
 *   PARTS_DB_PATH     – path to parts.db (default: server/data/parts.db)
 *   OUT_DIR           – output directory (default: ../web/public/sitemaps)
 *   MAX_URLS_PER_FILE – default 50000 (search engine limit)
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const SITE_URL = (process.env.SITE_URL || "http://crealink.shop").replace(
  /\/$/,
  ""
);
const SCRIPT_DIR = path.dirname(__filename);
const SERVER_DIR = path.join(SCRIPT_DIR, "..");
const DEFAULT_DB = path.join(SERVER_DIR, "data", "parts.db");
const DB_PATH = process.env.PARTS_DB_PATH || DEFAULT_DB;
const OUT_DIR =
  process.env.OUT_DIR || path.join(SERVER_DIR, "..", "web", "public", "sitemaps");
const MAX_URLS = Number(process.env.MAX_URLS_PER_FILE || 50000);

function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function urlEntry(loc) {
  return `  <url>\n    <loc>${escXml(loc)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`;
}

function writeSitemapChunk(urls, index) {
  const name = `parts-sitemap-${String(index).padStart(4, "0")}.xml`;
  const file = path.join(OUT_DIR, name);
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => urlEntry(u)),
    "</urlset>",
    "",
  ].join("\n");
  fs.writeFileSync(file, body, "utf8");
  return name;
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error("[sitemap] DB not found:", DB_PATH);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  const iter = db.prepare("SELECT part_no FROM parts ORDER BY part_no").iterate();

  let chunk = [];
  let fileIndex = 1;
  const writtenFiles = [];

  for (const row of iter) {
    const partNo = row.part_no;
    const loc = `${SITE_URL}/parts/${encodeURIComponent(partNo)}`;
    chunk.push(loc);
    if (chunk.length >= MAX_URLS) {
      writtenFiles.push(writeSitemapChunk(chunk, fileIndex));
      fileIndex += 1;
      chunk = [];
    }
  }
  if (chunk.length > 0) {
    writtenFiles.push(writeSitemapChunk(chunk, fileIndex));
  }

  const indexName = "parts-sitemap-index.xml";
  const indexPath = path.join(OUT_DIR, indexName);
  const indexBody = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...writtenFiles.map(
      (f) =>
        `  <sitemap>\n    <loc>${escXml(`${SITE_URL}/sitemaps/${f}`)}</loc>\n  </sitemap>`
    ),
    "</sitemapindex>",
    "",
  ].join("\n");
  fs.writeFileSync(indexPath, indexBody, "utf8");

  console.log("[sitemap] wrote", writtenFiles.length, "part sitemap(s) +", indexName);
  console.log("[sitemap] out:", OUT_DIR);
  db.close();
}

main();
