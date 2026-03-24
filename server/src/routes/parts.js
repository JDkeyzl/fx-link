const express = require("express");
const { openDb, initSchema } = require("../db");

const router = express.Router();

// Shared DB handle for performance (reads are fast; SQLite serialized internally).
const db = openDb();
initSchema(db);
const stmt = db.prepare(
  `SELECT part_no, brand, name_en, price FROM parts WHERE part_no = ?`
);

function jsonPart(row, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json({
    part_no: row.part_no,
    brand: row.brand,
    name_en: row.name_en,
    price: row.price,
  });
}

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

