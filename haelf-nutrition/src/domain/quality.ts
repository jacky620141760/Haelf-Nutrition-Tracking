import { macroEstimatedKcal } from './nutrition';
import type { FoodDraft, NutritionBasis } from './types';

export function collectDataQualityWarnings(draft: {
  basis: NutritionBasis;
  sourceKcal: number | null;
  sourceProteinG: number | null;
  sourceFatG: number | null;
  sourceCarbsG: number | null;
  unitMappingFailed?: boolean;
}): string[] {
  const warnings: string[] = [];
  if (draft.unitMappingFailed) {
    warnings.push('營養單位無法明確映射至 kcal 與 g，受影響欄位視為未知');
  }
  const { basis, sourceProteinG: p, sourceFatG: f, sourceCarbsG: c, sourceKcal: kcal } = draft;
  if (
    basis === 'PER_100_G' &&
    ((p != null && p > 100) || (f != null && f > 100) || (c != null && c > 100))
  ) {
    warnings.push('每 100 g 的蛋白質、脂肪或碳水化合物超過 100 g，數值可疑');
  }
  if (kcal != null && p != null && f != null && c != null) {
    const estimated = macroEstimatedKcal(p, f, c);
    const diff = Math.abs(estimated - kcal);
    if (diff > 50 && diff > kcal * 0.2) {
      warnings.push('巨量營養素換算熱量與標示 kcal 差異過大');
    }
  }
  return warnings;
}

export function draftHasUnknownRequired(draft: FoodDraft): boolean {
  return (
    !draft.name.trim() ||
    draft.sourceKcal == null ||
    draft.sourceProteinG == null ||
    draft.sourceFatG == null ||
    draft.sourceCarbsG == null ||
    draft.quantity == null
  );
}
