const fs = require("fs");
const path = require("path");
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
  "format data"
);

const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 5000);
const LOG_EVERY = Number(process.env.LOG_EVERY || 50000);

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

function ingestBatch(db, insertStmt, batch, brand) {
  if (batch.length === 0) return 0;
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      insertStmt.run({
        part_no: r.part_no,
        brand: brand,
        name_en: r.name_en,
        price: r.price,
      });
    }
  });
  tx(batch);
  return batch.length;
}

async function ingestXlsxFile(db, insertStmt, filePath, brand) {
  // Streaming parser for large .xlsx files.
  return new Promise((resolve, reject) => {
    // exceljs 版本差异较多：这里尽量使用最简单的 WorkbookReader 构造方式，
    // 确保可以触发 worksheet/row/end 事件。
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath);

    let header = null;
    let total = 0;
    let batch = [];

    const flush = () => {
      const n = ingestBatch(db, insertStmt, batch, brand);
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

        const name_en = normalizeCellValue(row.values[header.nameIdx]);
        const part_no = normalizeCellValue(row.values[header.partNoIdx]);
        const priceRaw = row.values[header.priceIdx];
        const price = parsePriceToNumber(priceRaw);

        if (!part_no || !name_en) return;
        if (!Number.isFinite(price)) return; // skip non-numeric price rows

        batch.push({ part_no, name_en, price });
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

async function ingestXlsFile(db, insertStmt, filePath, brand) {
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

    const name_en = normalizeCellValue(rowArr[header.nameIdx - 1]);
    const part_no = normalizeCellValue(rowArr[header.partNoIdx - 1]);
    const price = parsePriceToNumber(rowArr[header.priceIdx - 1]);

    if (!part_no || !name_en) continue;
    if (!Number.isFinite(price)) continue;

    batch.push({ part_no, name_en, price });
    if (batch.length >= BATCH_SIZE) {
      const n = ingestBatch(db, insertStmt, batch, brand);
      total += n;
      batch = [];
      if (total % LOG_EVERY === 0) {
        // eslint-disable-next-line no-console
        console.log(`[ingest] ${brand}: inserted ${total} rows`);
      }
    }
  }

  ingestBatch(db, insertStmt, batch, brand);
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

  const insertStmt = db.prepare(`
    INSERT INTO parts (part_no, brand, name_en, price)
    VALUES (@part_no, @brand, @name_en, @price)
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
      await ingestXlsxFile(db, insertStmt, filePath, brand);
    } else {
      await ingestXlsFile(db, insertStmt, filePath, brand);
    }
  }

  // eslint-disable-next-line no-console
  console.log("[ingest] all done");
}

main().catch((err) => {
  console.error("[ingest] failed:", err);
  process.exit(1);
});

