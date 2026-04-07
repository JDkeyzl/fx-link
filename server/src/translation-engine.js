const path = require("path");

// eslint-disable-next-line import/no-dynamic-require, global-require
const glossary = require(path.join(__dirname, "..", "..", "web", "scripts", "glossary-auto-parts.cjs"));

const BRAND_MAP = {
  朝阳: { en: "CHAOYANG", fr: "CHAOYANG", ar: "CHAOYANG" },
  重汽: { en: "SINOTRUK", fr: "SINOTRUK", ar: "SINOTRUK" },
  豪沃: { en: "HOWO", fr: "HOWO", ar: "HOWO" },
  陕汽: { en: "SHACMAN", fr: "SHACMAN", ar: "SHACMAN" },
  潍柴: { en: "WEICHAI", fr: "WEICHAI", ar: "WEICHAI" },
};

const SINGLE_CHAR_WHITELIST = new Set(["左", "右", "前", "后", "上", "下", "大", "小", "内", "外"]);
const CJK_RE = /[\u3400-\u9fff]/;

const phraseEntries = Object.entries(glossary)
  .filter(([k]) => k.length >= 2)
  .sort((a, b) => b[0].length - a[0].length);
const singleCharEntries = Object.entries(glossary).filter(([k]) => k.length === 1);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collapseSpaces(s) {
  return String(s || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?/()\-])/g, "$1")
    .replace(/([/()\-])\s+/g, "$1")
    .trim();
}

function dedupeAdjacentWords(s) {
  const parts = String(s || "").split(/\s+/).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    if (prev && prev.toLowerCase() === p.toLowerCase()) continue;
    out.push(p);
  }
  return out.join(" ");
}

function localeKeyToGlossaryField(localeField) {
  if (localeField === "name_fr") return "fr";
  if (localeField === "name_ar") return "ar";
  return "en";
}

function applyMap(text, entries, localeField) {
  const langKey = localeKeyToGlossaryField(localeField);
  let out = String(text || "");
  for (const [src, t] of entries) {
    if (!out.includes(src)) continue;
    const to = t?.[langKey];
    if (!to) continue;
    out = out.replace(new RegExp(escapeRegExp(src), "g"), ` ${to} `);
  }
  return out;
}

function applyBrandMap(text, localeField) {
  const langKey = localeKeyToGlossaryField(localeField);
  let out = String(text || "");
  for (const [src, item] of Object.entries(BRAND_MAP)) {
    if (!out.includes(src)) continue;
    const to = item?.[langKey] || item?.en;
    if (!to) continue;
    out = out.replace(new RegExp(escapeRegExp(src), "g"), ` ${to} `);
  }
  return out;
}

function applySingleCharMap(text, localeField) {
  const langKey = localeKeyToGlossaryField(localeField);
  let out = String(text || "");
  for (const [src, t] of singleCharEntries) {
    if (!SINGLE_CHAR_WHITELIST.has(src)) continue;
    if (!out.includes(src)) continue;
    const to = t?.[langKey];
    if (!to) continue;
    out = out.replace(new RegExp(escapeRegExp(src), "g"), ` ${to} `);
  }
  return out;
}

function machineTranslate(sourceNameCh, localeField) {
  const source = String(sourceNameCh || "").trim();
  if (!source) return "";
  let out = source;
  out = applyBrandMap(out, localeField);
  out = applyMap(out, phraseEntries, localeField);
  out = applySingleCharMap(out, localeField);
  out = dedupeAdjacentWords(collapseSpaces(out));
  return out;
}

function extractIssueItems(row) {
  const source = String(row.name_ch || "");
  const locales = ["name_en", "name_fr", "name_ar"];
  const issues = [];

  for (const field of locales) {
    const value = String(row[field] || "");
    if (!value) continue;

    if (CJK_RE.test(value)) {
      issues.push({
        issue_type: "contains_cjk_after_translation",
        locale_field: field,
        token: "cjk",
        suggestion: machineTranslate(source, field),
      });
    }

    const dup = value.match(/\b([A-Za-z]+)\s+\1\b/i);
    if (dup) {
      issues.push({
        issue_type: "duplicate_term",
        locale_field: field,
        token: dup[1],
        suggestion: dedupeAdjacentWords(value),
      });
    }

    if (value.includes("_") || /\s{2,}/.test(value)) {
      issues.push({
        issue_type: "separator_format_issue",
        locale_field: field,
        token: "_space",
        suggestion: collapseSpaces(value),
      });
    }

    if (source.includes("朝阳") && (value.includes("Toward") || CJK_RE.test(value))) {
      issues.push({
        issue_type: "brand_split_translation",
        locale_field: field,
        token: "朝阳",
        suggestion: machineTranslate(source, field),
      });
    }

    const machine = machineTranslate(source, field);
    if (machine && machine !== value) {
      issues.push({
        issue_type: "machine_suggestion",
        locale_field: field,
        token: "auto",
        suggestion: machine,
      });
    }
  }
  return issues;
}

function groupIssues(rows) {
  const map = new Map();
  for (const row of rows) {
    const items = extractIssueItems(row);
    for (const it of items) {
      const key = `${it.issue_type}|${it.token}`;
      let prev = map.get(key);
      if (!prev) {
        prev = {
          issue_type: it.issue_type,
          token: it.token,
          partNos: new Set(),
          locale_fields: new Set(),
          sample_parts: [],
        };
        map.set(key, prev);
      }
      prev.locale_fields.add(it.locale_field);
      if (!prev.partNos.has(row.part_no)) {
        prev.partNos.add(row.part_no);
        if (prev.sample_parts.length < 5) {
          prev.sample_parts.push({
            part_no: row.part_no,
            name_ch: row.name_ch,
            locale_field: it.locale_field,
            value: row[it.locale_field],
            suggestion: it.suggestion,
          });
        }
      }
    }
  }
  return Array.from(map.values())
    .map((v) => ({
      issue_type: v.issue_type,
      token: v.token,
      locale_fields: Array.from(v.locale_fields).sort(),
      count: v.partNos.size,
      sample_parts: v.sample_parts,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * One row per part_no for admin list: every candidate row from the filter is kept.
 * `issues` may be empty when translations look clean but the row still matches text / part search.
 */
function listPartsWithIssues(rows) {
  const out = [];
  for (const row of rows) {
    const issues = extractIssueItems(row);
    const locale_fields = issues.length
      ? [...new Set(issues.map((i) => i.locale_field))].sort()
      : [];
    const issue_types = issues.length
      ? [...new Set(issues.map((i) => i.issue_type))].sort()
      : [];
    out.push({
      part_no: row.part_no,
      brand: row.brand,
      name_ch: row.name_ch,
      name_en: row.name_en,
      name_fr: row.name_fr,
      name_ar: row.name_ar,
      issues,
      locale_fields,
      issue_types,
    });
  }
  out.sort((a, b) => String(a.part_no).localeCompare(String(b.part_no), "en"));
  return out;
}

module.exports = {
  machineTranslate,
  extractIssueItems,
  groupIssues,
  listPartsWithIssues,
  collapseSpaces,
  dedupeAdjacentWords,
};

