#!/usr/bin/env node
/**
 * 扫描 final_data_i18n.json 中 en_name/fr_name/alb_name 仍含中文的条目，输出样例便于补词
 * 用法：node scripts/check-remaining-chinese.cjs
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "data", "final_data_i18n.json");
const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;

const samples = { en: [], fr: [], ar: [] };
let countEn = 0,
  countFr = 0,
  countAr = 0;

for (const partNo of Object.keys(data)) {
  const items = data[partNo];
  if (!Array.isArray(items)) continue;
  for (const item of items) {
    if (item.en_name && CJK.test(item.en_name)) {
      countEn++;
      if (samples.en.length < 50) samples.en.push(item.en_name);
    }
    if (item.fr_name && CJK.test(item.fr_name)) {
      countFr++;
      if (samples.fr.length < 50) samples.fr.push(item.fr_name);
    }
    if (item.alb_name && CJK.test(item.alb_name)) {
      countAr++;
      if (samples.ar.length < 50) samples.ar.push(item.alb_name);
    }
  }
}

console.log("Remaining Chinese in translations:");
console.log("  en_name:", countEn, "| fr_name:", countFr, "| alb_name:", countAr);
console.log("\nSample en_name with Chinese (max 50):");
samples.en.forEach((s) => console.log(" ", s));
console.log("\nSample fr_name with Chinese (max 50):");
samples.fr.forEach((s) => console.log(" ", s));
console.log("\nSample alb_name with Chinese (max 50):");
samples.ar.forEach((s) => console.log(" ", s));
