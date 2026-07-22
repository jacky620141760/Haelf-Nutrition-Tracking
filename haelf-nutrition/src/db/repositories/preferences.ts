import type {
  AppLocale,
  AppPreferences,
  StepSource,
  WaterUnit,
} from '../../domain/types';
import { assertWritable, getDb } from '../database';

type Row = {
  locale: AppLocale;
  water_unit: WaterUnit;
  week_start: 0 | 1;
  step_mode: StepSource;
  exercise_calories_enabled: number;
  updated_at: string;
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  locale: 'zh-TW',
  waterUnit: 'ml',
  weekStart: 1,
  stepMode: 'pedometer',
  exerciseCaloriesEnabled: true,
  updatedAt: '',
};

export async function getPreferences(): Promise<AppPreferences> {
  const row = await getDb().getFirstAsync<Row>(`SELECT * FROM app_preferences WHERE id=1`);
  return row
    ? {
        locale: row.locale,
        waterUnit: row.water_unit,
        weekStart: row.week_start,
        stepMode: row.step_mode,
        exerciseCaloriesEnabled: !!row.exercise_calories_enabled,
        updatedAt: row.updated_at,
      }
    : DEFAULT_PREFERENCES;
}

export async function updatePreferences(
  patch: Partial<Omit<AppPreferences, 'updatedAt'>>
): Promise<AppPreferences> {
  assertWritable();
  const current = await getPreferences();
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await getDb().runAsync(
    `INSERT INTO app_preferences
      (id, locale, water_unit, week_start, step_mode, exercise_calories_enabled, updated_at)
     VALUES (1,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       locale=excluded.locale, water_unit=excluded.water_unit, week_start=excluded.week_start,
       step_mode=excluded.step_mode,
       exercise_calories_enabled=excluded.exercise_calories_enabled, updated_at=excluded.updated_at`,
    [
      next.locale,
      next.waterUnit,
      next.weekStart,
      next.stepMode,
      next.exerciseCaloriesEnabled ? 1 : 0,
      next.updatedAt,
    ]
  );
  return next;
}
