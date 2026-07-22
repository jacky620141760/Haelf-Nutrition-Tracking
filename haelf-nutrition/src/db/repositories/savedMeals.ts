import type { NutritionBasis, SavedMeal, SavedMealItem } from '../../domain/types';
import { assertWritable, getDb, runInTransaction } from '../database';

type MealRow = {
  id: number;
  name: string;
  photo_uri: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: number;
  saved_meal_id: number;
  sort_order: number;
  name: string;
  basis: NutritionBasis;
  source_kcal: number;
  source_protein_g: number;
  source_fat_g: number;
  source_carbs_g: number;
  default_quantity: number;
  catalog_id: number | null;
};

export type SavedMealItemInput = Omit<SavedMealItem, 'id' | 'savedMealId'>;

function mapItem(row: ItemRow): SavedMealItem {
  return {
    id: row.id,
    savedMealId: row.saved_meal_id,
    sortOrder: row.sort_order,
    name: row.name,
    basis: row.basis,
    sourceKcal: row.source_kcal,
    sourceProteinG: row.source_protein_g,
    sourceFatG: row.source_fat_g,
    sourceCarbsG: row.source_carbs_g,
    defaultQuantity: row.default_quantity,
    catalogId: row.catalog_id,
  };
}

async function hydrate(row: MealRow): Promise<SavedMeal> {
  const items = await getDb().getAllAsync<ItemRow>(
    `SELECT * FROM saved_meal_items WHERE saved_meal_id=? ORDER BY sort_order, id`,
    [row.id]
  );
  return {
    id: row.id,
    name: row.name,
    photoUri: row.photo_uri,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map(mapItem),
  };
}

export async function listSavedMeals(): Promise<SavedMeal[]> {
  const rows = await getDb().getAllAsync<MealRow>(
    `SELECT * FROM saved_meals ORDER BY updated_at DESC, name COLLATE NOCASE`
  );
  return Promise.all(rows.map(hydrate));
}

export async function getSavedMeal(id: number): Promise<SavedMeal | null> {
  const row = await getDb().getFirstAsync<MealRow>(
    `SELECT * FROM saved_meals WHERE id=?`,
    [id]
  );
  return row ? hydrate(row) : null;
}

export async function saveSavedMeal(
  input: { name: string; photoUri?: string | null; items: SavedMealItemInput[] },
  id?: number
): Promise<number> {
  if (!input.name.trim()) throw new Error('餐點名稱不可空白');
  if (!input.items.length) throw new Error('餐點至少需要一項食物');
  if (
    input.items.some(
      (item) =>
        !Number.isFinite(item.defaultQuantity) ||
        item.defaultQuantity <= 0 ||
        [item.sourceKcal, item.sourceProteinG, item.sourceFatG, item.sourceCarbsG].some(
          (value) => !Number.isFinite(value) || value < 0
        )
    )
  ) {
    throw new Error('餐點項目的營養或份量無效');
  }
  assertWritable();
  return runInTransaction(async (txn) => {
    const db = txn;
    const now = new Date().toISOString();
    let mealId = id;
    if (mealId) {
      await db.runAsync(
        `UPDATE saved_meals SET name=?, photo_uri=?, updated_at=? WHERE id=?`,
        [input.name.trim(), input.photoUri ?? null, now, mealId]
      );
      await db.runAsync(`DELETE FROM saved_meal_items WHERE saved_meal_id=?`, [mealId]);
    } else {
      const result = await db.runAsync(
        `INSERT INTO saved_meals (name, photo_uri, created_at, updated_at) VALUES (?,?,?,?)`,
        [input.name.trim(), input.photoUri ?? null, now, now]
      );
      mealId = result.lastInsertRowId;
    }
    for (const [index, item] of input.items.entries()) {
      await db.runAsync(
        `INSERT INTO saved_meal_items
          (saved_meal_id, sort_order, name, basis, source_kcal, source_protein_g,
           source_fat_g, source_carbs_g, default_quantity, catalog_id)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          mealId,
          item.sortOrder ?? index,
          item.name,
          item.basis,
          item.sourceKcal,
          item.sourceProteinG,
          item.sourceFatG,
          item.sourceCarbsG,
          item.defaultQuantity,
          item.catalogId,
        ]
      );
    }
    return mealId;
  });
}

export async function deleteSavedMeal(id: number): Promise<void> {
  assertWritable();
  await getDb().runAsync(`DELETE FROM saved_meals WHERE id=?`, [id]);
}
