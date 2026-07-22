import type { MealType } from '../domain/types';
import { getSavedMeal } from '../db/repositories/savedMeals';
import { confirmFoodDrafts } from './confirmFoodBatch';

export async function applySavedMeal(
  savedMealId: number,
  options: { localDate: string; mealType: MealType }
) {
  const meal = await getSavedMeal(savedMealId);
  if (!meal) return { ok: false as const, errors: ['找不到儲存餐點'] };
  return confirmFoodDrafts(
    meal.items.map((item) => ({
      name: item.name,
      mealType: options.mealType,
      basis: item.basis,
      sourceKcal: item.sourceKcal,
      sourceProteinG: item.sourceProteinG,
      sourceFatG: item.sourceFatG,
      sourceCarbsG: item.sourceCarbsG,
      quantity: item.defaultQuantity,
      source: 'manual' as const,
      catalogId: item.catalogId,
      dataQualityWarnings: [],
    })),
    { ...options, updateCatalog: false }
  );
}
