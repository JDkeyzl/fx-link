const express = require("express");
const { openDb, initSchema } = require("../db");

const router = express.Router();

// Shared DB handle for performance (reads are fast; SQLite serialized internally).
const db = openDb();
initSchema(db);
const stmt = db.prepare(
  `SELECT part_no, brand, name_en, price FROM parts WHERE part_no = ?`
);

/** Fuzzy search: part_no + name_en (case-insensitive), max `limit` rows. Uses instr() to avoid LIKE wildcard issues. */
const searchStmt = db.prepare(`
  SELECT part_no, brand, name_en, price FROM parts
  WHERE instr(lower(part_no), lower(@q)) > 0
     OR instr(lower(name_en), lower(@q)) > 0
  ORDER BY
    CASE
      WHEN lower(part_no) = lower(@q) THEN 0
      WHEN substr(lower(part_no), 1, length(@q)) = lower(@q) THEN 1
      WHEN instr(lower(part_no), lower(@q)) > 0 THEN 2
      ELSE 3
    END,
    part_no
  LIMIT @limit
`);

function jsonPart(row, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json({
    part_no: row.part_no,
    brand: row.brand,
    name_en: row.name_en,
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
        name_en: r.name_en,
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

