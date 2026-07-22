export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type NutritionBasis = 'PER_100_G' | 'PER_SERVING';
export type FoodSource = 'manual' | 'cache' | 'off' | 'ai';
export type AppLocale = 'zh-TW' | 'en';
export type WaterUnit = 'ml' | 'cup' | 'oz';
export type StepSource = 'pedometer' | 'manual';

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
  logGroupId: string | null;
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

export interface WaterEntry {
  id: number;
  ml: number;
  utcTimestamp: string;
  localDate: string;
  tzIana: string;
  tzOffsetMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface WaterGoalVersion {
  id: number;
  effectiveDate: string;
  ml: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseEntry {
  id: number;
  name: string;
  durationMinutes: number;
  burnedKcal: number;
  source: 'manual';
  utcTimestamp: string;
  localDate: string;
  tzIana: string;
  tzOffsetMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyStepTotal {
  localDate: string;
  steps: number;
  source: StepSource;
  syncedAt: string;
  updatedAt: string;
}

export interface SavedMealItem {
  id: number;
  savedMealId: number;
  sortOrder: number;
  name: string;
  basis: NutritionBasis;
  sourceKcal: number;
  sourceProteinG: number;
  sourceFatG: number;
  sourceCarbsG: number;
  defaultQuantity: number;
  catalogId: number | null;
}

export interface SavedMeal {
  id: number;
  name: string;
  photoUri: string | null;
  createdAt: string;
  updatedAt: string;
  items: SavedMealItem[];
}

export interface RecipeIngredient {
  id: number;
  recipeId: number;
  sortOrder: number;
  name: string;
  basis: NutritionBasis;
  sourceKcal: number;
  sourceProteinG: number;
  sourceFatG: number;
  sourceCarbsG: number;
  quantity: number;
  catalogId: number | null;
}

export interface Recipe {
  id: number;
  name: string;
  totalServings: number;
  photoUri: string | null;
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredient[];
}

export interface DailyDiaryStatus {
  localDate: string;
  completedAt: string;
  updatedAt: string;
}

export interface AppPreferences {
  locale: AppLocale;
  waterUnit: WaterUnit;
  weekStart: 0 | 1;
  stepMode: StepSource;
  exerciseCaloriesEnabled: boolean;
  updatedAt: string;
}

export interface DailySummary {
  localDate: string;
  food: Nutrients;
  exerciseKcal: number;
  remainingKcal: number | null;
  waterMl: number;
  waterGoalMl: number | null;
  steps: number | null;
  stepSource: StepSource | null;
  goal: DailyGoalVersion | null;
  completedAt: string | null;
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
