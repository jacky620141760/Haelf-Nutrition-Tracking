export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type NutritionBasis = 'PER_100_G' | 'PER_SERVING';
export type FoodSource = 'manual' | 'cache' | 'off' | 'ai';

export interface Nutrients {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

export interface TimeZoneMetadata {
  iana: string;
  utcOffsetMinutes: number;
}

export interface FoodEntry {
  id: number;
  name: string;
  mealType: MealType;
  basis: NutritionBasis;
  sourceKcal: number;
  sourceProteinG: number;
  sourceFatG: number;
  sourceCarbsG: number;
  quantity: number;
  snapKcal: number;
  snapProteinG: number;
  snapFatG: number;
  snapCarbsG: number;
  source: FoodSource;
  catalogId: number | null;
  barcode: string | null;
  utcTimestamp: string;
  localDate: string;
  tzIana: string;
  tzOffsetMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface FoodCatalogItem {
  id: number;
  name: string;
  basis: NutritionBasis;
  sourceKcal: number;
  sourceProteinG: number;
  sourceFatG: number;
  sourceCarbsG: number;
  isFavorite: boolean;
  lastUsedAt: string | null;
  barcode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BarcodeCacheItem {
  barcode: string;
  name: string;
  basis: NutritionBasis;
  sourceKcal: number;
  sourceProteinG: number;
  sourceFatG: number;
  sourceCarbsG: number;
  confirmedAt: string;
  lastHitAt: string;
}

export interface DailyGoalVersion {
  id: number;
  effectiveDate: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeightEntry {
  id: number;
  kg: number;
  utcTimestamp: string;
  localDate: string;
  tzIana: string;
  tzOffsetMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface FoodDraft {
  name: string;
  mealType: MealType;
  basis: NutritionBasis;
  sourceKcal: number | null;
  sourceProteinG: number | null;
  sourceFatG: number | null;
  sourceCarbsG: number | null;
  quantity: number | null;
  source: FoodSource;
  barcode?: string | null;
  catalogId?: number | null;
  confidence?: number | null;
  dataQualityWarnings: string[];
  utcTimestamp?: string;
}

export interface AiSuggestion {
  name: string;
  basis: NutritionBasis;
  quantity: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  confidence: number;
}

export interface AiEndpointConfig {
  endpointUrl: string;
  model: string;
  visionSupported: boolean | null;
  consentGiven: boolean;
}

export type DbInitResult =
  | { status: 'ready'; schemaVersion: number }
  | { status: 'migration_failed'; error: string }
  | { status: 'unsupported'; error: string };
