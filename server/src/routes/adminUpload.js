const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { openDb, initSchema } = require("../db");

const router = express.Router();

const db = openDb();
initSchema(db);

const webPublic =
  process.env.WEB_PUBLIC_DIR ||
  path.join(__dirname, "..", "..", "..", "web", "public");
const partsImageDir = path.join(webPublic, "images", "parts");
const tmpDir = path.join(partsImageDir, ".tmp");

function ensureDirs() {
  fs.mkdirSync(partsImageDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
}

/** Safe filename segment from OEM part number (keep readability). */
function safePartFileStem(partNo) {
  return String(partNo)
    .trim()
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_");
}

function publicPathForPart(partNo) {
  return `/images/parts/${safePartFileStem(partNo)}.jpg`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDirs();
    cb(null, tmpDir);
  },
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024, files: 120 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/pjpeg" ||
      file.mimetype === "image/jpg";
    if (ok) cb(null, true);
    else cb(new Error("Only JPEG images are allowed (.jpg)"));
  },
});

const getPartStmt = db.prepare(`SELECT part_no FROM parts WHERE part_no = ?`);
const getPartFullStmt = db.prepare(
  `SELECT
     part_no,
     brand,
     name_ch,
     name_en,
     name_fr,
     name_ar,
     price,
     image_path
   FROM parts
   WHERE part_no = ?`
);
const insertPartStmt = db.prepare(
  `INSERT INTO parts (
     part_no,
     brand,
     name_ch,
     name_en,
     name_fr,
     name_ar,
     price
   ) VALUES (
     @part_no,
     @brand,
     @name_ch,
     @name_en,
     @name_fr,
     @name_ar,
     @price
   )`
);
const updatePartStmt = db.prepare(
  `UPDATE parts
   SET part_no = @next_part_no,
       brand = @brand,
       name_ch = @name_ch,
       name_en = @name_en,
       name_fr = @name_fr,
       name_ar = @name_ar,
       price = @price,
       image_path = @image_path
   WHERE part_no = @current_part_no`
);
const updatePartImagePathOnlyStmt = db.prepare(
  `UPDATE parts
   SET image_path = @image_path
   WHERE part_no = @part_no`
);
const updateImageStmt = db.prepare(
  `UPDATE parts
   SET image_path = ?,
       image_uploaded = 1,
       image_uploaded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       image_upload_failed = 0,
       image_upload_failed_at = NULL,
       image_upload_error = NULL
   WHERE part_no = ?`
);
const markUploadFailedStmt = db.prepare(
  `UPDATE parts
   SET image_upload_failed = 1,
       image_upload_failed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       image_upload_error = @error
   WHERE part_no = @part_no`
);
const listUploadedStmt = db.prepare(`
  SELECT
    p.part_no,
    p.brand,
    COALESCE(o.name_ch, p.name_ch) AS name_ch,
    p.image_path,
    p.image_uploaded_at,
    p.image_upload_failed_at,
    p.image_upload_error,
    CASE
      WHEN p.image_upload_failed = 1 THEN 'failed'
      ELSE 'success'
    END AS record_status,
    COALESCE(p.image_upload_failed_at, p.image_uploaded_at) AS record_at
  FROM parts p
  LEFT JOIN part_translation_overrides o ON o.part_no = p.part_no
  WHERE
    (
      (@status = 'all' AND (p.image_uploaded = 1 OR p.image_upload_failed = 1))
      OR (@status = 'success' AND p.image_uploaded = 1)
      OR (@status = 'failed' AND p.image_upload_failed = 1)
    )
    AND (
      @q = ''
      OR instr(lower(p.part_no), lower(@q)) > 0
      OR instr(lower(p.brand), lower(@q)) > 0
      OR instr(lower(COALESCE(o.name_ch, p.name_ch)), lower(@q)) > 0
      OR instr(lower(COALESCE(p.image_upload_error, '')), lower(@q)) > 0
    )
  ORDER BY record_at DESC, p.part_no
  LIMIT @limit OFFSET @offset
`);
const countUploadedStmt = db.prepare(`
  SELECT COUNT(*) AS total
  FROM parts p
  LEFT JOIN part_translation_overrides o ON o.part_no = p.part_no
  WHERE
    (
      (@status = 'all' AND (p.image_uploaded = 1 OR p.image_upload_failed = 1))
      OR (@status = 'success' AND p.image_uploaded = 1)
      OR (@status = 'failed' AND p.image_upload_failed = 1)
    )
    AND (
      @q = ''
      OR instr(lower(p.part_no), lower(@q)) > 0
      OR instr(lower(p.brand), lower(@q)) > 0
      OR instr(lower(COALESCE(o.name_ch, p.name_ch)), lower(@q)) > 0
      OR instr(lower(COALESCE(p.image_upload_error, '')), lower(@q)) > 0
    )
`);
const getUsdCnyRateStmt = db.prepare(
  `SELECT value, updated_at FROM app_settings WHERE key = 'usd_cny_rate' LIMIT 1`
);
const upsertUsdCnyRateStmt = db.prepare(`
  INSERT INTO app_settings (key, value, updated_at)
  VALUES ('usd_cny_rate', @value, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);

function requireUploadKey(req, res) {
  const expected = process.env.ADMIN_UPLOAD_KEY || "";
  if (!expected) return null;
  const got = req.headers["x-admin-upload-key"];
  if (typeof got !== "string" || got !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return true;
  }
  return null;
}

function resolvePartNoList(files, body) {
  /** @type {string[]} */
  const out = [];
  const raw = body && body.part_nos;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      // fall through: treat as comma-separated
    }
    return raw
      .split(/[,;\n\r]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  for (const f of files) {
    const stem = path.parse(f.originalname || "").name;
    out.push(stem.trim());
  }
  return out;
}

router.get("/api/admin/uploads", (req, res) => {
  const err = requireUploadKey(req, res);
  if (err) return;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  let limit = Number.parseInt(String(req.query.limit ?? "50"), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;
  let offset = Number.parseInt(String(req.query.offset ?? "0"), 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  const statusRaw = String(req.query.status || "all").toLowerCase();
  const status =
    statusRaw === "success" || statusRaw === "failed" ? statusRaw : "all";
  try {
    const total = Number(countUploadedStmt.get({ q, status })?.total ?? 0);
    const items = listUploadedStmt.all({ q, limit, offset, status });
    return res.json({
      status,
      total,
      count: items.length,
      limit,
      offset,
      items,
    });
  } catch (e) {
    console.error("GET /api/admin/uploads:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/api/admin/settings/currency", (req, res) => {
  const err = requireUploadKey(req, res);
  if (err) return;
  try {
    const row = getUsdCnyRateStmt.get();
    const parsed = Number.parseFloat(String(row?.value ?? "7.2"));
    const usdCnyRate = Number.isFinite(parsed) && parsed > 0 ? parsed : 7.2;
    return res.json({
      usd_cny_rate: Number(usdCnyRate.toFixed(6)),
      updated_at: row?.updated_at ?? null,
    });
  } catch (e) {
    console.error("GET /api/admin/settings/currency:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/api/admin/settings/currency", express.json({ limit: "64kb" }), (req, res) => {
  const err = requireUploadKey(req, res);
  if (err) return;
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const raw = Number.parseFloat(String(body.usd_cny_rate ?? ""));
    if (!Number.isFinite(raw) || raw <= 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "usd_cny_rate must be a positive number",
      });
    }
    const normalized = Number(raw.toFixed(6));
    upsertUsdCnyRateStmt.run({ value: String(normalized) });
    const row = getUsdCnyRateStmt.get();
    return res.json({
      ok: true,
      usd_cny_rate: normalized,
      updated_at: row?.updated_at ?? null,
    });
  } catch (e) {
    console.error("POST /api/admin/settings/currency:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/api/admin/parts", express.json({ limit: "256kb" }), (req, res) => {
  const err = requireUploadKey(req, res);
  if (err) return;
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const partNo = String(body.part_no || "")
      .trim();
    const brand = String(body.brand || "")
      .trim();
    const nameCh = String(body.name_ch || "")
      .trim();
    const nameEnRaw = String(body.name_en || "")
      .trim();
    const nameFrRaw = String(body.name_fr || "")
      .trim();
    const nameArRaw = String(body.name_ar || "")
      .trim();
    const priceRaw = body.price;

    if (!partNo || !brand || !nameCh) {
      return res.status(400).json({
        error: "Bad Request",
        message: "part_no, brand, name_ch are required",
      });
    }
    const exists = getPartStmt.get(partNo);
    if (exists) {
      return res.status(409).json({
        error: "Conflict",
        message: "part_no already exists",
        part_no: partNo,
      });
    }

    let price = null;
    if (priceRaw !== null && priceRaw !== undefined && String(priceRaw).trim() !== "") {
      const parsed = Number(priceRaw);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "price must be a valid number",
        });
      }
      price = parsed;
    }

    insertPartStmt.run({
      part_no: partNo,
      brand,
      name_ch: nameCh,
      name_en: nameEnRaw || nameCh,
      name_fr: nameFrRaw || nameCh,
      name_ar: nameArRaw || nameCh,
      price,
    });
    return res.status(201).json({
      ok: true,
      item: {
        part_no: partNo,
        brand,
        name_ch: nameCh,
        name_en: nameEnRaw || nameCh,
        name_fr: nameFrRaw || nameCh,
        name_ar: nameArRaw || nameCh,
        price,
      },
    });
  } catch (e) {
    console.error("POST /api/admin/parts:", e);
    return res.status(500).json({
      error: "Internal Server Error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

router.patch("/api/admin/parts/:partNo", express.json({ limit: "256kb" }), (req, res) => {
  const err = requireUploadKey(req, res);
  if (err) return;
  try {
    const currentPartNo = String(req.params.partNo || "").trim();
    if (!currentPartNo) {
      return res.status(400).json({
        error: "Bad Request",
        message: "partNo param is required",
      });
    }
    const existing = getPartFullStmt.get(currentPartNo);
    if (!existing) {
      return res.status(404).json({
        error: "Not Found",
        message: "part not found",
        part_no: currentPartNo,
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const nextPartNo = String(body.part_no || "").trim();
    const brand = String(body.brand || "").trim();
    const nameCh = String(body.name_ch || "").trim();
    const nameEnRaw = String(body.name_en || "").trim();
    const nameFrRaw = String(body.name_fr || "").trim();
    const nameArRaw = String(body.name_ar || "").trim();
    const hasImagePathField = Object.prototype.hasOwnProperty.call(body, "image_path");
    const imagePathRaw = hasImagePathField
      ? String(body.image_path ?? "").trim()
      : null;
    const priceRaw = body.price;

    if (!nextPartNo || !brand || !nameCh) {
      return res.status(400).json({
        error: "Bad Request",
        message: "part_no, brand, name_ch are required",
      });
    }

    if (nextPartNo !== currentPartNo) {
      const conflict = getPartStmt.get(nextPartNo);
      if (conflict) {
        return res.status(409).json({
          error: "Conflict",
          message: "part_no already exists",
          part_no: nextPartNo,
        });
      }
    }

    let price = null;
    if (priceRaw !== null && priceRaw !== undefined && String(priceRaw).trim() !== "") {
      const parsed = Number(priceRaw);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "price must be a valid number",
        });
      }
      price = parsed;
    }

    const imagePath = hasImagePathField ? imagePathRaw || null : existing.image_path ?? null;
    updatePartStmt.run({
      current_part_no: currentPartNo,
      next_part_no: nextPartNo,
      brand,
      name_ch: nameCh,
      name_en: nameEnRaw || nameCh,
      name_fr: nameFrRaw || nameCh,
      name_ar: nameArRaw || nameCh,
      price,
      image_path: imagePath,
    });

    return res.json({
      ok: true,
      item: {
        part_no: nextPartNo,
        brand,
        name_ch: nameCh,
        name_en: nameEnRaw || nameCh,
        name_fr: nameFrRaw || nameCh,
        name_ar: nameArRaw || nameCh,
        price,
        image_path: imagePath,
      },
    });
  } catch (e) {
    console.error("PATCH /api/admin/parts/:partNo:", e);
    return res.status(500).json({
      error: "Internal Server Error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

router.post("/api/admin/parts/reuse-image", express.json({ limit: "256kb" }), (req, res) => {
  const err = requireUploadKey(req, res);
  if (err) return;
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const sourcePartNo = String(body.source_part_no || "").trim();
    const targetPartNos = Array.isArray(body.target_part_nos)
      ? body.target_part_nos.map((x) => String(x || "").trim()).filter(Boolean)
      : [];

    if (!sourcePartNo) {
      return res.status(400).json({
        error: "Bad Request",
        message: "source_part_no is required",
      });
    }
    if (targetPartNos.length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "target_part_nos must contain at least one part number",
      });
    }

    const sourcePart = getPartFullStmt.get(sourcePartNo);
    if (!sourcePart) {
      return res.status(404).json({
        error: "Not Found",
        message: "source part not found",
        source_part_no: sourcePartNo,
      });
    }

    const sourceImagePath =
      String(sourcePart.image_path || "").trim() || publicPathForPart(sourcePartNo);
    const normalizedTargets = Array.from(new Set(targetPartNos));
    const success = [];
    const failed = [];

    const tx = db.transaction((partNos) => {
      for (const partNo of partNos) {
        const row = getPartStmt.get(partNo);
        if (!row) {
          failed.push({ part_no: partNo, error: "Part not found" });
          continue;
        }
        updatePartImagePathOnlyStmt.run({
          image_path: sourceImagePath,
          part_no: partNo,
        });
        success.push(partNo);
      }
    });
    tx(normalizedTargets);

    return res.json({
      ok: true,
      source_part_no: sourcePartNo,
      image_path: sourceImagePath,
      total: normalizedTargets.length,
      success_count: success.length,
      failed_count: failed.length,
      success_part_nos: success,
      failed,
    });
  } catch (e) {
    console.error("POST /api/admin/parts/reuse-image:", e);
    return res.status(500).json({
      error: "Internal Server Error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

/**
 * POST /api/admin/upload
 * multipart: field `images` (array). Optional body field `part_nos` (JSON array or CSV).
 * If part_nos omitted, uses each file's basename (without extension) as OEM number.
 */
router.post(
  "/api/admin/upload",
  (req, res, next) => {
    const err = requireUploadKey(req, res);
    if (err) return;
    next();
  },
  upload.array("images", 100),
  (req, res) => {
    try {
      const files = req.files;
      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "No files", message: "Expected field images[]" });
      }

      const partNos = resolvePartNoList(files, req.body);
      if (partNos.length !== files.length) {
        return res.status(400).json({
          error: "part_nos mismatch",
          message: `Got ${files.length} file(s) and ${partNos.length} part number(s). Provide part_nos JSON array of same length, or name files as PARTNO.jpg`,
        });
      }

      ensureDirs();
      const results = [];

      for (let i = 0; i < files.length; i += 1) {
        const partNo = partNos[i];
        const file = files[i];
        const row = getPartStmt.get(partNo);
        if (!row) {
          try {
            fs.unlinkSync(file.path);
          } catch {
            /* ignore */
          }
          results.push({ part_no: partNo, ok: false, error: "Part not found" });
          continue;
        }

        const destName = `${safePartFileStem(partNo)}.jpg`;
        const destAbs = path.join(partsImageDir, destName);
        const rel = publicPathForPart(partNo);

        try {
          if (fs.existsSync(destAbs)) fs.unlinkSync(destAbs);
          fs.renameSync(file.path, destAbs);
        } catch (e) {
          const errorText = e instanceof Error ? e.message : String(e);
          markUploadFailedStmt.run({ part_no: partNo, error: errorText });
          results.push({
            part_no: partNo,
            ok: false,
            error: errorText,
          });
          continue;
        }

        updateImageStmt.run(rel, partNo);
        results.push({ part_no: partNo, ok: true, image_path: rel });
      }

      const okCount = results.filter((r) => r.ok).length;
      return res.json({ ok: true, count: okCount, results });
    } catch (e) {
      console.error("POST /api/admin/upload:", e);
      return res.status(500).json({
        error: "Upload failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
);

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code, message: err.message });
  }
  if (err) {
    return res.status(400).json({ error: "Bad Request", message: err.message || String(err) });
  }
  return _next();
});

module.exports = router;
