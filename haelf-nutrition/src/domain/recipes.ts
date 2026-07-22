import type { Nutrients, RecipeIngredient } from './types';
import { computeSnapshot, sumNutrients } from './nutrition';

export function recipeTotals(ingredients: RecipeIngredient[]): Nutrients {
  return sumNutrients(
    ingredients.map((ingredient) =>
      computeSnapshot(
        ingredient.basis,
        {
          kcal: ingredient.sourceKcal,
          protein_g: ingredient.sourceProteinG,
          fat_g: ingredient.sourceFatG,
          carbs_g: ingredient.sourceCarbsG,
        },
        ingredient.quantity
      )
    )
  );
}

export function recipePerServing(
  ingredients: RecipeIngredient[],
  totalServings: number
): Nutrients | null {
  if (!Number.isFinite(totalServings) || totalServings <= 0) return null;
  const total = recipeTotals(ingredients);
  return {
    kcal: total.kcal / totalServings,
    protein_g: total.protein_g / totalServings,
    fat_g: total.fat_g / totalServings,
    carbs_g: total.carbs_g / totalServings,
  };
}
