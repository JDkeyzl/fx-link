import path from "node:path";
import fs from "node:fs/promises";
import type { Part } from "@/types/part";

export interface RawPartItem {
  part_no: string;
  name: string;
  unit: string;
  price: number;
  en_name?: string;
  fr_name?: string;
  alb_name?: string;
}

export type FinalDataJson = Record<string, RawPartItem[]>;

let cachedParts: Part[] | null = null;

function flattenToParts(data: FinalDataJson): Part[] {
  const parts: Part[] = [];
  for (const [key, items] of Object.entries(data)) {
    if (!Array.isArray(items)) continue;
    items.forEach((item, index) => {
      parts.push({
        id: `${item.part_no}-${index}`,
        partNumber: item.part_no,
        name: item.name || undefined,
        nameEn: item.en_name || item.name || key,
        nameFr: item.fr_name,
        nameAr: item.alb_name,
        brand: "—",
        truckSeries: undefined,
        priceMinUsd: Number(item.price) ?? 0,
        priceMaxUsd: Number(item.price) ?? 0,
        quality: "Unknown",
        originCountry: undefined,
        imageUrl: undefined,
      });
    });
  }
  return parts;
}

export async function loadPartsFromDataFile(): Promise<Part[]> {
  if (cachedParts) return cachedParts;

  const i18nPath = path.join(process.cwd(), "data", "final_data_i18n.json");
  const defaultPath = path.join(process.cwd(), "data", "final_data.json");
  const filePath = await fs.access(i18nPath).then(() => i18nPath).catch(() => defaultPath);
  const raw = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as FinalDataJson;
  cachedParts = flattenToParts(data);
  return cachedParts;
}
