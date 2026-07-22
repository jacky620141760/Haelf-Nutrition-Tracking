import type { FoodDraft, NutritionBasis } from '../domain/types';
import { collectDataQualityWarnings } from '../domain/quality';
import { normalizeBarcode } from '../domain/barcode';

const OFF_USER_AGENT = 'HaelfNutrition/1.0 (expo; https://github.com/)';
const SEARCH_A_URL = 'https://search.openfoodfacts.org/search';

function isWebClient(): boolean {
  return typeof document !== 'undefined' && typeof navigator !== 'undefined';
}

function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey || url.includes('YOUR_PROJECT')) return null;
  return { url, anonKey };
}

export type OffFetchResult =
  | { ok: true; draft: FoodDraft }
  | { ok: false; reason: 'not_found' | 'timeout' | 'network' | 'error' | 'cancelled'; message: string };

export type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  nutriments?: Record<string, number | string | undefined>;
  nutrition_data_per?: string;
  serving_quantity?: string | number;
};

export type OffSearchHit = {
  barcode: string;
  name: string;
  nutritionLabel: string;
  draft: FoodDraft;
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
      headers: { 'User-Agent': OFF_USER_AGENT },
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

function hasCompleteMacros(draft: FoodDraft): boolean {
  return (
    draft.sourceProteinG != null &&
    draft.sourceFatG != null &&
    draft.sourceCarbsG != null
  );
}

function formatOffNutritionLabel(draft: FoodDraft): string {
  const unit = draft.basis === 'PER_100_G' ? '/100g' : '/份';
  const kcal =
    draft.sourceKcal != null ? `${Math.round(draft.sourceKcal)} kcal${unit}` : null;
  const macros = `P ${draft.sourceProteinG}g · F ${draft.sourceFatG}g · C ${draft.sourceCarbsG}g`;
  return kcal ? `${kcal} · ${macros}` : macros;
}

export type OffSearchResult =
  | { ok: true; hits: OffSearchHit[] }
  | {
      ok: false;
      reason: 'timeout' | 'network' | 'cancelled' | 'server_busy' | 'unavailable';
      message: string;
    };

type SearchAResponse = {
  hits?: OffProduct[];
  products?: OffProduct[];
  errors?: { title?: string }[];
};

function parseSearchResponse(data: SearchAResponse): OffProduct[] {
  return data.hits ?? data.products ?? [];
}

async function requestSearchA(
  terms: string,
  signal: AbortSignal
): Promise<{ products: OffProduct[]; status: number }> {
  const params = new URLSearchParams({
    q: terms,
    page_size: SEARCH_PAGE_SIZE,
    page: '1',
    langs: 'zh,en',
    fields: 'code,product_name,product_name_en,nutriments',
  });
  const res = await fetch(`${SEARCH_A_URL}?${params.toString()}`, {
    signal,
    headers: { 'User-Agent': OFF_USER_AGENT },
  });
  if (!res.ok) return { products: [], status: res.status };
  const data = (await res.json()) as SearchAResponse;
  if (data.errors?.length) return { products: [], status: 502 };
  return { products: parseSearchResponse(data), status: res.status };
}

async function requestSearchProxy(
  terms: string,
  signal: AbortSignal
): Promise<{ products: OffProduct[]; status: number }> {
  const config = getSupabasePublicConfig();
  if (!config) return { products: [], status: 0 };
  const params = new URLSearchParams({ q: terms });
  const res = await fetch(`${config.url}/functions/v1/off-search?${params.toString()}`, {
    signal,
    headers: {
      'User-Agent': OFF_USER_AGENT,
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
  });
  if (res.status === 404) return { products: [], status: 0 };
  if (!res.ok) return { products: [], status: res.status };
  const data = (await res.json()) as SearchAResponse;
  if (data.errors?.length) return { products: [], status: 502 };
  return { products: parseSearchResponse(data), status: res.status };
}

async function requestLegacySearch(
  terms: string,
  signal: AbortSignal
): Promise<{ products: OffProduct[]; status: number }> {
  const params = new URLSearchParams({
    search_terms: terms,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: SEARCH_PAGE_SIZE,
    fields: 'code,product_name,product_name_en,nutriments',
  });
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`, {
    signal,
    headers: { 'User-Agent': OFF_USER_AGENT },
  });
  if (!res.ok) return { products: [], status: res.status };
  const data = (await res.json()) as SearchAResponse;
  return { products: parseSearchResponse(data), status: res.status };
}

async function fetchSearchHits(
  terms: string,
  signal: AbortSignal
): Promise<{ products: OffProduct[]; status: number }> {
  const attempts: Array<() => Promise<{ products: OffProduct[]; status: number }>> = [];

  if (isWebClient()) {
    attempts.push(() => requestSearchProxy(terms, signal));
    attempts.push(() => requestSearchA(terms, signal));
  } else {
    attempts.push(() => requestSearchA(terms, signal));
    attempts.push(() => requestSearchProxy(terms, signal));
    attempts.push(() => requestLegacySearch(terms, signal));
  }

  let lastStatus = 0;
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      lastStatus = result.status;
      if (result.status === 200) return result;
      if (result.status > 0 && ![502, 503, 429].includes(result.status)) return result;
    } catch {
      /* try next route */
    }
  }
  return { products: [], status: lastStatus };
}

const SEARCH_PAGE_SIZE = '48';
const MAX_SEARCH_HITS = 24;
const MAX_HYDRATE_LOOKUPS = 8;

async function mapSearchHits(
  products: OffProduct[],
  mealType: FoodDraft['mealType'],
  signal: AbortSignal
): Promise<OffSearchHit[]> {
  const hits: OffSearchHit[] = [];
  let hydrateLookups = 0;

  for (const product of products) {
    if (hits.length >= MAX_SEARCH_HITS) break;
    if (signal.aborted) break;

    const barcode = normalizeBarcode(String(product.code ?? ''));
    if (!barcode) continue;

    let draft = mapOffToDraft(barcode, product, mealType);
    if (!draft.name.trim()) continue;

    if (!hasCompleteMacros(draft) && hydrateLookups < MAX_HYDRATE_LOOKUPS) {
      hydrateLookups++;
      const full = await fetchOpenFoodFacts(barcode, mealType, signal);
      if (full.ok) draft = full.draft;
    }

    if (!hasCompleteMacros(draft)) continue;

    hits.push({
      barcode,
      name: draft.name,
      nutritionLabel: formatOffNutritionLabel(draft),
      draft,
    });
  }
  return hits;
}

export async function searchOpenFoodFacts(
  query: string,
  mealType: FoodDraft['mealType'] = 'snack',
  signal?: AbortSignal
): Promise<OffSearchResult> {
  const terms = query.trim();
  if (terms.length < 2) return { ok: true, hits: [] };

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });

  try {
    let result = await fetchSearchHits(terms, controller.signal);
    if ([502, 503, 429].includes(result.status)) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (!controller.signal.aborted) {
        result = await fetchSearchHits(terms, controller.signal);
      }
    }

    if ([502, 503, 429].includes(result.status)) {
      return {
        ok: false,
        reason: 'server_busy',
        message: `HTTP ${result.status}`,
      };
    }
    if (result.status !== 200 && result.products.length === 0) {
      if (result.status === 0) {
        return {
          ok: false,
          reason: 'unavailable',
          message: 'Failed to fetch',
        };
      }
      return {
        ok: false,
        reason: 'network',
        message: `HTTP ${result.status}`,
      };
    }

    return { ok: true, hits: await mapSearchHits(result.products, mealType, controller.signal) };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return timedOut
        ? { ok: false, reason: 'timeout', message: '查詢逾時' }
        : { ok: false, reason: 'cancelled', message: '已取消' };
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
