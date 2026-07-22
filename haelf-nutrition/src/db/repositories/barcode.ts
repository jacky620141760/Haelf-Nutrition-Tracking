import type { BarcodeCacheItem, NutritionBasis } from '../../domain/types';
import type { SQLiteDatabase } from 'expo-sqlite';
import { normalizeBarcode } from '../../domain/barcode';
import { assertWritable, getDb } from '../database';

export { normalizeBarcode } from '../../domain/barcode';

type Row = {
  barcode: string;
  name: string;
  basis: NutritionBasis;
  source_kcal: number;
  source_protein_g: number;
  source_fat_g: number;
  source_carbs_g: number;
  confirmed_at: string;
  last_hit_at: string;
};

function map(row: Row): BarcodeCacheItem {
  return {
    barcode: row.barcode,
    name: row.name,
    basis: row.basis,
    sourceKcal: row.source_kcal,
    sourceProteinG: row.source_protein_g,
    sourceFatG: row.source_fat_g,
    sourceCarbsG: row.source_carbs_g,
    confirmedAt: row.confirmed_at,
    lastHitAt: row.last_hit_at,
  };
}

export async function getBarcodeCache(barcode: string): Promise<BarcodeCacheItem | null> {
  const key = normalizeBarcode(barcode);
  const row = await getDb().getFirstAsync<Row>(
    `SELECT * FROM barcode_cache WHERE barcode = ?`,
    [key]
  );
  if (!row) return null;
  try {
    assertWritable();
    const now = new Date().toISOString();
    await getDb().runAsync(`UPDATE barcode_cache SET last_hit_at = ? WHERE barcode = ?`, [
      now,
      key,
    ]);
    return { ...map(row), lastHitAt: now };
  } catch {
    return map(row);
  }
}

export async function upsertBarcodeCache(
  item: {
    barcode: string;
    name: string;
    basis: NutritionBasis;
    sourceKcal: number;
    sourceProteinG: number;
    sourceFatG: number;
    sourceCarbsG: number;
  },
  db: SQLiteDatabase = getDb()
): Promise<void> {
  assertWritable();
  const key = normalizeBarcode(item.barcode);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO barcode_cache (barcode, name, basis, source_kcal, source_protein_g, source_fat_g, source_carbs_g, confirmed_at, last_hit_at)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(barcode) DO UPDATE SET
       name=excluded.name, basis=excluded.basis, source_kcal=excluded.source_kcal,
       source_protein_g=excluded.source_protein_g, source_fat_g=excluded.source_fat_g,
       source_carbs_g=excluded.source_carbs_g, confirmed_at=excluded.confirmed_at, last_hit_at=excluded.last_hit_at`,
    [
      key,
      item.name,
      item.basis,
      item.sourceKcal,
      item.sourceProteinG,
      item.sourceFatG,
      item.sourceCarbsG,
      now,
      now,
    ]
  );
}

export async function clearBarcodeCache(): Promise<void> {
  assertWritable();
  await getDb().runAsync(`DELETE FROM barcode_cache`);
}

/** Purge entries unused > 180 days; trim to 2000 by oldest last_hit_at. */
export async function maintainBarcodeCache(): Promise<void> {
  assertWritable();
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);
  const cutoffIso = cutoff.toISOString();
  await db.runAsync(`DELETE FROM barcode_cache WHERE last_hit_at < ? AND confirmed_at < ?`, [
    cutoffIso,
    cutoffIso,
  ]);
  const countRow = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) as c FROM barcode_cache`);
  const count = countRow?.c ?? 0;
  if (count > 2000) {
    const excess = count - 2000;
    await db.runAsync(
      `DELETE FROM barcode_cache WHERE barcode IN (
         SELECT barcode FROM barcode_cache ORDER BY last_hit_at ASC LIMIT ?
       )`,
      [excess]
    );
  }
}
