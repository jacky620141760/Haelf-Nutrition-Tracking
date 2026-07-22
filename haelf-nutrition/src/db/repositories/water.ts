import type { WaterEntry, WaterGoalVersion } from '../../domain/types';
import { ONGOING_GOAL_EFFECTIVE_DATE } from '../schema';
import { assertWritable, getDb } from '../database';

type WaterRow = {
  id: number;
  ml: number;
  utc_timestamp: string;
  local_date: string;
  tz_iana: string;
  tz_offset_minutes: number;
  created_at: string;
  updated_at: string;
};

type GoalRow = {
  id: number;
  effective_date: string;
  ml: number;
  created_at: string;
  updated_at: string;
};

function mapWater(row: WaterRow): WaterEntry {
  return {
    id: row.id,
    ml: row.ml,
    utcTimestamp: row.utc_timestamp,
    localDate: row.local_date,
    tzIana: row.tz_iana,
    tzOffsetMinutes: row.tz_offset_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGoal(row: GoalRow): WaterGoalVersion {
  return {
    id: row.id,
    effectiveDate: row.effective_date,
    ml: row.ml,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listWaterEntriesByDate(localDate: string): Promise<WaterEntry[]> {
  const rows = await getDb().getAllAsync<WaterRow>(
    `SELECT * FROM water_entries WHERE local_date=? ORDER BY utc_timestamp DESC, id DESC`,
    [localDate]
  );
  return rows.map(mapWater);
}

export async function listWaterEntriesInRange(
  startDate: string,
  endDate: string
): Promise<WaterEntry[]> {
  const rows = await getDb().getAllAsync<WaterRow>(
    `SELECT * FROM water_entries WHERE local_date>=? AND local_date<=? ORDER BY local_date, utc_timestamp`,
    [startDate, endDate]
  );
  return rows.map(mapWater);
}

export async function createWaterEntry(input: {
  ml: number;
  utcTimestamp: string;
  localDate: string;
  tzIana: string;
  tzOffsetMinutes: number;
}): Promise<number> {
  assertWritable();
  const now = new Date().toISOString();
  const result = await getDb().runAsync(
    `INSERT INTO water_entries (ml, utc_timestamp, local_date, tz_iana, tz_offset_minutes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [input.ml, input.utcTimestamp, input.localDate, input.tzIana, input.tzOffsetMinutes, now, now]
  );
  return result.lastInsertRowId;
}

export async function deleteWaterEntry(id: number): Promise<void> {
  assertWritable();
  await getDb().runAsync(`DELETE FROM water_entries WHERE id=?`, [id]);
}

export async function listWaterGoalVersions(): Promise<WaterGoalVersion[]> {
  const rows = await getDb().getAllAsync<GoalRow>(
    `SELECT * FROM water_goal_versions WHERE deleted_at IS NULL ORDER BY effective_date DESC`
  );
  return rows.map(mapGoal);
}

export async function upsertWaterGoalForDate(
  effectiveDate: string,
  ml: number
): Promise<void> {
  assertWritable();
  const now = new Date().toISOString();
  await getDb().runAsync(
    `INSERT INTO water_goal_versions (effective_date, ml, created_at, updated_at, cloud_id, deleted_at)
     VALUES (?,?,?,?,NULL,NULL)
     ON CONFLICT(effective_date) DO UPDATE SET ml=excluded.ml, updated_at=excluded.updated_at, deleted_at=NULL`,
    [effectiveDate, ml, now, now]
  );
}

export async function upsertOngoingWaterGoal(ml: number): Promise<void> {
  return upsertWaterGoalForDate(ONGOING_GOAL_EFFECTIVE_DATE, ml);
}
