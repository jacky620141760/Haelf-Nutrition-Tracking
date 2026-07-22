import type { NutritionBasis, Recipe, RecipeIngredient } from '../../domain/types';
import { assertWritable, getDb, runInTransaction } from '../database';

type RecipeRow = {
  id: number;
  name: string;
  total_servings: number;
  photo_uri: string | null;
  created_at: string;
  updated_at: string;
};

type IngredientRow = {
  id: number;
  recipe_id: number;
  sort_order: number;
  name: string;
  basis: NutritionBasis;
  source_kcal: number;
  source_protein_g: number;
  source_fat_g: number;
  source_carbs_g: number;
  quantity: number;
  catalog_id: number | null;
};

export type RecipeIngredientInput = Omit<RecipeIngredient, 'id' | 'recipeId'>;

function mapIngredient(row: IngredientRow): RecipeIngredient {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    sortOrder: row.sort_order,
    name: row.name,
    basis: row.basis,
    sourceKcal: row.source_kcal,
    sourceProteinG: row.source_protein_g,
    sourceFatG: row.source_fat_g,
    sourceCarbsG: row.source_carbs_g,
    quantity: row.quantity,
    catalogId: row.catalog_id,
  };
}

async function hydrate(row: RecipeRow): Promise<Recipe> {
  const ingredients = await getDb().getAllAsync<IngredientRow>(
    `SELECT * FROM recipe_ingredients WHERE recipe_id=? ORDER BY sort_order, id`,
    [row.id]
  );
  return {
    id: row.id,
    name: row.name,
    totalServings: row.total_servings,
    photoUri: row.photo_uri,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ingredients: ingredients.map(mapIngredient),
  };
}

export async function listRecipes(): Promise<Recipe[]> {
  const rows = await getDb().getAllAsync<RecipeRow>(
    `SELECT * FROM recipes ORDER BY updated_at DESC, name COLLATE NOCASE`
  );
  return Promise.all(rows.map(hydrate));
}

export async function getRecipe(id: number): Promise<Recipe | null> {
  const row = await getDb().getFirstAsync<RecipeRow>(
    `SELECT * FROM recipes WHERE id=?`,
    [id]
  );
  return row ? hydrate(row) : null;
}

export async function saveRecipe(
  input: {
    name: string;
    totalServings: number;
    photoUri?: string | null;
    ingredients: RecipeIngredientInput[];
  },
  id?: number
): Promise<number> {
  if (!input.name.trim()) throw new Error('食譜名稱不可空白');
  if (!Number.isFinite(input.totalServings) || input.totalServings <= 0) {
    throw new Error('食譜總份數必須大於 0');
  }
  if (!input.ingredients.length) throw new Error('食譜至少需要一項食材');
  if (
    input.ingredients.some(
      (ingredient) =>
        !Number.isFinite(ingredient.quantity) ||
        ingredient.quantity <= 0 ||
        [
          ingredient.sourceKcal,
          ingredient.sourceProteinG,
          ingredient.sourceFatG,
          ingredient.sourceCarbsG,
        ].some((value) => !Number.isFinite(value) || value < 0)
    )
  ) {
    throw new Error('食譜食材的營養或份量無效');
  }
  assertWritable();
  return runInTransaction(async (txn) => {
    const db = txn;
    const now = new Date().toISOString();
    let recipeId = id;
    if (recipeId) {
      await db.runAsync(
        `UPDATE recipes SET name=?, total_servings=?, photo_uri=?, updated_at=? WHERE id=?`,
        [input.name.trim(), input.totalServings, input.photoUri ?? null, now, recipeId]
      );
      await db.runAsync(`DELETE FROM recipe_ingredients WHERE recipe_id=?`, [recipeId]);
    } else {
      const result = await db.runAsync(
        `INSERT INTO recipes (name, total_servings, photo_uri, created_at, updated_at)
         VALUES (?,?,?,?,?)`,
        [input.name.trim(), input.totalServings, input.photoUri ?? null, now, now]
      );
      recipeId = result.lastInsertRowId;
    }
    for (const [index, ingredient] of input.ingredients.entries()) {
      await db.runAsync(
        `INSERT INTO recipe_ingredients
          (recipe_id, sort_order, name, basis, source_kcal, source_protein_g,
           source_fat_g, source_carbs_g, quantity, catalog_id)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          recipeId,
          ingredient.sortOrder ?? index,
          ingredient.name,
          ingredient.basis,
          ingredient.sourceKcal,
          ingredient.sourceProteinG,
          ingredient.sourceFatG,
          ingredient.sourceCarbsG,
          ingredient.quantity,
          ingredient.catalogId,
        ]
      );
    }
    return recipeId;
  });
}

export async function deleteRecipe(id: number): Promise<void> {
  assertWritable();
  await getDb().runAsync(`DELETE FROM recipes WHERE id=?`, [id]);
}
