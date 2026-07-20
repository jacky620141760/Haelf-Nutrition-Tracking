import type { AiSuggestion, NutritionBasis } from '../../domain/types';
import { validateFoodDraft } from '../../domain/validation';

export type ParseResult =
  | { ok: true; suggestion: AiSuggestion }
  | { ok: false; error: string };

function stripCodeFence(text: string): string | null {
  const trimmed = text.trim();
  // Reject if markdown fences or extra prose — only accept pure JSON object OR extract if ONLY fence wrapper
  if (trimmed.startsWith('```')) {
    return null;
  }
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }
  return trimmed;
}

function isBasis(v: unknown): v is NutritionBasis {
  return v === 'PER_100_G' || v === 'PER_SERVING';
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function parseAiResponse(raw: string): ParseResult {
  const jsonText = stripCodeFence(raw);
  if (!jsonText) {
    return { ok: false, error: 'AI 回應格式無效：需為單一 JSON 物件且不含額外文字' };
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
  const allowed = new Set([
    'name',
    'basis',
    'quantity',
    'kcal',
    'protein_g',
    'fat_g',
    'carbs_g',
    'confidence',
  ]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return { ok: false, error: `AI 回應格式無效：未知欄位 ${key}` };
    }
  }
  const required = [...allowed];
  for (const key of required) {
    if (!(key in record)) {
      return { ok: false, error: `AI 回應格式無效：缺少欄位 ${key}` };
    }
  }
  if (typeof record.name !== 'string') {
    return { ok: false, error: 'AI 回應格式無效：name' };
  }
  if (!isBasis(record.basis)) {
    return { ok: false, error: 'AI 回應格式無效：basis' };
  }
  for (const k of ['quantity', 'kcal', 'protein_g', 'fat_g', 'carbs_g', 'confidence'] as const) {
    if (!isFiniteNumber(record[k])) {
      return { ok: false, error: `AI 回應格式無效：${k}` };
    }
  }
  const suggestion: AiSuggestion = {
    name: record.name,
    basis: record.basis,
    quantity: record.quantity as number,
    kcal: record.kcal as number,
    protein_g: record.protein_g as number,
    fat_g: record.fat_g as number,
    carbs_g: record.carbs_g as number,
    confidence: record.confidence as number,
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
  if (suggestion.confidence < 0 || suggestion.confidence > 1) {
    // allow 0-100 as well? Spec says finite decimal; keep 0-1 preferred but accept if finite from validate
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
