import type { FoodCatalogItem, FoodEntry, MealType, NutritionBasis, FoodSource } from '../../domain/types';
import type { SQLiteDatabase } from 'expo-sqlite';
import { computeSnapshot } from '../../domain/nutrition';
import { assertWritable, getDb, runInTransaction } from '../database';

type FoodRow = {
  id: number;
  name: string;
  meal_type: MealType;
  basis: NutritionBasis;
  source_kcal: number;
  source_protein_g: number;
  source_fat_g: number;
  source_carbs_g: number;
  quantity: number;
  snap_kcal: number;
  snap_protein_g: number;
  snap_fat_g: number;
  snap_carbs_g: number;
  source: FoodSource;
  catalog_id: number | null;
  barcode: string | null;
  log_group_id: string | null;
  utc_timestamp: string;
  local_date: string;
  tz_iana: string;
  tz_offset_minutes: number;
  created_at: string;
  updated_at: string;
};

function mapFood(row: FoodRow): FoodEntry {
  return {
    id: row.id,
    name: row.name,
    mealType: row.meal_type,
    basis: row.basis,
    sourceKcal: row.source_kcal,
    sourceProteinG: row.source_protein_g,
    sourceFatG: row.source_fat_g,
    sourceCarbsG: row.source_carbs_g,
    quantity: row.quantity,
    snapKcal: row.snap_kcal,
    snapProteinG: row.snap_protein_g,
    snapFatG: row.snap_fat_g,
    snapCarbsG: row.snap_carbs_g,
    source: row.source,
    catalogId: row.catalog_id,
    barcode: row.barcode,
    logGroupId: row.log_group_id,
    utcTimestamp: row.utc_timestamp,
    localDate: row.local_date,
    tzIana: row.tz_iana,
    tzOffsetMinutes: row.tz_offset_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listFoodEntriesByDate(localDate: string): Promise<FoodEntry[]> {
  const db = getDb();
  const rows = await db.getAllAsync<FoodRow>(
    `SELECT * FROM food_entries WHERE local_date = ? ORDER BY utc_timestamp ASC, id ASC`,
    [localDate]
  );
  return rows.map(mapFood);
}

export async function listFoodEntriesInDateRange(
  startDate: string,
  endDate: string
): Promise<FoodEntry[]> {
  const db = getDb();
  const rows = await db.getAllAsync<FoodRow>(
    `SELECT * FROM food_entries WHERE local_date >= ? AND local_date <= ? ORDER BY local_date, utc_timestamp`,
    [startDate, endDate]
  );
  return rows.map(mapFood);
}

export async function getFoodEntry(id: number): Promise<FoodEntry | null> {
  const db = getDb();
  const row = await db.getFirstAsync<FoodRow>(`SELECT * FROM food_entries WHERE id = ?`, [id]);
  return row ? mapFood(row) : null;
}

export type CreateFoodInput = {
  name: string;
  mealType: MealType;
  basis: NutritionBasis;
  sourceKcal: number;
  sourceProteinG: number;
  sourceFatG: number;
  sourceCarbsG: number;
  quantity: number;
  source: FoodSource;
  catalogId?: number | null;
  barcode?: string | null;
  logGroupId?: string | null;
  utcTimestamp: string;
  localDate: string;
  tzIana: string;
  tzOffsetMinutes: number;
};

export async function createFoodEntry(
  input: CreateFoodInput,
  db: SQLiteDatabase = getDb()
): Promise<number> {
  assertWritable();
  const snap = computeSnapshot(input.basis, {
    kcal: input.sourceKcal,
    protein_g: input.sourceProteinG,
    fat_g: input.sourceFatG,
    carbs_g: input.sourceCarbsG,
  }, input.quantity);
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO food_entries (
      name, meal_type, basis, source_kcal, source_protein_g, source_fat_g, source_carbs_g,
      quantity, snap_kcal, snap_protein_g, snap_fat_g, snap_carbs_g, source, catalog_id, barcode, log_group_id,
      utc_timestamp, local_date, tz_iana, tz_offset_minutes, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.name,
      input.mealType,
      input.basis,
      input.sourceKcal,
      input.sourceProteinG,
      input.sourceFatG,
      input.sourceCarbsG,
      input.quantity,
      snap.kcal,
      snap.protein_g,
      snap.fat_g,
      snap.carbs_g,
      input.source,
      input.catalogId ?? null,
      input.barcode ?? null,
      input.logGroupId ?? null,
      input.utcTimestamp,
      input.localDate,
      input.tzIana,
      input.tzOffsetMinutes,
      now,
      now,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateFoodEntry(
  id: number,
  input: CreateFoodInput,
  db: SQLiteDatabase = getDb()
): Promise<void> {
  assertWritable();
  const snap = computeSnapshot(input.basis, {
    kcal: input.sourceKcal,
    protein_g: input.sourceProteinG,
    fat_g: input.sourceFatG,
    carbs_g: input.sourceCarbsG,
  }, input.quantity);
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE food_entries SET
      name=?, meal_type=?, basis=?, source_kcal=?, source_protein_g=?, source_fat_g=?, source_carbs_g=?,
      quantity=?, snap_kcal=?, snap_protein_g=?, snap_fat_g=?, snap_carbs_g=?, source=?, catalog_id=?, barcode=?, log_group_id=?,
      utc_timestamp=?, local_date=?, tz_iana=?, tz_offset_minutes=?, updated_at=?
     WHERE id=?`,
    [
      input.name,
      input.mealType,
      input.basis,
      input.sourceKcal,
      input.sourceProteinG,
      input.sourceFatG,
      input.sourceCarbsG,
      input.quantity,
      snap.kcal,
      snap.protein_g,
      snap.fat_g,
      snap.carbs_g,
      input.source,
      input.catalogId ?? null,
      input.barcode ?? null,
      input.logGroupId ?? null,
      input.utcTimestamp,
      input.localDate,
      input.tzIana,
      input.tzOffsetMinutes,
      now,
      id,
    ]
  );
}

export async function deleteFoodEntry(id: number): Promise<void> {
  assertWritable();
  await getDb().runAsync(`DELETE FROM food_entries WHERE id = ?`, [id]);
}

export async function deleteFoodEntries(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await runInTransaction(async (txn) => {
    for (const id of ids) {
      await txn.runAsync(`DELETE FROM food_entries WHERE id=?`, [id]);
    }
  });
}

type CatalogRow = {
  id: number;
  name: string;
  basis: NutritionBasis;
  source_kcal: number;
  source_protein_g: number;
  source_fat_g: number;
  source_carbs_g: number;
  is_favorite: number;
  last_used_at: string | null;
  barcode: string | null;
  created_at: string;
  updated_at: string;
};

function mapCatalog(row: CatalogRow): FoodCatalogItem {
  return {
    id: row.id,
    name: row.name,
    basis: row.basis,
    sourceKcal: row.source_kcal,
    sourceProteinG: row.source_protein_g,
    sourceFatG: row.source_fat_g,
    sourceCarbsG: row.source_carbs_g,
    isFavorite: !!row.is_favorite,
    lastUsedAt: row.last_used_at,
    barcode: row.barcode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertCatalogFromConfirmed(
  input: {
    name: string;
    basis: NutritionBasis;
    sourceKcal: number;
    sourceProteinG: number;
    sourceFatG: number;
    sourceCarbsG: number;
    barcode?: string | null;
    existingId?: number | null;
  },
  db: SQLiteDatabase = getDb()
): Promise<number> {
  assertWritable();
  const now = new Date().toISOString();
  if (input.existingId) {
    await db.runAsync(
      `UPDATE food_catalog SET name=?, basis=?, source_kcal=?, source_protein_g=?, source_fat_g=?, source_carbs_g=?,
       last_used_at=?, barcode=COALESCE(?, barcode), updated_at=? WHERE id=?`,
      [
        input.name,
        input.basis,
        input.sourceKcal,
        input.sourceProteinG,
        input.sourceFatG,
        input.sourceCarbsG,
        now,
        input.barcode ?? null,
        now,
        input.existingId,
      ]
    );
    return input.existingId;
  }
  const result = await db.runAsync(
    `INSERT INTO food_catalog (name, basis, source_kcal, source_protein_g, source_fat_g, source_carbs_g, is_favorite, last_used_at, barcode, created_at, updated_at)
     VALUES (?,?,?,?,?,?,0,?,?,?,?)`,
    [
      input.name,
      input.basis,
      input.sourceKcal,
      input.sourceProteinG,
      input.sourceFatG,
      input.sourceCarbsG,
      now,
      input.barcode ?? null,
      now,
      now,
    ]
  );
  return result.lastInsertRowId;
}

export async function touchCatalogUsed(
  id: number,
  db: SQLiteDatabase = getDb()
): Promise<void> {
  assertWritable();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE food_catalog SET last_used_at=?, updated_at=? WHERE id=?`,
    [now, now, id]
  );
}

export async function setCatalogFavorite(id: number, isFavorite: boolean): Promise<void> {
  assertWritable();
  const now = new Date().toISOString();
  await getDb().runAsync(
    `UPDATE food_catalog SET is_favorite=?, updated_at=? WHERE id=?`,
    [isFavorite ? 1 : 0, now, id]
  );
}

export async function listFavorites(): Promise<FoodCatalogItem[]> {
  const rows = await getDb().getAllAsync<CatalogRow>(
    `SELECT * FROM food_catalog WHERE is_favorite = 1 ORDER BY name COLLATE NOCASE`
  );
  return rows.map(mapCatalog);
}

export async function listRecent(limit = 20): Promise<FoodCatalogItem[]> {
  const rows = await getDb().getAllAsync<CatalogRow>(
    `SELECT * FROM food_catalog WHERE last_used_at IS NOT NULL ORDER BY last_used_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(mapCatalog);
}

export async function listCatalog(search = ''): Promise<FoodCatalogItem[]> {
  const query = search.trim();
  const rows = query
    ? await getDb().getAllAsync<CatalogRow>(
        `SELECT * FROM food_catalog WHERE name LIKE ? ESCAPE '\\'
         ORDER BY is_favorite DESC, last_used_at DESC, name COLLATE NOCASE`,
        [`%${query.replace(/[\\%_]/g, '\\$&')}%`]
      )
    : await getDb().getAllAsync<CatalogRow>(
        `SELECT * FROM food_catalog ORDER BY is_favorite DESC, last_used_at DESC, name COLLATE NOCASE`
      );
  return rows.map(mapCatalog);
}

export async function deleteCatalogItem(id: number): Promise<void> {
  await runInTransaction(async (txn) => {
    const item = await txn.getFirstAsync<CatalogRow>(
      `SELECT * FROM food_catalog WHERE id=?`,
      [id]
    );
    if (item?.barcode) {
      await txn.runAsync(`DELETE FROM barcode_cache WHERE barcode = ?`, [item.barcode]);
    }
    await txn.runAsync(`UPDATE food_entries SET catalog_id = NULL WHERE catalog_id = ?`, [id]);
    await txn.runAsync(`DELETE FROM food_catalog WHERE id = ?`, [id]);
  });
}

export async function getCatalogItem(id: number): Promise<FoodCatalogItem | null> {
  const row = await getDb().getFirstAsync<CatalogRow>(`SELECT * FROM food_catalog WHERE id=?`, [id]);
  return row ? mapCatalog(row) : null;
}
