const express = require("express");
const { openDb, initSchema } = require("../db");
const {
  machineTranslate,
  extractIssueItems,
  groupIssues,
  listPartsWithIssues,
  collapseSpaces,
  dedupeAdjacentWords,
} = require("../translation-engine");

const router = express.Router();

// Shared DB handle for performance (reads are fast; SQLite serialized internally).
const db = openDb();
initSchema(db);
const resolvedBase = `
  SELECT
    p.part_no,
    p.brand,
    COALESCE(o.name_ch, p.name_ch) AS name_ch,
    COALESCE(o.name_en, p.name_en) AS name_en,
    COALESCE(o.name_fr, p.name_fr) AS name_fr,
    COALESCE(o.name_ar, p.name_ar) AS name_ar,
    p.price,
    p.image_path,
    o.updated_at AS override_updated_at
  FROM parts p
  LEFT JOIN part_translation_overrides o ON o.part_no = p.part_no
`;

const stmt = db.prepare(`${resolvedBase} WHERE p.part_no = ?`);
const getUsdCnyRateStmt = db.prepare(
  `SELECT value FROM app_settings WHERE key = 'usd_cny_rate' LIMIT 1`
);

/**
 * Fuzzy list search:
 * - part_no exact/prefix/substr ranked first
 * - name_ch / name_en / name_fr / name_ar substring matches
 */
const searchStmt = db.prepare(`
  ${resolvedBase}
  WHERE
    lower(p.part_no) = lower(@q)
    OR lower(p.part_no) LIKE lower(@q) || '%'
    OR instr(lower(p.part_no), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_ch, p.name_ch)), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_en, p.name_en)), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_fr, p.name_fr)), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_ar, p.name_ar)), lower(@q)) > 0
  ORDER BY
    CASE
      WHEN lower(p.part_no) = lower(@q) THEN 0
      WHEN lower(p.part_no) LIKE lower(@q) || '%' THEN 1
      WHEN instr(lower(p.part_no), lower(@q)) > 0 THEN 2
      WHEN instr(lower(COALESCE(o.name_ch, p.name_ch)), lower(@q)) > 0 THEN 3
      WHEN instr(lower(COALESCE(o.name_en, p.name_en)), lower(@q)) > 0 THEN 4
      WHEN instr(lower(COALESCE(o.name_fr, p.name_fr)), lower(@q)) > 0 THEN 5
      WHEN instr(lower(COALESCE(o.name_ar, p.name_ar)), lower(@q)) > 0 THEN 6
      ELSE 7
    END,
    p.part_no
  LIMIT @limit OFFSET @offset
`);

const searchCountStmt = db.prepare(`
  SELECT COUNT(*) AS total
  FROM parts p
  LEFT JOIN part_translation_overrides o ON o.part_no = p.part_no
  WHERE
    lower(p.part_no) = lower(@q)
    OR lower(p.part_no) LIKE lower(@q) || '%'
    OR instr(lower(p.part_no), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_ch, p.name_ch)), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_en, p.name_en)), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_fr, p.name_fr)), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_ar, p.name_ar)), lower(@q)) > 0
`);

/**
 * Same brand + first 8 chars of part_no (case-insensitive); excludes current SKU.
 * `cand_limit` pulls extra rows so we can dedupe by name_en and still aim for 10 unique titles.
 */
const relatedPartsStmt = db.prepare(`
  ${resolvedBase}
  WHERE lower(p.brand) = lower(@brand)
    AND p.part_no != @exclude_part_no
    AND length(@key_part_no) >= 1
    AND lower(substr(p.part_no, 1, 8)) = lower(substr(@key_part_no, 1, 8))
  ORDER BY p.part_no
  LIMIT @cand_limit
`);

const RELATED_PREFIX_CANDIDATE_CAP = 80;
const RELATED_NAME_FILL_SCAN_CAP = 1200;

/** Normalize English display line for deduplication (related list). */
function nameEnDedupeKey(row) {
  const n = String(row.name_en ?? "").trim().toLowerCase();
  return n || `\0${row.part_no}`;
}

/** English stopwords for related-part name_en token fallback (conservative). */
const EN_RELATED_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "of",
  "to",
  "in",
  "on",
  "at",
  "with",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "we",
  "our",
  "your",
  "their",
  "no",
  "not",
]);

