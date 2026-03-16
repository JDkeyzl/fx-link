import type { Part } from "@/types/part";

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

export function searchParts(parts: Part[], query: string, limit = 50): Part[] {
  const q = normalize(query);
  if (!q) return [];

  const results = parts.filter((part) => {
    const num = normalize(part.partNumber);
    const brand = normalize(part.brand);
    const nameEn = part.nameEn ? normalize(part.nameEn) : "";
    const nameZh = part.name ? normalize(part.name) : "";
    const nameFr = part.nameFr ? normalize(part.nameFr) : "";
    const nameAr = part.nameAr ? normalize(part.nameAr) : "";

    const matchesNumber =
      num === q || num.startsWith(q) || num.includes(q);
    const matchesName =
      nameEn.includes(q) ||
      nameZh.includes(q) ||
      nameFr.includes(q) ||
      nameAr.includes(q);
    const matchesBrand = brand.includes(q);

    return matchesNumber || matchesName || matchesBrand;
  });

  return results.slice(0, limit);
}
