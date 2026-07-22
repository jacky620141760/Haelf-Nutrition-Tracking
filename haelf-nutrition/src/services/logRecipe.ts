import type { MealType } from '../domain/types';
import { getRecipe } from '../db/repositories/recipes';
import { recipePerServing } from '../domain/recipes';
import { confirmFoodDraft } from './confirmFood';

export async function logRecipe(
  recipeId: number,
  options: { localDate: string; mealType: MealType; servings: number }
) {
  const recipe = await getRecipe(recipeId);
  if (!recipe) return { ok: false as const, errors: ['找不到食譜'] };
  const perServing = recipePerServing(recipe.ingredients, recipe.totalServings);
  if (!perServing) return { ok: false as const, errors: ['食譜份數無效'] };
  return confirmFoodDraft(
    {
      name: recipe.name,
      mealType: options.mealType,
      basis: 'PER_SERVING',
      sourceKcal: perServing.kcal,
      sourceProteinG: perServing.protein_g,
      sourceFatG: perServing.fat_g,
      sourceCarbsG: perServing.carbs_g,
      quantity: options.servings,
      source: 'manual',
      dataQualityWarnings: [],
    },
    { localDate: options.localDate, updateCatalog: false }
  );
}