function tokenizeNameEnForRelated(nameEn) {
  const raw = String(nameEn ?? "").toLowerCase();
  const parts = raw
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !EN_RELATED_STOP.has(t));
  const out = [];
  const seen = new Set();
  for (const t of parts) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

function scoreNameEnTokens(row, tokens) {
  const n = String(row.name_en ?? "").toLowerCase();
  let s = 0;
  for (const t of tokens) {
    if (n.includes(t)) s += 1;
  }
  return s;
}

function mapRelatedPartRow(r) {
  return {
    part_no: r.part_no,
    brand: r.brand,
    name_ch: r.name_ch,
    name_en: r.name_en,
    name_fr: r.name_fr,
    name_ar: r.name_ar,
    price: r.price,
    image_path: r.image_path ?? null,
  };
}

const listCandidatesStmt = db.prepare(`
  ${resolvedBase}
  WHERE
    @q = ''
    OR instr(lower(p.part_no), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_ch, p.name_ch)), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_en, p.name_en)), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_fr, p.name_fr)), lower(@q)) > 0
    OR instr(lower(COALESCE(o.name_ar, p.name_ar)), lower(@q)) > 0
  ORDER BY p.part_no
  LIMIT @limit
`);

const insertOverrideStmt = db.prepare(`
  INSERT INTO part_translation_overrides (
    part_no, name_ch, name_en, name_fr, name_ar, source, updated_by, updated_at
  ) VALUES (
    @part_no, @name_ch, @name_en, @name_fr, @name_ar, @source, @updated_by,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
  ON CONFLICT(part_no) DO UPDATE SET
    name_ch = excluded.name_ch,
    name_en = excluded.name_en,
    name_fr = excluded.name_fr,
    name_ar = excluded.name_ar,
    source = excluded.source,
    updated_by = excluded.updated_by,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
`);

const getOverrideByPartStmt = db.prepare(`SELECT * FROM part_translation_overrides WHERE part_no = ?`);
const listAnchorsByPartStmt = db.prepare(`
  SELECT id, part_no, name_ch, name_en, name_fr, name_ar, updated_by, created_at
  FROM translation_anchor_memory
  WHERE part_no = @part_no
  ORDER BY id DESC
  LIMIT @limit
`);
const listAnchorsStmt = db.prepare(`
  SELECT id, part_no, name_ch, name_en, name_fr, name_ar, updated_by, created_at
  FROM translation_anchor_memory
  WHERE
    @q = ''
    OR instr(lower(part_no), lower(@q)) > 0
    OR instr(lower(name_ch), lower(@q)) > 0
    OR instr(lower(COALESCE(updated_by, '')), lower(@q)) > 0
  ORDER BY id DESC
  LIMIT @limit OFFSET @offset
`);
const countAnchorsStmt = db.prepare(`
  SELECT COUNT(*) AS total
  FROM translation_anchor_memory
  WHERE
    @q = ''
    OR instr(lower(part_no), lower(@q)) > 0
    OR instr(lower(name_ch), lower(@q)) > 0
    OR instr(lower(COALESCE(updated_by, '')), lower(@q)) > 0
`);
const insertAnchorStmt = db.prepare(`
  INSERT INTO translation_anchor_memory (
    part_no, name_ch, name_en, name_fr, name_ar, updated_by, created_at
  ) VALUES (
    @part_no, @name_ch, @name_en, @name_fr, @name_ar, @updated_by,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
`);
const insertLogStmt = db.prepare(`
  INSERT INTO translation_correction_logs (action_type, payload_json, created_by, created_at)
  VALUES (@action_type, @payload_json, @created_by, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
`);
const getLogByIdStmt = db.prepare(`SELECT id, action_type, payload_json FROM translation_correction_logs WHERE id = ?`);

