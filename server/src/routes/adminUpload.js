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
const updateImageStmt = db.prepare(
  `UPDATE parts SET image_path = ? WHERE part_no = ?`
);

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
          results.push({
            part_no: partNo,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
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
