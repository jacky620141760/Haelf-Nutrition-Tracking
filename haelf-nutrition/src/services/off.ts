import type { FoodDraft, NutritionBasis } from '../domain/types';
import { collectDataQualityWarnings } from '../domain/quality';
import { normalizeBarcode } from '../db/repositories/barcode';

export type OffFetchResult =
  | { ok: true; draft: FoodDraft }
  | { ok: false; reason: 'not_found' | 'timeout' | 'network' | 'error'; message: string };

type OffProduct = {
  product_name?: string;
  product_name_en?: string;
  nutriments?: Record<string, number | string | undefined>;
  nutrition_data_per?: string;
  serving_quantity?: string | number;
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapOffToDraft(
  barcode: string,
  product: OffProduct,
  mealType: FoodDraft['mealType']
): FoodDraft {
  const nut = product.nutriments ?? {};
  let basis: NutritionBasis = 'PER_100_G';
  let unitMappingFailed = false;

  const kcal100 =
    toNum(nut['energy-kcal_100g']) ??
    (toNum(nut['energy_100g']) != null ? (toNum(nut['energy_100g']) as number) / 4.184 : null);
  const p100 = toNum(nut['proteins_100g']);
  const f100 = toNum(nut['fat_100g']);
  const c100 = toNum(nut['carbohydrates_100g']);

  const kcalServ =
    toNum(nut['energy-kcal_serving']) ??
    (toNum(nut['energy_serving']) != null ? (toNum(nut['energy_serving']) as number) / 4.184 : null);
  const pServ = toNum(nut['proteins_serving']);
  const fServ = toNum(nut['fat_serving']);
  const cServ = toNum(nut['carbohydrates_serving']);

  let sourceKcal: number | null = null;
  let sourceProteinG: number | null = null;
  let sourceFatG: number | null = null;
  let sourceCarbsG: number | null = null;
  let quantity: number | null = null;

  if (kcal100 != null || p100 != null || f100 != null || c100 != null) {
    basis = 'PER_100_G';
    sourceKcal = kcal100;
    sourceProteinG = p100;
    sourceFatG = f100;
    sourceCarbsG = c100;
    quantity = 100;
  } else if (kcalServ != null || pServ != null || fServ != null || cServ != null) {
    basis = 'PER_SERVING';
    sourceKcal = kcalServ;
    sourceProteinG = pServ;
    sourceFatG = fServ;
    sourceCarbsG = cServ;
    quantity = 1;
  } else {
    // energy in kJ only without clear mapping
    if (toNum(nut['energy_100g']) != null && toNum(nut['energy-kcal_100g']) == null) {
      unitMappingFailed = true;
    }
  }

  const name =
    product.product_name?.trim() ||
    product.product_name_en?.trim() ||
    '';

  const draft: FoodDraft = {
    name,
    mealType,
    basis,
    sourceKcal,
    sourceProteinG,
    sourceFatG,
    sourceCarbsG,
    quantity,
    source: 'off',
    barcode: normalizeBarcode(barcode),
    dataQualityWarnings: [],
  };
  draft.dataQualityWarnings = collectDataQualityWarnings({
    ...draft,
    unitMappingFailed,
  });
  return draft;
}

export async function fetchOpenFoodFacts(
  barcode: string,
  mealType: FoodDraft['mealType'] = 'snack'
): Promise<OffFetchResult> {
  const key = normalizeBarcode(barcode);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(key)}.json`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'HaelfNutrition/1.0 (personal; expo)' },
    });
    if (!res.ok) {
      return { ok: false, reason: 'network', message: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { status?: number; product?: OffProduct };
    if (data.status !== 1 || !data.product) {
      return { ok: false, reason: 'not_found', message: '找不到產品' };
    }
    return { ok: true, draft: mapOffToDraft(key, data.product, mealType) };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, reason: 'timeout', message: '查詢逾時（10 秒）' };
    }
    return {
      ok: false,
      reason: 'network',
      message: e instanceof Error ? e.message : '連線失敗',
    };
  } finally {
    clearTimeout(timer);
  }
}