function requireAdminKey(req, res) {
  const expected = process.env.ADMIN_TRANSLATION_KEY || "";
  if (!expected) {
    return res.status(503).json({ error: "Admin key not configured" });
  }
  const got = req.headers["x-admin-key"];
  if (typeof got !== "string" || got !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return null;
}

function getResolvedRows(q, limit, options = {}) {
  const maxCap = options.maxCap ?? 5000;
  let n = Number.parseInt(String(limit ?? "1000"), 10);
  if (!Number.isFinite(n) || n < 1) n = 1000;
  if (n > maxCap) n = maxCap;
  return listCandidatesStmt.all({ q: String(q || "").trim(), limit: n });
}

function resolveAdminBatchRows(body, mode) {
  const q = String(body.q || "");
  const replaceScope = String(body.replace_scope || (mode === "replace" ? "catalog" : "issues_only"));
  const maxCap = mode === "replace" && replaceScope === "catalog" ? 500000 : 5000;
  const defaultN = mode === "replace" && replaceScope === "catalog" ? 200000 : 1500;
  let n = Number.parseInt(String(body.limit ?? defaultN), 10);
  if (!Number.isFinite(n) || n < 1) n = defaultN;
  return getResolvedRows(q, n, { maxCap });
}

function escapeRegExpBatch(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** literal + optional ASCII whole-word; or regex when replace_kind === "regex" */
function applyTextReplace(before, body) {
  const findText = String(body.find_text ?? "");
  const replaceText = String(body.replace_text ?? "");
  const kind = String(body.replace_kind || "literal");
  const wholeWord = Boolean(body.replace_whole_word);
  let flags = String(body.replace_regex_flags || "g");
  const str = String(before ?? "");
  if (kind === "regex") {
    if (!findText) return str;
    if (!flags.includes("g")) flags += "g";
    const re = new RegExp(findText, flags);
    return str.replace(re, replaceText);
  }
  if (!findText) return str;
  if (wholeWord && /^[\x00-\x7F]+$/.test(findText)) {
    const re = new RegExp(`\\b${escapeRegExpBatch(findText)}\\b`, "gi");
    return str.replace(re, replaceText);
  }
  return str.replaceAll(findText, replaceText);
}

/** Ranges [start,end) into `str` for preview highlighting (same rules as applyTextReplace). */
function getMatchRangesInString(str, body) {
  const s = String(str ?? "");
  const findText = String(body.find_text ?? "");
  const kind = String(body.replace_kind || "literal");
  const wholeWord = Boolean(body.replace_whole_word);
  let flags = String(body.replace_regex_flags || "g");
  if (kind === "regex") {
    if (!findText) return [];
    try {
      if (!flags.includes("g")) flags += "g";
      const re = new RegExp(findText, flags);
      return Array.from(s.matchAll(re), (m) => [m.index, m.index + m[0].length]);
    } catch {
      return [];
    }
  }
  if (!findText) return [];
  if (wholeWord && /^[\x00-\x7F]+$/.test(findText)) {
    const re = new RegExp(`\\b${escapeRegExpBatch(findText)}\\b`, "gi");
    const ranges = [];
    let m;
    while ((m = re.exec(s)) !== null) {
      ranges.push([m.index, m.index + m[0].length]);
    }
    return ranges;
  }
  const ranges = [];
  let i = 0;
  const fl = findText.length;
  while (i <= s.length - fl) {
    if (s.slice(i, i + fl) === findText) {
      ranges.push([i, i + fl]);
      i += fl;
    } else {
      i += 1;
    }
  }
  return ranges;
}

function localeRowMatchesIssuesOnly(row, lf, issueType, token) {
  const issues = extractIssueItems(row);
  return issues.some(
    (it) =>
      it.locale_field === lf &&
      (!issueType || it.issue_type === issueType) &&
      (!token || it.token === token)
  );
}

function buildBatchChangedCells(rows, body) {
  const mode = String(body.mode || "machine");
  const localeFieldRaw = String(body.locale_field || "name_en");
  const localeFields =
    localeFieldRaw === "all" ? ["name_en", "name_fr", "name_ar"] : [localeFieldRaw];
  if (!localeFields.every((f) => ["name_en", "name_fr", "name_ar"].includes(f))) {
    const err = new Error("invalid_locale_field");
    err.code = "INVALID_LOCALE";
    throw err;
  }
  const replaceScope = String(body.replace_scope || (mode === "replace" ? "catalog" : "issues_only"));
  const issueType = String(body.issue_type || "");
  const token = String(body.token || "");
  const changedCells = [];

  for (const row of rows) {
    for (const lf of localeFields) {
      const before = String(row[lf] || "");
      let after = before;

      if (mode === "replace") {
        if (replaceScope === "issues_only" && !localeRowMatchesIssuesOnly(row, lf, issueType, token)) {
          continue;
        }
        const kind = String(body.replace_kind || "literal");
        const findText = String(body.find_text ?? "");
        if (kind === "literal" && findText) {
          const ww = Boolean(body.replace_whole_word);
          if (ww && /^[\x00-\x7F]+$/.test(findText)) {
            try {
              if (!new RegExp(`\\b${escapeRegExpBatch(findText)}\\b`, "i").test(before)) continue;
            } catch {
              continue;
            }
          } else {
            if (!before.includes(findText)) continue;
          }
        }
        let raw;
        try {
          raw = applyTextReplace(before, body);
        } catch (cause) {
          const err = new Error("invalid_regex");
          err.cause = cause;
          throw err;
        }
        if (raw === before) continue;
        after = collapseSpaces(raw);
        if (!after) continue;
        changedCells.push({ part_no: row.part_no, locale_field: lf, before, after, row });
        continue;
      }

      const issues = extractIssueItems(row);
      const hit = issues.find(
        (it) =>
          (!issueType || it.issue_type === issueType) &&
          it.locale_field === lf &&
          (!token || it.token === token)
      );
      if (!hit) continue;
      after = dedupeAdjacentWords(collapseSpaces(hit.suggestion || machineTranslate(row.name_ch, lf)));
      if (!after || after === before) continue;
      changedCells.push({ part_no: row.part_no, locale_field: lf, before, after, row });
    }
  }

  return {
    changedCells,
    localeFieldRaw,
    mode,
    replaceScope,
    issueType,
    token,
  };
}

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
    image_path: row.image_path ?? null,
  });
}

