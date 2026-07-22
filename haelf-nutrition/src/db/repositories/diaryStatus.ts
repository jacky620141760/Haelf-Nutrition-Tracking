import type { DailyDiaryStatus } from '../../domain/types';
import { assertWritable, getDb } from '../database';

type Row = {
  local_date: string;
  completed_at: string;
  updated_at: string;
};

export async function getDiaryStatus(
  localDate: string
): Promise<DailyDiaryStatus | null> {
  const row = await getDb().getFirstAsync<Row>(
    `SELECT * FROM daily_diary_status WHERE local_date=?`,
    [localDate]
  );
  return row
    ? {
        localDate: row.local_date,
        completedAt: row.completed_at,
        updatedAt: row.updated_at,
      }
    : null;
}

export async function setDiaryCompleted(
  localDate: string,
  completed: boolean
): Promise<void> {
  assertWritable();
  if (!completed) {
    await getDb().runAsync(`DELETE FROM daily_diary_status WHERE local_date=?`, [localDate]);
    return;
  }
  const now = new Date().toISOString();
  await getDb().runAsync(
    `INSERT INTO daily_diary_status (local_date, completed_at, updated_at)
     VALUES (?,?,?)
     ON CONFLICT(local_date) DO UPDATE SET completed_at=excluded.completed_at, updated_at=excluded.updated_at`,
    [localDate, now, now]
  );
}

export async function listCompletedDates(
  startDate: string,
  endDate: string
): Promise<string[]> {
  const rows = await getDb().getAllAsync<{ local_date: string }>(
    `SELECT local_date FROM daily_diary_status WHERE local_date>=? AND local_date<=? ORDER BY local_date`,
    [startDate, endDate]
  );
  return rows.map((row) => row.local_date);
}
