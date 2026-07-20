import type { DailyGoalVersion } from '../../domain/types';
import { assertWritable, getDb } from '../database';

type Row = {
  id: number;
  effective_date: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  created_at: string;
  updated_at: string;
};

function map(row: Row): DailyGoalVersion {
  return {
    id: row.id,
    effectiveDate: row.effective_date,
    kcal: row.kcal,
    proteinG: row.protein_g,
    fatG: row.fat_g,
    carbsG: row.carbs_g,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listGoalVersions(): Promise<DailyGoalVersion[]> {
  const rows = await getDb().getAllAsync<Row>(
    `SELECT * FROM daily_goal_versions ORDER BY effective_date DESC`
  );
  return rows.map(map);
}

export async function upsertGoalForDate(input: {
  effectiveDate: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}): Promise<void> {
  assertWritable();
  const now = new Date().toISOString();
  const db = getDb();
  const existing = await db.getFirstAsync<Row>(
    `SELECT * FROM daily_goal_versions WHERE effective_date = ?`,
    [input.effectiveDate]
  );
  if (existing) {
    await db.runAsync(
      `UPDATE daily_goal_versions SET kcal=?, protein_g=?, fat_g=?, carbs_g=?, updated_at=? WHERE effective_date=?`,
      [input.kcal, input.proteinG, input.fatG, input.carbsG, now, input.effectiveDate]
    );
  } else {
    await db.runAsync(
      `INSERT INTO daily_goal_versions (effective_date, kcal, protein_g, fat_g, carbs_g, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [input.effectiveDate, input.kcal, input.proteinG, input.fatG, input.carbsG, now, now]
    );
  }
}