/** Fuzzy list search (must be registered before /api/parts/:partNo). */
router.get("/api/parts/search", (req, res) => {
  const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  let limit = Number.parseInt(String(req.query.limit ?? "30"), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 30;
  if (limit > 100) limit = 100;
  let offset = Number.parseInt(String(req.query.offset ?? "0"), 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  if (offset > 1_000_000) offset = 1_000_000;

  if (raw.length < 2) {
    return res.status(400).json({
      error: "Query too short",
      message: "Minimum 2 characters for fuzzy search",
      query: raw,
      items: [],
      count: 0,
      total: 0,
      offset: 0,
      limit,
    });
  }

  try {
    const countRow = searchCountStmt.get({ q: raw });
    const total = Number(countRow?.total ?? 0) || 0;
    const rows = searchStmt.all({ q: raw, limit, offset });
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json({
      query: raw,
      total,
      offset,
      limit,
      count: rows.length,
      items: rows.map((r) => ({
        part_no: r.part_no,
        brand: r.brand,
        name_ch: r.name_ch,
        name_en: r.name_en,
        name_fr: r.name_fr,
        name_ar: r.name_ar,
        price: r.price,
        image_path: r.image_path ?? null,
      })),
    });
  } catch (err) {
    console.error("GET /api/parts/search error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Related catalogue links:
 * 1) Same `brand` + first 8 chars of `part_no` (up to limit).
 * 2) If fewer than limit, fill with same-brand rows whose English name (`name_en`)
 *    shares tokenizer keywords (length ≥ 2, stopword-stripped), scored by overlap.
 * Query: part_no, brand (required). limit capped at 10. Current SKU excluded.
 */
router.get("/api/parts/related", (req, res) => {
  const partNo =
    typeof req.query.part_no === "string" ? req.query.part_no.trim() : "";
  const brand = typeof req.query.brand === "string" ? req.query.brand.trim() : "";
  if (!partNo || !brand) {
    return res.status(400).json({
      error: "Bad Request",
      message: "part_no and brand are required",
      items: [],
      prefix_count: 0,
      name_fill_count: 0,
    });
  }
  let limit = Number.parseInt(String(req.query.limit ?? "10"), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 10;
  if (limit > 10) limit = 10;
  try {
    const current = stmt.get(partNo);
    if (!current) {
      return res.status(404).json({
        error: "Part not found",
        part_no: partNo,
        items: [],
        prefix_count: 0,
        name_fill_count: 0,
      });
    }
    if (String(current.brand || "").trim().toLowerCase() !== brand.toLowerCase()) {
      return res.status(400).json({
        error: "brand does not match part",
        items: [],
        prefix_count: 0,
        name_fill_count: 0,
      });
    }

    const prefixCandidateRows = relatedPartsStmt.all({
      brand,
      exclude_part_no: partNo,
      key_part_no: partNo,
      cand_limit: RELATED_PREFIX_CANDIDATE_CAP,
    });
    const excludeList = [partNo, ...prefixCandidateRows.map((r) => r.part_no)];

    const items = [];
    const seenNames = new Set();
    seenNames.add(nameEnDedupeKey(current));
    const seenParts = new Set([partNo]);

    function tryAddRow(r) {
      if (items.length >= limit) return false;
      if (seenParts.has(r.part_no)) return false;
      const nk = nameEnDedupeKey(r);
      if (seenNames.has(nk)) return false;
      seenNames.add(nk);
      seenParts.add(r.part_no);
      items.push(mapRelatedPartRow(r));
      return true;
    }

    for (const r of prefixCandidateRows) {
      if (items.length >= limit) break;
      tryAddRow(r);
    }

    if (items.length < limit) {
      const tokens = tokenizeNameEnForRelated(current.name_en);
      if (tokens.length > 0) {
        const notInPh = excludeList.map(() => "?").join(", ");
        const tokenOr = tokens
          .map(
            () => "instr(lower(COALESCE(o.name_en, p.name_en)), ?) > 0"
          )
          .join(" OR ");
        const fillerSql = `
${resolvedBase}
WHERE lower(p.brand) = lower(?)
  AND p.part_no NOT IN (${notInPh})
  AND (${tokenOr})
ORDER BY p.part_no
LIMIT ?
`;
        const fillerStmt = db.prepare(fillerSql);
        const bind = [
          brand,
          ...excludeList,
          ...tokens.map((t) => String(t).toLowerCase()),
          RELATED_NAME_FILL_SCAN_CAP,
        ];
        const fillerRows = fillerStmt.all(...bind);
        const scored = fillerRows.map((r) => ({
          r,
          s: scoreNameEnTokens(r, tokens),
        }));
        scored.sort((a, b) => {
          if (b.s !== a.s) return b.s - a.s;
          return String(a.r.part_no).localeCompare(String(b.r.part_no));
        });
        for (const x of scored) {
          if (items.length >= limit) break;
          if (x.s < 1) continue;
          tryAddRow(x.r);
        }
      }
    }

    const seedPfx = partNo.slice(0, 8).toLowerCase();
    const prefixFamilyCount = items.filter(
      (it) => String(it.part_no).slice(0, 8).toLowerCase() === seedPfx
    ).length;
    const nameFillReported = items.length - prefixFamilyCount;

    res.setHeader("Cache-Control", "public, max-age=120");
    return res.json({
      part_no: partNo,
      brand,
      prefix: partNo.substring(0, 8),
      prefix_count: prefixFamilyCount,
      name_fill_count: nameFillReported,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error("GET /api/parts/related error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/api/admin/translation/issues/grouped", (req, res) => {
  const authErr = requireAdminKey(req, res);
  if (authErr) return authErr;
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const rows = getResolvedRows(q, req.query.limit);
  const grouped = groupIssues(rows);
  return res.json({ count: grouped.length, items: grouped });
});

router.get("/api/admin/translation/issues/parts", (req, res) => {
  const authErr = requireAdminKey(req, res);
  if (authErr) return authErr;
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const rows = getResolvedRows(q, req.query.limit);
  const items = listPartsWithIssues(rows);
  return res.json({ count: items.length, items });
});

router.get("/api/admin/translation/issues/items", (req, res) => {
  const authErr = requireAdminKey(req, res);
  if (authErr) return authErr;
  const issueType = String(req.query.issue_type || "");
  const localeField = String(req.query.locale_field || "");
  const token = String(req.query.token || "");
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const rows = getResolvedRows(q, req.query.limit || 1500);
  const items = [];
  for (const row of rows) {
    const issues = extractIssueItems(row);
    for (const it of issues) {
      if (issueType && it.issue_type !== issueType) continue;
      if (
        localeField &&
        localeField !== "all" &&
        it.locale_field !== localeField
      )
        continue;
      if (token && it.token !== token) continue;
      items.push({
        part_no: row.part_no,
        brand: row.brand,
        name_ch: row.name_ch,
        name_en: row.name_en,
        name_fr: row.name_fr,
        name_ar: row.name_ar,
        issue: it,
      });
    }
  }
  return res.json({ count: items.length, items });
});

router.get("/api/admin/translation/anchors", (req, res) => {
  const authErr = requireAdminKey(req, res);
  if (authErr) return authErr;
  const partNo = String(req.query.part_no || "").trim();
  if (!partNo) return res.status(400).json({ error: "part_no is required" });
  let limit = Number.parseInt(String(req.query.limit || "50"), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 500) limit = 500;
  const items = listAnchorsByPartStmt.all({ part_no: partNo, limit });
  return res.json({ count: items.length, items });
});

router.get("/api/admin/translation/anchors/all", (req, res) => {
  const authErr = requireAdminKey(req, res);
  if (authErr) return authErr;
  const q = String(req.query.q || "").trim();
  let limit = Number.parseInt(String(req.query.limit || "50"), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 500) limit = 500;
  let offset = Number.parseInt(String(req.query.offset || "0"), 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const row = countAnchorsStmt.get({ q });
  const total = Number(row?.total || 0);
  const items = listAnchorsStmt.all({ q, limit, offset });
  return res.json({ total, count: items.length, limit, offset, items });
});

router.post("/api/admin/translation/single", (req, res) => {
  const authErr = requireAdminKey(req, res);
  if (authErr) return authErr;
  const body = req.body || {};
  const partNo = String(body.part_no || "").trim();
  if (!partNo) return res.status(400).json({ error: "part_no is required" });

  const current = stmt.get(partNo);
  if (!current) return res.status(404).json({ error: "Part not found", part_no: partNo });
  const before = getOverrideByPartStmt.get(partNo) || null;

  const next = {
    part_no: partNo,
    name_ch: collapseSpaces(body.name_ch ?? current.name_ch),
    name_en: collapseSpaces(body.name_en ?? current.name_en),
    name_fr: collapseSpaces(body.name_fr ?? current.name_fr),
    name_ar: collapseSpaces(body.name_ar ?? current.name_ar),
    source: "manual",
    updated_by: String(body.updated_by || "admin"),
  };
  insertOverrideStmt.run(next);
  const after = getOverrideByPartStmt.get(partNo);
  const anchor = {
    part_no: partNo,
    name_ch: String(after?.name_ch ?? next.name_ch ?? ""),
    name_en: String(after?.name_en ?? next.name_en ?? ""),
    name_fr: String(after?.name_fr ?? next.name_fr ?? ""),
    name_ar: String(after?.name_ar ?? next.name_ar ?? ""),
    updated_by: next.updated_by,
  };
  const anchorResult = insertAnchorStmt.run(anchor);
  const payload = { part_no: partNo, before, after };
  const log = insertLogStmt.run({
    action_type: "single_update",
    payload_json: JSON.stringify(payload),
    created_by: next.updated_by,
  });
  return res.json({
    ok: true,
    log_id: log.lastInsertRowid,
    anchor_id: anchorResult.lastInsertRowid,
    item: after,
  });
});

router.post("/api/admin/translation/batch-preview", (req, res) => {
  const authErr = requireAdminKey(req, res);
  if (authErr) return authErr;
  const body = req.body || {};
  const mode = String(body.mode || "machine");
  try {
    const rows = resolveAdminBatchRows(body, mode);
    const result = buildBatchChangedCells(rows, body);
    const matched = result.changedCells.map((c) => ({
      part_no: c.part_no,
      locale_field: c.locale_field,
      before: c.before,
      after: c.after,
      name_ch: c.row.name_ch,
      name_en: c.row.name_en,
      name_fr: c.row.name_fr,
      name_ar: c.row.name_ar,
      match_ranges: getMatchRangesInString(c.before, body),
    }));
    return res.json({
      count: matched.length,
      samples: matched.slice(0, 100),
      mode: result.mode,
    });
  } catch (e) {
    if (e.code === "INVALID_LOCALE") {
      return res.status(400).json({ error: "invalid locale_field" });
    }
    if (e.message === "invalid_regex") {
      return res.status(400).json({
        error: "无效正则表达式",
        detail: e.cause ? String(e.cause.message || e.cause) : "",
      });
    }
    console.error("batch-preview:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/api/admin/translation/batch-apply", (req, res) => {
  const authErr = requireAdminKey(req, res);
  if (authErr) return authErr;
  const body = req.body || {};
  const mode = String(body.mode || "machine");
  let result;
  let rows;
  try {
    rows = resolveAdminBatchRows(body, mode);
    result = buildBatchChangedCells(rows, body);
  } catch (e) {
    if (e.code === "INVALID_LOCALE") {
      return res.status(400).json({ error: "invalid locale_field" });
    }
    if (e.message === "invalid_regex") {
      return res.status(400).json({
        error: "无效正则表达式",
        detail: e.cause ? String(e.cause.message || e.cause) : "",
      });
    }
    console.error("batch-apply:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }

  const changedCells = result.changedCells;
  const previewReq = {
    mode: result.mode,
    locale_field: result.localeFieldRaw,
    replace_scope: result.replaceScope,
    replace_kind: body.replace_kind || "literal",
    replace_whole_word: Boolean(body.replace_whole_word),
    issue_type: result.issueType,
    token: result.token,
    q: body.q || "",
    limit: body.limit,
    find_text: body.find_text || "",
    replace_text: body.replace_text || "",
  };

  const byPart = new Map();
  for (const c of changedCells) {
    let acc = byPart.get(c.part_no);
    if (!acc) {
      acc = { row: c.row, patches: {} };
      byPart.set(c.part_no, acc);
    }
    acc.patches[c.locale_field] = c.after;
  }

  const actor = String(body.updated_by || "admin");
  const tx = db.transaction((entries) => {
    for (const [partNo, acc] of entries) {
      const row = acc.row;
      const next = {
        part_no: partNo,
        name_ch: row.name_ch,
        name_en: acc.patches.name_en ?? row.name_en,
        name_fr: acc.patches.name_fr ?? row.name_fr,
        name_ar: acc.patches.name_ar ?? row.name_ar,
        source: "batch_rule",
        updated_by: actor,
      };
      insertOverrideStmt.run(next);
      // Persist a high-confidence anchor snapshot for batch updates too.
      insertAnchorStmt.run({
        part_no: partNo,
        name_ch: String(next.name_ch ?? ""),
        name_en: String(next.name_en ?? ""),
        name_fr: String(next.name_fr ?? ""),
        name_ar: String(next.name_ar ?? ""),
        updated_by: actor,
      });
    }
  });
  tx(Array.from(byPart.entries()));

  const logPayload = {
    request: previewReq,
    changed_count: byPart.size,
    changed_cells: changedCells.length,
    samples: changedCells.slice(0, 100).map((it) => ({
      part_no: it.part_no,
      locale_field: it.locale_field,
      before: it.before,
      after: it.after,
    })),
  };
  const log = insertLogStmt.run({
    action_type: "batch_update",
    payload_json: JSON.stringify(logPayload),
    created_by: actor,
  });
  return res.json({ ok: true, changed: byPart.size, log_id: log.lastInsertRowid });
});

router.post("/api/admin/translation/rollback", (req, res) => {
  const authErr = requireAdminKey(req, res);
  if (authErr) return authErr;
  const body = req.body || {};
  const logId = Number.parseInt(String(body.log_id || ""), 10);
  if (!Number.isFinite(logId)) return res.status(400).json({ error: "log_id required" });
  const log = getLogByIdStmt.get(logId);
  if (!log) return res.status(404).json({ error: "log not found" });
  const payload = JSON.parse(log.payload_json || "{}");
  const samples = Array.isArray(payload.samples) ? payload.samples : [];
  const actor = String(body.updated_by || "admin");
  const tx = db.transaction((items) => {
    for (const it of items) {
      const current = stmt.get(it.part_no);
      if (!current) continue;
      const next = {
        part_no: it.part_no,
        name_ch: current.name_ch,
        name_en: it.locale_field === "name_en" ? it.before : current.name_en,
        name_fr: it.locale_field === "name_fr" ? it.before : current.name_fr,
        name_ar: it.locale_field === "name_ar" ? it.before : current.name_ar,
        source: "manual",
        updated_by: actor,
      };
      if (
        next.name_ch === current.name_ch &&
        next.name_en === current.name_en &&
        next.name_fr === current.name_fr &&
        next.name_ar === current.name_ar
      ) {
        continue;
      }
      insertOverrideStmt.run(next);
    }
  });
  tx(samples);

  const rollbackLog = insertLogStmt.run({
    action_type: "rollback",
    payload_json: JSON.stringify({ rollback_of_log_id: logId, recovered: samples.length }),
    created_by: actor,
  });
  return res.json({ ok: true, recovered: samples.length, log_id: rollbackLog.lastInsertRowid });
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

router.get("/api/site-config", (_req, res) => {
  try {
    const row = getUsdCnyRateStmt.get();
    const parsed = Number.parseFloat(String(row?.value ?? "7.2"));
    const usdCnyRate = Number.isFinite(parsed) && parsed > 0 ? parsed : 7.2;
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json({
      usd_cny_rate: Number(usdCnyRate.toFixed(6)),
    });
  } catch (err) {
    console.error("GET /api/site-config error:", err);
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

