import type { Part } from "@/types/part";

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

export function searchParts(parts: Part[], query: string, limit = 50): Part[] {
  const q = normalize(query);
  if (!q) return [];

  const results = parts.filter((part) => {
    const num = normalize(part.partNumber);
    const name = normalize(part.nameEn);
    const brand = normalize(part.brand);

    return (
      num === q ||
      num.startsWith(q) ||
      num.includes(q) ||
      name.includes(q) ||
      brand.includes(q)
    );
  });

  return results.slice(0, limit);
}
