import type { NutritionBasis } from './types';

export type FieldError = { field: string; message: string };

const MSG = {
  empty: '不可為空白',
  invalid: '請輸入有效數字',
  negative: '不可為負數',
  range: '超出允許範圍',
};

export function parseFiniteNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function validateNonNegativeInRange(
  value: number | null,
  min: number,
  max: number,
  field: string,
  allowZero = true
): FieldError | null {
  if (value === null) return { field, message: MSG.empty };
  if (!Number.isFinite(value)) return { field, message: MSG.invalid };
  if (value < 0) return { field, message: MSG.negative };
  if (!allowZero && value <= 0) return { field, message: MSG.range };
  if (value < min || value > max) return { field, message: MSG.range };
  return null;
}

export function validateSourceNutrient(value: number | null, field: string): FieldError | null {
  return validateNonNegativeInRange(value, 0, field === 'kcal' ? 100000 : 10000, field, true);
}

export function validateQuantity(
  value: number | null,
  basis: NutritionBasis
): FieldError | null {
  if (basis === 'PER_100_G') {
    return validateNonNegativeInRange(value, Number.MIN_VALUE, 10000, 'quantity', false);
  }
  return validateNonNegativeInRange(value, Number.MIN_VALUE, 100, 'quantity', false);
}

export function validateWeightKg(value: number | null): FieldError | null {
  return validateNonNegativeInRange(value, Number.MIN_VALUE, 1000, 'kg', false);
}

export function validateGoalNutrients(values: {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
}): FieldError[] {
  const errors: FieldError[] = [];
  const e1 = validateSourceNutrient(values.kcal, 'kcal');
  const e2 = validateSourceNutrient(values.protein_g, 'protein_g');
  const e3 = validateSourceNutrient(values.fat_g, 'fat_g');
  const e4 = validateSourceNutrient(values.carbs_g, 'carbs_g');
  if (e1) errors.push(e1);
  if (e2) errors.push(e2);
  if (e3) errors.push(e3);
  if (e4) errors.push(e4);
  return errors;
}

export function validateFoodName(name: string): FieldError | null {
  if (!name.trim()) return { field: 'name', message: '請輸入食物名稱' };
  return null;
}

export function validateFoodDraft(input: {
  name: string;
  basis: NutritionBasis;
  sourceKcal: number | null;
  sourceProteinG: number | null;
  sourceFatG: number | null;
  sourceCarbsG: number | null;
  quantity: number | null;
}): FieldError[] {
  const errors: FieldError[] = [];
  const nameErr = validateFoodName(input.name);
  if (nameErr) errors.push(nameErr);
  const fields: [number | null, string][] = [
    [input.sourceKcal, 'kcal'],
    [input.sourceProteinG, 'protein_g'],
    [input.sourceFatG, 'fat_g'],
    [input.sourceCarbsG, 'carbs_g'],
  ];
  for (const [v, f] of fields) {
    const e = validateSourceNutrient(v, f);
    if (e) errors.push(e);
  }
  const q = validateQuantity(input.quantity, input.basis);
  if (q) errors.push(q);
  return errors;
}

/** Persist with at least 0.01 decimal precision (store as-is if finer). */
export function roundPersist(value: number): number {
  return Math.round(value * 100) / 100 === value
    ? value
    : Math.round(value * 10000) / 10000;
}
