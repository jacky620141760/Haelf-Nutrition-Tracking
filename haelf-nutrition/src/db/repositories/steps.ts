import type { DailyStepTotal, StepSource } from '../../domain/types';
import { assertWritable, getDb } from '../database';

type Row = {
  local_date: string;
  steps: number;
  source: StepSource;
  synced_at: string;
  updated_at: string;
};

function map(row: Row): DailyStepTotal {
  return {
    localDate: row.local_date,
    steps: row.steps,
    source: row.source,
    syncedAt: row.synced_at,
    updatedAt: row.updated_at,
  };
}

export async function getDailyStepTotal(localDate: string): Promise<DailyStepTotal | null> {
  const row = await getDb().getFirstAsync<Row>(
    `SELECT * FROM daily_step_totals WHERE local_date=?`,
    [localDate]
  );
  return row ? map(row) : null;
}

export async function listDailyStepTotals(
  startDate: string,
  endDate: string
): Promise<DailyStepTotal[]> {
  const rows = await getDb().getAllAsync<Row>(
    `SELECT * FROM daily_step_totals WHERE local_date>=? AND local_date<=? ORDER BY local_date`,
    [startDate, endDate]
  );
  return rows.map(map);
}

export async function upsertDailyStepTotal(input: {
  localDate: string;
  steps: number;
  source: StepSource;
  syncedAt?: string;
}): Promise<void> {
  assertWritable();
  const now = input.syncedAt ?? new Date().toISOString();
  await getDb().runAsync(
    `INSERT INTO daily_step_totals (local_date, steps, source, synced_at, updated_at)
     VALUES (?,?,?,?,?)
     ON CONFLICT(local_date) DO UPDATE SET
       steps=excluded.steps, source=excluded.source, synced_at=excluded.synced_at, updated_at=excluded.updated_at`,
    [input.localDate, input.steps, input.source, now, now]
  );
}
