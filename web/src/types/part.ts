export type QualityLevel = "Original" | "OEM" | "Replacement" | "Unknown";

export interface Part {
  id: string;
  partNumber: string;
  nameEn: string;
  brand: string;
  truckSeries?: string;
  priceMinUsd: number;
  priceMaxUsd: number;
  quality: QualityLevel;
  originCountry?: string;
  imageUrl?: string;
}

