import type { DailyGoalVersion } from '../../domain/types';
import { ONGOING_GOAL_EFFECTIVE_DATE } from '../schema';
import { assertWritable, getDb } from '../database';
import { newCloudId } from './sync';

type Row = {
  id: number;
  effective_date: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  created_at: string;
  updated_at: string;
  cloud_id: string | null;
  deleted_at: string | null;
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
    `SELECT * FROM daily_goal_versions WHERE deleted_at IS NULL ORDER BY effective_date DESC`
  );
  return rows.map(map);
}

export async function hasOngoingGoals(): Promise<boolean> {
  const row = await getDb().getFirstAsync<{ id: number }>(
    `SELECT id FROM daily_goal_versions
     WHERE deleted_at IS NULL AND effective_date <= date('now','localtime')
     LIMIT 1`
  );
  return !!row;
}

/** Upsert the ongoing daily goal (applies every day until changed). */
export async function upsertOngoingGoals(input: {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}): Promise<void> {
  return upsertGoalForDate({
    effectiveDate: ONGOING_GOAL_EFFECTIVE_DATE,
    ...input,
  });
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
      `UPDATE daily_goal_versions SET kcal=?, protein_g=?, fat_g=?, carbs_g=?, updated_at=?, deleted_at=NULL WHERE effective_date=?`,
      [input.kcal, input.proteinG, input.fatG, input.carbsG, now, input.effectiveDate]
    );
  } else {
    await db.runAsync(
      `INSERT INTO daily_goal_versions (effective_date, kcal, protein_g, fat_g, carbs_g, created_at, updated_at, cloud_id, deleted_at)
       VALUES (?,?,?,?,?,?,?,?,NULL)`,
      [
        input.effectiveDate,
        input.kcal,
        input.proteinG,
        input.fatG,
        input.carbsG,
        now,
        now,
        newCloudId(),
      ]
    );
  }
}
