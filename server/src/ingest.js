const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ExcelJS = require("exceljs");
const XLSX = require("xlsx");
const { openDb, initSchema, resolveDbPath } = require("./db");

function getEnv(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v;
}

const DEFAULT_DATA_DIR = path.join(
  __dirname,
  "..",
  "..",
  "web",
  "data",
  "format_data"
);

const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 5000);
const LOG_EVERY = Number(process.env.LOG_EVERY || 50000);
const DEFAULT_FINAL_I18N_FILE = path.join(
  __dirname,
  "..",
  "..",
  "web",
  "data",
  "final_data_i18n.json"
);
const DEFAULT_GLOSSARY_FILE = path.join(
  __dirname,
  "..",
  "..",
  "web",
  "scripts",
  "glossary-auto-parts.cjs"
);
const FINAL_I18N_FILE = process.env.FINAL_I18N_FILE || DEFAULT_FINAL_I18N_FILE;
const GLOSSARY_FILE = process.env.GLOSSARY_FILE || DEFAULT_GLOSSARY_FILE;
const UNTRANSLATED_REPORT_FILE = path.join(
  __dirname,
  "..",
  "data",
  "translation-unresolved-report.json"
);
const SEGMENT_TRANSLATION_CACHE_FILE = path.join(
  __dirname,
  "..",
  "data",
  "segment-translation-cache.json"
);
const ENABLE_ONLINE_TRANSLATION = getEnv("ENABLE_ONLINE_TRANSLATION", "1") === "1";
const ONLINE_TRANSLATION_TIMEOUT_MS = Number(getEnv("ONLINE_TRANSLATION_TIMEOUT_MS", "1200"));
const ONLINE_TRANSLATION_MAX_NEW_SEGMENTS = Number(
  getEnv("ONLINE_TRANSLATION_MAX_NEW_SEGMENTS", "300")
);

function normalizeCellValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);

  // exceljs may return objects: { text }, { richText }, { result }
  if (typeof value === "object") {
    if (value.text !== undefined) return String(value.text).trim();
    if (Array.isArray(value.richText)) {
      return value.richText.map((t) => t && t.text).filter(Boolean).join("").trim();
    }
    if (value.result !== undefined) return String(value.result).trim();
    if (value.formula !== undefined) return String(value.formula).trim();
  }
  return String(value).trim();
}

function parsePriceToNumber(raw) {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === "number") return raw;
  const s = String(raw).trim();
  // For strict requirement: price should be a valid number. Non-numeric rows are skipped.
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
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

function loadI18nByPartNo() {
  if (!fs.existsSync(FINAL_I18N_FILE)) {
    // eslint-disable-next-line no-console
    console.warn(`[ingest] i18n file missing, fallback to glossary only: ${FINAL_I18N_FILE}`);
    return new Map();
  }
  const raw = fs.readFileSync(FINAL_I18N_FILE, "utf-8");
  const data = JSON.parse(raw);
  const map = new Map();
  for (const [partNo, items] of Object.entries(data)) {
    const en = chooseFirstNonEmpty(items, "en_name");
    const fr = chooseFirstNonEmpty(items, "fr_name");
    const ar = chooseFirstNonEmpty(items, "alb_name");
    if (en || fr || ar) map.set(partNo, { en, fr, ar });
  }
  // eslint-disable-next-line no-console
  console.log(`[ingest] loaded i18n map: ${map.size} part numbers`);
  return map;
}

function createGlossaryTranslator() {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const glossary = require(GLOSSARY_FILE);
  const keys = Object.keys(glossary).sort((a, b) => b.length - a.length);
  const compiled = keys.map((k) => {
    const t = glossary[k];
    return {
      key: k,
      re: new RegExp(escapeRegExp(k), "g"),
      en: t.en,
      fr: t.fr,
      ar: t.ar,
    };
  });

  return function translateName(nameCh) {
    const text = String(nameCh || "").trim();
    if (!text) return { en: "", fr: "", ar: "" };
    let en = text;
    let fr = text;
    let ar = text;
    for (const it of compiled) {
      if (!text.includes(it.key)) continue;
      en = en.replace(it.re, ` ${it.en} `);
      fr = fr.replace(it.re, ` ${it.fr} `);
      ar = ar.replace(it.re, ` ${it.ar} `);
    }
    return {
      en: collapseSpaces(en),
      fr: collapseSpaces(fr),
      ar: collapseSpaces(ar),
    };
  };
}

