#!/usr/bin/env node
/**
 * 为 final_data.json 每条记录添加 en_name, fr_name, alb_name（汽配术语表翻译）
 * 用法：在 web 目录执行 node scripts/add-i18n-names.cjs
 * 输出：data/final_data_i18n.json（确认无误后可替换 final_data.json）
 */

const fs = require("fs");
const path = require("path");
const glossary = require("./glossary-auto-parts.cjs");

const DATA_DIR = path.join(__dirname, "..", "data");
const INPUT_FILE = path.join(DATA_DIR, "final_data.json");
const OUTPUT_FILE = path.join(DATA_DIR, "final_data_i18n.json");

// 按 key 长度降序，优先匹配长词
const sortedKeys = Object.keys(glossary).sort((a, b) => b.length - a.length);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collapseSpaces(s) {
  return s.replace(/\s+/g, " ").trim();
}

function translateName(name) {
  if (!name || typeof name !== "string") {
    return { en: name || "", fr: name || "", ar: name || "" };
  }
  let text = name.trim();
  if (!text) return { en: "", fr: "", ar: "" };

  let en = text;
  let fr = text;
  let ar = text;
  for (const key of sortedKeys) {
    if (!text.includes(key)) continue;
    const t = glossary[key];
    const re = new RegExp(escapeRegExp(key), "g");
    en = en.replace(re, " " + t.en + " ");
    fr = fr.replace(re, " " + t.fr + " ");
    ar = ar.replace(re, " " + t.ar + " ");
  }
  return {
    en: collapseSpaces(en),
    fr: collapseSpaces(fr),
    ar: collapseSpaces(ar),
  };
}

function main() {
  console.log("[add-i18n] Reading", INPUT_FILE);
  const raw = fs.readFileSync(INPUT_FILE, "utf-8");
  const data = JSON.parse(raw);

  let count = 0;
  for (const partNo of Object.keys(data)) {
    const items = data[partNo];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const name = item.name;
      const { en, fr, ar } = translateName(name);
      item.en_name = en || name;
      item.fr_name = fr || name;
      item.alb_name = ar || name;
      count++;
    }
  }

  console.log("[add-i18n] Translated", count, "items. Writing", OUTPUT_FILE);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), "utf-8");
  console.log("[add-i18n] Done. Output:", OUTPUT_FILE);
}

main();
