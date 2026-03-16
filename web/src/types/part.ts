export type QualityLevel = "Original" | "OEM" | "Replacement" | "Unknown";

export interface Part {
  id: string;
  partNumber: string;
  /** Chinese name (from source data) */
  name?: string;
  nameEn: string;
  nameFr?: string;
  nameAr?: string;
  brand: string;
  truckSeries?: string;
  priceMinUsd: number;
  priceMaxUsd: number;
  quality: QualityLevel;
  originCountry?: string;
  imageUrl?: string;
}

