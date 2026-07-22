import type { ExerciseEntry } from '../../domain/types';
import { assertWritable, getDb } from '../database';

type Row = {
  id: number;
  name: string;
  duration_minutes: number;
  burned_kcal: number;
  source: 'manual';
  utc_timestamp: string;
  local_date: string;
  tz_iana: string;
  tz_offset_minutes: number;
  created_at: string;
  updated_at: string;
};

function map(row: Row): ExerciseEntry {
  return {
    id: row.id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    burnedKcal: row.burned_kcal,
    source: row.source,
    utcTimestamp: row.utc_timestamp,
    localDate: row.local_date,
    tzIana: row.tz_iana,
    tzOffsetMinutes: row.tz_offset_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listExerciseEntriesByDate(
  localDate: string
): Promise<ExerciseEntry[]> {
  const rows = await getDb().getAllAsync<Row>(
    `SELECT * FROM exercise_entries WHERE local_date=? ORDER BY utc_timestamp DESC, id DESC`,
    [localDate]
  );
  return rows.map(map);
}

export async function listExerciseEntriesInRange(
  startDate: string,
  endDate: string
): Promise<ExerciseEntry[]> {
  const rows = await getDb().getAllAsync<Row>(
    `SELECT * FROM exercise_entries WHERE local_date>=? AND local_date<=? ORDER BY local_date, utc_timestamp`,
    [startDate, endDate]
  );
  return rows.map(map);
}

export type ExerciseInput = {
  name: string;
  durationMinutes: number;
  burnedKcal: number;
  utcTimestamp: string;
  localDate: string;
  tzIana: string;
  tzOffsetMinutes: number;
};

export async function createExerciseEntry(input: ExerciseInput): Promise<number> {
  assertWritable();
  const now = new Date().toISOString();
  const result = await getDb().runAsync(
    `INSERT INTO exercise_entries
      (name, duration_minutes, burned_kcal, source, utc_timestamp, local_date, tz_iana, tz_offset_minutes, created_at, updated_at)
     VALUES (?,?,?,'manual',?,?,?,?,?,?)`,
    [
      input.name,
      input.durationMinutes,
      input.burnedKcal,
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

export async function updateExerciseEntry(id: number, input: ExerciseInput): Promise<void> {
  assertWritable();
  await getDb().runAsync(
    `UPDATE exercise_entries SET
      name=?, duration_minutes=?, burned_kcal=?, utc_timestamp=?, local_date=?, tz_iana=?,
      tz_offset_minutes=?, updated_at=? WHERE id=?`,
    [
      input.name,
      input.durationMinutes,
      input.burnedKcal,
      input.utcTimestamp,
      input.localDate,
      input.tzIana,
      input.tzOffsetMinutes,
      new Date().toISOString(),
      id,
    ]
  );
}

export async function deleteExerciseEntry(id: number): Promise<void> {
  assertWritable();
  await getDb().runAsync(`DELETE FROM exercise_entries WHERE id=?`, [id]);
}
