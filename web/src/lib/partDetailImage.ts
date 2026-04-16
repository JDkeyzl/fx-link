/**
 * Part detail & Product JSON-LD image resolution.
 * Prefer DB `image_path`; otherwise `/placeholders/{brand}.jpg` under `public/`.
 */

export function normalizeBrandPlaceholderKey(brand: string): string {
  const b = brand.trim().toUpperCase();
  if (
    b.includes("SINOTRUK") ||
    b.includes("HOWO") ||
    b.includes("CNHTC") ||
    b.includes("重汽")
  ) {
    return "sinotruk";
  }
  if (b.includes("SHACMAN") || b.includes("陕汽") || b.includes("SHAANXI")) {
    return "shacman";
  }
  if (b.includes("WEICHAI") || b.includes("潍柴")) {
    return "weichai";
  }
  const slug = brand
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (slug === "sinotruk" || slug === "shacman" || slug === "weichai") {
    return slug;
  }
  return "generic";
}

/** Public path (leading slash) for Next/Image `src` and link hrefs. */
export function partDetailImageSrc(part: {
  image_path?: string | null;
  brand: string;
}): string {
  const raw = part.image_path?.trim();
  if (raw) {
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    return raw.startsWith("/") ? raw : `/${raw}`;
  }
  return `/placeholders/${normalizeBrandPlaceholderKey(part.brand)}.jpg`;
}

/**
 * Use a plain <img> for these sources. next/image hits /_next/image, which
 * server-fetches the URL and often breaks for uploads behind nginx static.
 */
export function partDetailImageBypassNextOptimizer(src: string): boolean {
  if (src.startsWith("http://") || src.startsWith("https://")) return true;
  const path = src.startsWith("/") ? src : `/${src}`;
  return path.startsWith("/images/parts/");
}

/** Absolute URL for JSON-LD, Open Graph, and Twitter cards. */
export function partDetailImageAbsoluteUrl(
  part: { image_path?: string | null; brand: string },
  siteOrigin: string
): string {
  const path = partDetailImageSrc(part);
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin = siteOrigin.replace(/\/$/, "");
  return `${origin}${path}`;
}
