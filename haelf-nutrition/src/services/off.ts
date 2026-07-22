import type { FoodDraft, NutritionBasis } from '../domain/types';
import { collectDataQualityWarnings } from '../domain/quality';
import { normalizeBarcode } from '../domain/barcode';

export type OffFetchResult =
  | { ok: true; draft: FoodDraft }
  | { ok: false; reason: 'not_found' | 'timeout' | 'network' | 'error' | 'cancelled'; message: string };

export type OffProduct = {
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

function normalizedUnit(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function readEnergyKcal(
  nutrients: Record<string, number | string | undefined>,
  suffix: '100g' | 'serving'
): { value: number | null; failed: boolean } {
  const kcal = toNum(nutrients[`energy-kcal_${suffix}`]);
  if (kcal !== null) return { value: kcal, failed: false };

  const kj = toNum(nutrients[`energy-kj_${suffix}`]);
  if (kj !== null) return { value: kj / 4.184, failed: false };

  const generic = toNum(nutrients[`energy_${suffix}`]);
  if (generic === null) return { value: null, failed: false };
  const unit = normalizedUnit(
    nutrients[`energy_${suffix}_unit`] ?? nutrients.energy_unit
  );
  if (unit === 'kj' || unit === 'kilojoule' || unit === 'kilojoules') {
    return { value: generic / 4.184, failed: false };
  }
  if (unit === 'kcal' || unit === 'kilocalorie' || unit === 'kilocalories') {
    return { value: generic, failed: false };
  }
  return { value: null, failed: true };
}

function readGrams(
  nutrients: Record<string, number | string | undefined>,
  nutrient: 'proteins' | 'fat' | 'carbohydrates',
  suffix: '100g' | 'serving'
): { value: number | null; failed: boolean } {
  const value = toNum(nutrients[`${nutrient}_${suffix}`]);
  if (value === null) return { value: null, failed: false };
  const unit = normalizedUnit(
    nutrients[`${nutrient}_${suffix}_unit`] ?? nutrients[`${nutrient}_unit`]
  );
  if (unit === 'g' || unit === 'gram' || unit === 'grams') {
    return { value, failed: false };
  }
  return { value: null, failed: true };
}

export function mapOffToDraft(
  barcode: string,
  product: OffProduct,
  mealType: FoodDraft['mealType']
): FoodDraft {
  const nut = product.nutriments ?? {};
  let basis: NutritionBasis = 'PER_100_G';
  const kcal100 = readEnergyKcal(nut, '100g');
  const p100 = readGrams(nut, 'proteins', '100g');
  const f100 = readGrams(nut, 'fat', '100g');
  const c100 = readGrams(nut, 'carbohydrates', '100g');
  const kcalServ = readEnergyKcal(nut, 'serving');
  const pServ = readGrams(nut, 'proteins', 'serving');
  const fServ = readGrams(nut, 'fat', 'serving');
  const cServ = readGrams(nut, 'carbohydrates', 'serving');
  const unitMappingFailed = [
    kcal100,
    p100,
    f100,
    c100,
    kcalServ,
    pServ,
    fServ,
    cServ,
  ].some((result) => result.failed);

  let sourceKcal: number | null = null;
  let sourceProteinG: number | null = null;
  let sourceFatG: number | null = null;
  let sourceCarbsG: number | null = null;
  let quantity: number | null = null;

  if (
    kcal100.value != null ||
    p100.value != null ||
    f100.value != null ||
    c100.value != null
  ) {
    basis = 'PER_100_G';
    sourceKcal = kcal100.value;
    sourceProteinG = p100.value;
    sourceFatG = f100.value;
    sourceCarbsG = c100.value;
    quantity = 100;
  } else if (
    kcalServ.value != null ||
    pServ.value != null ||
    fServ.value != null ||
    cServ.value != null
  ) {
    basis = 'PER_SERVING';
    sourceKcal = kcalServ.value;
    sourceProteinG = pServ.value;
    sourceFatG = fServ.value;
    sourceCarbsG = cServ.value;
    quantity = 1;
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
  mealType: FoodDraft['mealType'] = 'snack',
  signal?: AbortSignal
): Promise<OffFetchResult> {
  const key = normalizeBarcode(barcode);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 10_000);
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
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
      return timedOut
        ? { ok: false, reason: 'timeout', message: '查詢逾時（10 秒）' }
        : { ok: false, reason: 'cancelled', message: '已取消查詢' };
    }
    return {
      ok: false,
      reason: 'network',
      message: e instanceof Error ? e.message : '連線失敗',
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
