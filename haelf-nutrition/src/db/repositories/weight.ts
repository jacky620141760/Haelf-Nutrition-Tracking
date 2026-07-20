import type { WeightEntry } from '../../domain/types';
import { assertWritable, getDb } from '../database';

type Row = {
  id: number;
  kg: number;
  utc_timestamp: string;
  local_date: string;
  tz_iana: string;
  tz_offset_minutes: number;
  created_at: string;
  updated_at: string;
};

function map(row: Row): WeightEntry {
  return {
    id: row.id,
    kg: row.kg,
    utcTimestamp: row.utc_timestamp,
    localDate: row.local_date,
    tzIana: row.tz_iana,
    tzOffsetMinutes: row.tz_offset_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listWeightsByDate(localDate: string): Promise<WeightEntry[]> {
  const rows = await getDb().getAllAsync<Row>(
    `SELECT * FROM weight_entries WHERE local_date = ? ORDER BY utc_timestamp DESC, id DESC`,
    [localDate]
  );
  return rows.map(map);
}

export async function listWeightsInRange(startDate: string, endDate: string): Promise<WeightEntry[]> {
  const rows = await getDb().getAllAsync<Row>(
    `SELECT * FROM weight_entries WHERE local_date >= ? AND local_date <= ? ORDER BY local_date, utc_timestamp, id`,
    [startDate, endDate]
  );
  return rows.map(map);
}

/** Daily_Last_Weight: max utc_timestamp; tie-break max id. */
export function pickDailyLastWeights(entries: WeightEntry[]): Map<string, WeightEntry> {
  const map = new Map<string, WeightEntry>();
  for (const e of entries) {
    const cur = map.get(e.localDate);
    if (!cur) {
      map.set(e.localDate, e);
      continue;
    }
    if (
      e.utcTimestamp > cur.utcTimestamp ||
      (e.utcTimestamp === cur.utcTimestamp && e.id > cur.id)
    ) {
      map.set(e.localDate, e);
    }
  }
  return map;
}

export async function createWeightEntry(input: {
  kg: number;
  utcTimestamp: string;
  localDate: string;
  tzIana: string;
  tzOffsetMinutes: number;
}): Promise<number> {
  assertWritable();
  const now = new Date().toISOString();
  const result = await getDb().runAsync(
    `INSERT INTO weight_entries (kg, utc_timestamp, local_date, tz_iana, tz_offset_minutes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [
      input.kg,
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

export async function updateWeightEntry(
  id: number,
  input: {
    kg: number;
    utcTimestamp: string;
    localDate: string;
    tzIana: string;
    tzOffsetMinutes: number;
  }
): Promise<void> {
  assertWritable();
  const now = new Date().toISOString();
  await getDb().runAsync(
    `UPDATE weight_entries SET kg=?, utc_timestamp=?, local_date=?, tz_iana=?, tz_offset_minutes=?, updated_at=? WHERE id=?`,
    [
      input.kg,
      input.utcTimestamp,
      input.localDate,
      input.tzIana,
      input.tzOffsetMinutes,
      now,
      id,
    ]
  );
}

export async function deleteWeightEntry(id: number): Promise<void> {
  assertWritable();
  await getDb().runAsync(`DELETE FROM weight_entries WHERE id = ?`, [id]);
}

export async function getWeightEntry(id: number): Promise<WeightEntry | null> {
  const row = await getDb().getFirstAsync<Row>(`SELECT * FROM weight_entries WHERE id=?`, [id]);
  return row ? map(row) : null;
}
