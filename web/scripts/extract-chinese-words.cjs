#!/usr/bin/env node
/**
 * 从 final_data_i18n.json 的 en_name 中提取仍含中文的条目里的中文词（连续汉字），按出现次数排序
 * 用法：node scripts/extract-chinese-words.cjs
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "data", "final_data_i18n.json");
const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]+/g;
const count = {};

for (const partNo of Object.keys(data)) {
  const items = data[partNo];
  if (!Array.isArray(items)) continue;
  for (const item of items) {
    const name = item.en_name || "";
    if (!/[\u4e00-\u9fff\u3400-\u4dbf]/.test(name)) continue;
    let m;
    while ((m = CJK.exec(name)) !== null) {
      const w = m[0];
      count[w] = (count[w] || 0) + 1;
    }
  }
}

const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]);
console.log("Unique Chinese phrases (by frequency), total:", sorted.length);
sorted.forEach(([word, n]) => console.log(n + "\t" + word));
