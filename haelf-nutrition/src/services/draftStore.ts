import type { FoodDraft } from '../domain/types';

let pendingDraft: FoodDraft | null = null;

export function setPendingDraft(draft: FoodDraft | null): void {
  pendingDraft = draft;
}

export function consumePendingDraft(): FoodDraft | null {
  const d = pendingDraft;
  pendingDraft = null;
  return d;
}

export function peekPendingDraft(): FoodDraft | null {
  return pendingDraft;
}

export function emptyDraft(mealType: FoodDraft['mealType'] = 'snack'): FoodDraft {
  return {
    name: '',
    mealType,
    basis: 'PER_100_G',
    sourceKcal: null,
    sourceProteinG: 0,
    sourceFatG: 0,
    sourceCarbsG: 0,
    quantity: null,
    source: 'manual',
    barcode: null,
    catalogId: null,
    dataQualityWarnings: [],
  };
}
