import type { AiSuggestion, NutritionBasis } from '../../domain/types';
import { validateFoodDraft } from '../../domain/validation';

export type ParseResult =
  | { ok: true; suggestion: AiSuggestion }
  | { ok: false; error: string; code?: 'not_food' };

/** Pull a JSON object out of model output (fences, prose, trailing text). */
export function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    const inner = fence[1].trim();
    if (inner.startsWith('{') && inner.endsWith('}')) return inner;
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return null;
}

function isBasis(v: unknown): v is NutritionBasis {
  if (v === 'PER_100_G' || v === 'PER_SERVING') return true;
  if (typeof v !== 'string') return false;
  const n = v.trim().toUpperCase().replace(/-/g, '_');
  return n === 'PER_100_G' || n === 'PER_SERVING';
}

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeBasis(v: unknown): NutritionBasis | null {
  if (!isBasis(v)) return null;
  if (v === 'PER_100_G' || v === 'PER_SERVING') return v;
  const n = String(v).trim().toUpperCase().replace(/-/g, '_');
  return n === 'PER_100_G' ? 'PER_100_G' : 'PER_SERVING';
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record && record[key] != null) return record[key];
  }
  return undefined;
}

export function parseAiResponse(raw: string): ParseResult {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    return { ok: false, error: 'AI 回應格式無效：找不到 JSON 物件' };
  }
  let obj: unknown;
  try {
    obj = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'AI 回應格式無效：JSON 解析失敗' };
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'AI 回應格式無效：需為單一物件' };
  }
  const record = obj as Record<string, unknown>;

  const isFoodRaw = pick(record, ['is_food', 'isFood', 'food']);
  if (isFoodRaw === false || isFoodRaw === 0 || isFoodRaw === 'false' || isFoodRaw === 'no') {
    const reasonRaw = pick(record, ['reason', 'error', 'message', 'detail']);
    const reason =
      typeof reasonRaw === 'string' && reasonRaw.trim()
        ? reasonRaw.trim()
        : '圖片或描述不是可分析的食物';
    return { ok: false, code: 'not_food', error: reason };
  }

  const nameRaw = pick(record, ['name', 'food_name', 'foodName', 'dish']);
  const basis = normalizeBasis(pick(record, ['basis', 'nutrition_basis']));
  const quantity = toFiniteNumber(pick(record, ['quantity', 'amount', 'serving']));
  const kcal = toFiniteNumber(pick(record, ['kcal', 'calories', 'energy_kcal']));
  const protein_g = toFiniteNumber(pick(record, ['protein_g', 'protein', 'proteins']));
  const fat_g = toFiniteNumber(pick(record, ['fat_g', 'fat', 'fats']));
  const carbs_g = toFiniteNumber(
    pick(record, ['carbs_g', 'carbohydrates', 'carbs', 'carbohydrate_g'])
  );
  let confidence = toFiniteNumber(pick(record, ['confidence', 'score']));

  if (typeof nameRaw !== 'string' || !nameRaw.trim()) {
    return { ok: false, error: 'AI 回應格式無效：name' };
  }
  if (!basis) {
    return { ok: false, error: 'AI 回應格式無效：basis（需為 PER_100_G 或 PER_SERVING）' };
  }
  if (quantity === null || kcal === null || protein_g === null || fat_g === null || carbs_g === null) {
    return { ok: false, error: 'AI 回應格式無效：缺少有效營養數字' };
  }
  if (confidence === null) confidence = 0.7;
  if (confidence > 1 && confidence <= 100) confidence = confidence / 100;

  const suggestion: AiSuggestion = {
    name: nameRaw.trim(),
    basis,
    quantity,
    kcal,
    protein_g,
    fat_g,
    carbs_g,
    confidence,
  };
  const errors = validateFoodDraft({
    name: suggestion.name,
    basis: suggestion.basis,
    sourceKcal: suggestion.kcal,
    sourceProteinG: suggestion.protein_g,
    sourceFatG: suggestion.fat_g,
    sourceCarbsG: suggestion.carbs_g,
    quantity: suggestion.quantity,
  });
  if (errors.length) {
    return { ok: false, error: `AI 數值不符需求：${errors.map((e) => e.field).join(', ')}` };
  }
  return { ok: true, suggestion };
}

export function serializeAiSuggestion(suggestion: AiSuggestion): string {
  const obj = {
    name: suggestion.name,
    basis: suggestion.basis,
    quantity: suggestion.quantity,
    kcal: suggestion.kcal,
    protein_g: suggestion.protein_g,
    fat_g: suggestion.fat_g,
    carbs_g: suggestion.carbs_g,
    confidence: suggestion.confidence,
  };
  return JSON.stringify(obj);
}
