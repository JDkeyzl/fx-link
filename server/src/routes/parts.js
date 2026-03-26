const express = require("express");
const { openDb, initSchema } = require("../db");

const router = express.Router();

// Shared DB handle for performance (reads are fast; SQLite serialized internally).
const db = openDb();
initSchema(db);
const stmt = db.prepare(
  `SELECT part_no, brand, name_ch, name_en, name_fr, name_ar, price
   FROM parts WHERE part_no = ?`
);

/**
 * Fuzzy list search:
 * - part_no exact/prefix/substr ranked first
 * - name_ch / name_en / name_fr / name_ar substring matches
 */
const searchStmt = db.prepare(`
  SELECT part_no, brand, name_ch, name_en, name_fr, name_ar, price FROM parts
  WHERE
    lower(part_no) = lower(@q)
    OR lower(part_no) LIKE lower(@q) || '%'
    OR instr(lower(part_no), lower(@q)) > 0
    OR instr(lower(name_ch), lower(@q)) > 0
    OR instr(lower(name_en), lower(@q)) > 0
    OR instr(lower(name_fr), lower(@q)) > 0
    OR instr(lower(name_ar), lower(@q)) > 0
  ORDER BY
    CASE
      WHEN lower(part_no) = lower(@q) THEN 0
      WHEN lower(part_no) LIKE lower(@q) || '%' THEN 1
      WHEN instr(lower(part_no), lower(@q)) > 0 THEN 2
      WHEN instr(lower(name_ch), lower(@q)) > 0 THEN 3
      WHEN instr(lower(name_en), lower(@q)) > 0 THEN 4
      WHEN instr(lower(name_fr), lower(@q)) > 0 THEN 5
      WHEN instr(lower(name_ar), lower(@q)) > 0 THEN 6
      ELSE 7
    END,
    part_no
  LIMIT @limit
`);

function jsonPart(row, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json({
    part_no: row.part_no,
    brand: row.brand,
    name_ch: row.name_ch,
    name_en: row.name_en,
    name_fr: row.name_fr,
    name_ar: row.name_ar,
    price: row.price,
  });
}

/** Fuzzy list search (must be registered before /api/parts/:partNo). */
router.get("/api/parts/search", (req, res) => {
  const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  let limit = Number.parseInt(String(req.query.limit ?? "30"), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 30;
  if (limit > 50) limit = 50;

  if (raw.length < 2) {
    return res.status(400).json({
      error: "Query too short",
      message: "Minimum 2 characters for fuzzy search",
      query: raw,
      items: [],
      count: 0,
    });
  }

  try {
    const rows = searchStmt.all({ q: raw, limit });
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json({
      query: raw,
      count: rows.length,
      items: rows.map((r) => ({
        part_no: r.part_no,
        brand: r.brand,
        name_ch: r.name_ch,
        name_en: r.name_en,
        name_fr: r.name_fr,
        name_ar: r.name_ar,
        price: r.price,
      })),
    });
  } catch (err) {
    console.error("GET /api/parts/search error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/** SEO / tooling: canonical JSON API by part number only (uses idx_parts_part_no / PK). */
router.get("/api/parts/:partNo", (req, res) => {
  const partNo = req.params.partNo;
  try {
    const row = stmt.get(partNo);
    if (!row) {
      return res.status(404).json({ error: "Part not found", part_no: partNo });
    }
    return jsonPart(row, res);
  } catch (err) {
    console.error("GET /api/parts/:partNo error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/parts/:brand/:part_no", (req, res) => {
  const partNo = req.params.part_no;
  try {
    const row = stmt.get(partNo);
    if (!row) {
      return res.status(404).json({ error: "Part not found", part_no: partNo });
    }

    // brand param is part of the URL; we treat it as optional (part_no is globally unique per requirements).
    return jsonPart(row, res);
  } catch (err) {
    console.error("GET /parts error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

module.exports = router;

