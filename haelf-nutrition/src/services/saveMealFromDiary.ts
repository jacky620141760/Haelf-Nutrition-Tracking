import type { FoodEntry } from '../domain/types';
import { saveSavedMeal } from '../db/repositories/savedMeals';

export async function saveMealFromDiary(
  name: string,
  entries: FoodEntry[]
): Promise<number> {
  if (!name.trim()) throw new Error('請輸入餐點名稱');
  if (!entries.length) throw new Error('餐點至少需要一項食物');
  return saveSavedMeal({
    name: name.trim(),
    items: entries.map((entry, index) => ({
      sortOrder: index,
      name: entry.name,
      basis: entry.basis,
      sourceKcal: entry.sourceKcal,
      sourceProteinG: entry.sourceProteinG,
      sourceFatG: entry.sourceFatG,
      sourceCarbsG: entry.sourceCarbsG,
      defaultQuantity: entry.quantity,
      catalogId: entry.catalogId,
    })),
  });
}
