#!/usr/bin/env node
/**
 * Copy hero and icon images from source/ to public/ for Next.js to serve.
 * Run: node scripts/copy-assets.cjs (or npm run copy-assets)
 */
const fs = require("fs");
const path = require("path");

const webDir = path.join(__dirname, "..");
const pairs = [
  [path.join(webDir, "source", "hero_image"), path.join(webDir, "public", "hero")],
  [path.join(webDir, "source", "icon_svg"), path.join(webDir, "public", "icon_svg")],
  // Partner logos: source/logo -> public/logo
  [path.join(webDir, "source", "logo"), path.join(webDir, "public", "logo")],
];
const singleFiles = [
  [path.join(webDir, "source", "logo.png"), path.join(webDir, "public", "logo.png")],
  [path.join(webDir, "source", "contact.png"), path.join(webDir, "public", "contact.png")],
  [path.join(webDir, "source", "whyus.jpg"), path.join(webDir, "public", "whyus.jpg")],
  [path.join(webDir, "source", "WhatsApp.png"), path.join(webDir, "public", "WhatsApp.png")],
  [path.join(webDir, "source", "img", "sin.svg"), path.join(webDir, "public", "img", "sin.svg")],
  [path.join(webDir, "source", "img", "worldmap.png"), path.join(webDir, "public", "img", "worldmap.png")],
];

for (const [srcDir, destDir] of pairs) {
  if (!fs.existsSync(srcDir)) {
    console.warn("[copy-assets] Skip (missing):", srcDir);
    continue;
  }
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const files = fs.readdirSync(srcDir);
  const isPartnerLogo = destDir.includes(path.join("public", "logo"));
  const imageExt = /\.(png|jpe?g|gif|webp|svg)$/i;
  for (const f of files) {
    const src = path.join(srcDir, f);
    if (!fs.statSync(src).isFile()) continue;
    if (isPartnerLogo && !imageExt.test(f)) continue;
    const dest = path.join(destDir, f);
    fs.copyFileSync(src, dest);
    console.log("[copy-assets]", f, "->", path.relative(webDir, dest));
  }
}
for (const [src, dest] of singleFiles) {
  if (fs.existsSync(src)) {
    if (!fs.existsSync(path.dirname(dest))) fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log("[copy-assets]", path.basename(src), "->", path.relative(webDir, dest));
  }
}
console.log("[copy-assets] Done.");
