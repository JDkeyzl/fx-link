import path from "node:path";
import fs from "node:fs/promises";
import type { Part } from "@/types/part";

export interface RawPartItem {
  part_no: string;
  name: string;
  unit: string;
  price: number;
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
        nameEn: item.name || key,
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

  const filePath = path.join(process.cwd(), "data", "final_data.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as FinalDataJson;
  cachedParts = flattenToParts(data);
  return cachedParts;
}
