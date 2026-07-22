import type { MealType } from '../domain/types';
import { getTimeZoneMetadata, isValidLocalDate, utcNowIso } from '../domain/dates';
import { createLogGroupId } from '../domain/logGroup';
import { runInTransaction } from '../db/database';

export async function copyMealEntries(
  entryIds: number[],
  options: { targetDate: string; targetMeal: MealType }
): Promise<{ ids: number[]; logGroupId: string }> {
  if (!isValidLocalDate(options.targetDate)) {
    throw new Error('目標日期格式無效');
  }
  if (!entryIds.length) return { ids: [], logGroupId: createLogGroupId() };
  const logGroupId = createLogGroupId();
  const now = new Date();
  const timestamp = utcNowIso(now);
  const tz = getTimeZoneMetadata(now);
  const ids = await runInTransaction(async (txn) => {
    const db = txn;
    const created: number[] = [];
    for (const entryId of entryIds) {
      const source = await db.getFirstAsync<Record<string, string | number | null>>(
        `SELECT * FROM food_entries WHERE id=?`,
        [entryId]
      );
      if (!source) throw new Error(`找不到飲食紀錄 ${entryId}`);
      const result = await db.runAsync(
        `INSERT INTO food_entries (
          name, meal_type, basis, source_kcal, source_protein_g, source_fat_g, source_carbs_g,
          quantity, snap_kcal, snap_protein_g, snap_fat_g, snap_carbs_g, source, catalog_id,
          barcode, log_group_id, utc_timestamp, local_date, tz_iana, tz_offset_minutes,
          created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          source.name,
          options.targetMeal,
          source.basis,
          source.source_kcal,
          source.source_protein_g,
          source.source_fat_g,
          source.source_carbs_g,
          source.quantity,
          source.snap_kcal,
          source.snap_protein_g,
          source.snap_fat_g,
          source.snap_carbs_g,
          source.source,
          source.catalog_id,
          source.barcode,
          logGroupId,
          timestamp,
          options.targetDate,
          tz.iana,
          tz.utcOffsetMinutes,
          timestamp,
          timestamp,
        ]
      );
      created.push(result.lastInsertRowId);
    }
    return created;
  });
  return { ids, logGroupId };
}