function createNameResolver() {
  const byPartNo = loadI18nByPartNo();
  const translate = createGlossaryTranslator();
  const cacheByName = new Map();
  const stats = {
    total: 0,
    fullyTranslated: 0,
    notFullyTranslated: 0,
    samples: [],
  };

  const hasCjk = (s) => /[\u3400-\u9fff]/.test(String(s || ""));
  const cjkSegmentRe = /[\u3400-\u9fff]+/g;
  let segmentCache = {};
  if (fs.existsSync(SEGMENT_TRANSLATION_CACHE_FILE)) {
    try {
      segmentCache = JSON.parse(fs.readFileSync(SEGMENT_TRANSLATION_CACHE_FILE, "utf-8"));
    } catch {
      segmentCache = {};
    }
  }
  let onlineNewSegmentCount = 0;

  function translateSegmentOnline(segment, tl) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=${tl}&dt=t&q=${encodeURIComponent(
        segment
      )}`;
      const out = execFileSync("curl", ["-fsSL", url], {
        encoding: "utf-8",
        timeout: ONLINE_TRANSLATION_TIMEOUT_MS,
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

  function getSegmentTranslation(segment) {
    if (!segmentCache[segment]) {
      segmentCache[segment] = { en: "", fr: "", ar: "" };
    }
    const item = segmentCache[segment];
    if (!ENABLE_ONLINE_TRANSLATION) return item;
    const needsFetch = !item.en || !item.fr || !item.ar;
    if (needsFetch && onlineNewSegmentCount >= ONLINE_TRANSLATION_MAX_NEW_SEGMENTS) {
      return item;
    }
    if (needsFetch) onlineNewSegmentCount += 1;
    if (!item.en) item.en = translateSegmentOnline(segment, "en");
    if (!item.fr) item.fr = translateSegmentOnline(segment, "fr");
    if (!item.ar) item.ar = translateSegmentOnline(segment, "ar");
    return item;
  }

  function replaceResidualCjkWithMT(text, langKey) {
    const source = String(text || "");
    if (!hasCjk(source)) return source;
    return collapseSpaces(
      source.replace(cjkSegmentRe, (seg) => {
        const t = getSegmentTranslation(seg);
        const picked = langKey === "fr" ? t.fr : langKey === "ar" ? t.ar : t.en;
        return picked || seg;
      })
    );
  }

  const resolveNames = function resolveNames(partNo, nameCh) {
    const key = String(partNo || "").trim();
    const source = String(nameCh || "").trim();
    const mapped = byPartNo.get(key);
    let en = mapped?.en || "";
    let fr = mapped?.fr || "";
    let ar = mapped?.ar || "";

    if (!en || !fr || !ar) {
      let cached = cacheByName.get(source);
      if (!cached) {
        cached = translate(source);
        cacheByName.set(source, cached);
      }
      en = en || cached.en;
      fr = fr || cached.fr;
      ar = ar || cached.ar;
    }

    const name_en = collapseSpaces(en);
    const name_fr = collapseSpaces(fr);
    const name_ar = collapseSpaces(ar);
    const name_en_mt = replaceResidualCjkWithMT(name_en, "en");
    const name_fr_mt = replaceResidualCjkWithMT(name_fr, "fr");
    const name_ar_mt = replaceResidualCjkWithMT(name_ar, "ar");
    // Completion criteria (realistic):
    // - all locale fields are non-empty
    // - if the source contains Hanzi, avoid the "no translation happened" case
    //   where all three locales equal the source exactly
    // - if the source does NOT contain Hanzi (pure letters/numbers),
    //   exact equality is fine and should be treated as "no translation needed"
    const complete =
      !!name_en_mt &&
      !!name_fr_mt &&
      !!name_ar_mt &&
      (!hasCjk(source) ||
        !(name_en_mt === source && name_fr_mt === source && name_ar_mt === source));

    stats.total += 1;
    if (complete) stats.fullyTranslated += 1;
    else {
      stats.notFullyTranslated += 1;
      if (stats.samples.length < 200) {
        stats.samples.push({
          part_no: key,
          name_ch: source,
          name_en: name_en_mt,
          name_fr: name_fr_mt,
          name_ar: name_ar_mt,
        });
      }
    }

    return {
      name_ch: source,
      // No Chinese fallback here; rely on i18n map + glossary expansion.
      name_en: name_en_mt,
      name_fr: name_fr_mt,
      name_ar: name_ar_mt,
      complete,
    };
  };
  resolveNames.stats = stats;
  resolveNames.flushCache = () => {
    fs.writeFileSync(SEGMENT_TRANSLATION_CACHE_FILE, JSON.stringify(segmentCache, null, 2), "utf-8");
    // eslint-disable-next-line no-console
    console.log(`[ingest] online translated new segments: ${onlineNewSegmentCount}`);
  };
  return resolveNames;
}

function findHeaderIndicesFromRowValues(values) {
  // exceljs: row.values is 1-based array. values[0] is empty.
  let nameIdx = -1;
  let priceIdx = -1;
  let partNoIdx = -1;
  for (let i = 1; i < values.length; i++) {
    const v = normalizeCellValue(values[i]);
    if (v === "名称") nameIdx = i;
    if (v === "单价") priceIdx = i;
    if (v === "编号") partNoIdx = i;
  }
  if (nameIdx === -1 || priceIdx === -1 || partNoIdx === -1) return null;
  return { nameIdx, priceIdx, partNoIdx };
}

function ingestBatch(db, insertStmt, batch, brand, resolveNames) {
  if (batch.length === 0) return 0;
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      const names = resolveNames(r.part_no, r.name_ch);
      insertStmt.run({
        part_no: r.part_no,
        brand: brand,
        name_ch: names.name_ch,
        name_en: names.name_en,
        name_fr: names.name_fr,
        name_ar: names.name_ar,
        price: r.price,
      });
    }
  });
  tx(batch);
  return batch.length;
}

async function ingestXlsxFile(db, insertStmt, filePath, brand, resolveNames) {
  // Streaming parser for large .xlsx files.
  return new Promise((resolve, reject) => {
    // exceljs 版本差异较多：这里尽量使用最简单的 WorkbookReader 构造方式，
    // 确保可以触发 worksheet/row/end 事件。
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath);

    let header = null;
    let total = 0;
    let batch = [];

    const flush = () => {
      const n = ingestBatch(db, insertStmt, batch, brand, resolveNames);
      total += n;
      batch = [];
      if (total % LOG_EVERY === 0) {
        // eslint-disable-next-line no-console
        console.log(`[ingest] ${brand}: inserted ${total} rows`);
      }
    };

    let worksheetSeen = 0;
    workbookReader.on("worksheet", (worksheet) => {
      worksheetSeen += 1;
      if (worksheetSeen > 1) {
        // We only need the first sheet.
        return;
      }

      worksheet.on("row", (row) => {
        if (!row || !row.values) return;

        if (!header) {
          const maybe = findHeaderIndicesFromRowValues(row.values);
          if (maybe) {
            header = maybe;
          }
          return;
        }

        const name_ch = normalizeCellValue(row.values[header.nameIdx]);
        const part_no = normalizeCellValue(row.values[header.partNoIdx]);
        const priceRaw = row.values[header.priceIdx];
        const price = parsePriceToNumber(priceRaw);

        if (!part_no || !name_ch) return;
        if (!Number.isFinite(price)) return; // skip non-numeric price rows

        batch.push({ part_no, name_ch, price });
        if (batch.length >= BATCH_SIZE) flush();
      });
    });

    workbookReader.on("error", (err) => reject(err));

    const timeout = setTimeout(() => {
      reject(new Error(`[ingest] xlsx parsing timeout: ${path.basename(filePath)}`));
    }, Number(process.env.XLSX_INGEST_TIMEOUT_MS || 120000));

    workbookReader.on("end", () => {
      try {
        flush();
        clearTimeout(timeout);
        // eslint-disable-next-line no-console
        console.log(`[ingest] ${brand}: done (xlsx)`);
        resolve();
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });

    // IMPORTANT: WorkbookReader is lazy; we must call `.read()` to start parsing
    // and trigger worksheet/row/end events.
    workbookReader.read().catch((err) => reject(err));
  });
}

async function ingestXlsFile(db, insertStmt, filePath, brand, resolveNames) {
  // .xls may not be stream-friendly. Requirement says large data is xlsx.
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  let header = null;
  let total = 0;
  let batch = [];

  for (const rowArr of rows) {
    if (!rowArr) continue;

    if (!header) {
      const maybe = findHeaderIndicesFromRowValues([null, ...rowArr]);
      if (maybe) header = maybe;
      continue;
    }

    const name_ch = normalizeCellValue(rowArr[header.nameIdx - 1]);
    const part_no = normalizeCellValue(rowArr[header.partNoIdx - 1]);
    const price = parsePriceToNumber(rowArr[header.priceIdx - 1]);

    if (!part_no || !name_ch) continue;
    if (!Number.isFinite(price)) continue;

    batch.push({ part_no, name_ch, price });
    if (batch.length >= BATCH_SIZE) {
      const n = ingestBatch(db, insertStmt, batch, brand, resolveNames);
      total += n;
      batch = [];
      if (total % LOG_EVERY === 0) {
        // eslint-disable-next-line no-console
        console.log(`[ingest] ${brand}: inserted ${total} rows`);
      }
    }
  }

  ingestBatch(db, insertStmt, batch, brand, resolveNames);
  // eslint-disable-next-line no-console
  console.log(`[ingest] ${brand}: done (xls), total inserted: ${total}`);
}

async function main() {
  const shouldReset = getEnv("RESET_DB", "0") === "1";

  if (shouldReset) {
    const dbPathResolved = resolveDbPath();
    if (fs.existsSync(dbPathResolved)) {
      // eslint-disable-next-line no-console
      console.log(`[ingest] RESET_DB=1 => removing existing db: ${dbPathResolved}`);
      fs.unlinkSync(dbPathResolved);
    }
  }

  const db = openDb();
  initSchema(db);
  const resolveNames = createNameResolver();

  const insertStmt = db.prepare(`
    INSERT INTO parts (part_no, brand, name_ch, name_en, name_fr, name_ar, price)
    VALUES (@part_no, @brand, @name_ch, @name_en, @name_fr, @name_ar, @price)
    ON CONFLICT(part_no) DO NOTHING
  `);

  const entries = fs
    .readdirSync(DATA_DIR)
    .map((name) => path.join(DATA_DIR, name))
    .filter((p) => fs.statSync(p).isFile());

  const excelFiles = entries.filter((p) => {
    const ext = path.extname(p).toLowerCase();
    return ext === ".xlsx" || ext === ".xls";
  });

  if (excelFiles.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`[ingest] no excel files found in: ${DATA_DIR}`);
    process.exit(0);
  }

  // eslint-disable-next-line no-console
  console.log(`[ingest] starting ingestion from: ${DATA_DIR}`);

  for (const filePath of excelFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const brand = path.basename(filePath, ext).trim();
    // eslint-disable-next-line no-console
    console.log(`[ingest] importing brand=${brand} file=${path.basename(filePath)}`);
    if (ext === ".xlsx") {
      await ingestXlsxFile(db, insertStmt, filePath, brand, resolveNames);
    } else {
      await ingestXlsFile(db, insertStmt, filePath, brand, resolveNames);
    }
  }

  // eslint-disable-next-line no-console
  console.log("[ingest] all done");
  // eslint-disable-next-line no-console
  console.log(
    `[ingest] translation stats => total=${resolveNames.stats.total}, fully_translated=${resolveNames.stats.fullyTranslated}, not_fully_translated=${resolveNames.stats.notFullyTranslated}`
  );
  resolveNames.flushCache();
  // eslint-disable-next-line no-console
  console.log(`[ingest] translation cache: ${SEGMENT_TRANSLATION_CACHE_FILE}`);
  fs.writeFileSync(
    UNTRANSLATED_REPORT_FILE,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total: resolveNames.stats.total,
        fully_translated: resolveNames.stats.fullyTranslated,
        not_fully_translated: resolveNames.stats.notFullyTranslated,
        sample_limit: resolveNames.stats.samples.length,
        samples: resolveNames.stats.samples,
      },
      null,
      2
    ),
    "utf-8"
  );
  // eslint-disable-next-line no-console
  console.log(`[ingest] unresolved report: ${UNTRANSLATED_REPORT_FILE}`);
}

main().catch((err) => {
  console.error("[ingest] failed:", err);
  process.exit(1);
});

