import type {
  ActivityLevel,
  BiologicalSex,
  TdeeMode,
} from '../../domain/tdee';
import { assertWritable, getDb } from '../database';
import { scheduleSync } from '../../services/sync/scheduler';

export type BodyPlan = {
  sex: BiologicalSex | null;
  ageYears: number | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  planWeeks: number | null;
  tdeeMode: TdeeMode;
  /** Manual BMR when tdeeMode is 'manual'; null in auto (TDEE = BMR × activity). */
  tdeeKcal: number | null;
  updatedAt: string;
};

type Row = {
  sex: string | null;
  age_years: number | null;
  height_cm: number | null;
  activity_level: string | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  plan_weeks: number | null;
  tdee_mode: string | null;
  tdee_kcal: number | null;
  updated_at: string;
};

const SEX: BiologicalSex[] = ['male', 'female'];
const ACTIVITY: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];

function asSex(v: unknown): BiologicalSex | null {
  return typeof v === 'string' && SEX.includes(v as BiologicalSex)
    ? (v as BiologicalSex)
    : null;
}

function asActivity(v: unknown): ActivityLevel | null {
  return typeof v === 'string' && ACTIVITY.includes(v as ActivityLevel)
    ? (v as ActivityLevel)
    : null;
}

function asTdeeMode(v: unknown): TdeeMode {
  return v === 'manual' ? 'manual' : 'auto';
}

function asNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export const EMPTY_BODY_PLAN: BodyPlan = {
  sex: null,
  ageYears: null,
  heightCm: null,
  activityLevel: null,
  currentWeightKg: null,
  targetWeightKg: null,
  planWeeks: null,
  tdeeMode: 'auto',
  tdeeKcal: null,
  updatedAt: '',
};

function map(row: Row): BodyPlan {
  return {
    sex: asSex(row.sex),
    ageYears: asNum(row.age_years),
    heightCm: asNum(row.height_cm),
    activityLevel: asActivity(row.activity_level),
    currentWeightKg: asNum(row.current_weight_kg),
    targetWeightKg: asNum(row.target_weight_kg),
    planWeeks: asNum(row.plan_weeks),
    tdeeMode: asTdeeMode(row.tdee_mode),
    tdeeKcal: asNum(row.tdee_kcal),
    updatedAt: row.updated_at ?? '',
  };
}

export async function getBodyPlan(): Promise<BodyPlan> {
  const row = await getDb().getFirstAsync<Row>(
    `SELECT sex, age_years, height_cm, activity_level, current_weight_kg,
            target_weight_kg, plan_weeks, tdee_mode, tdee_kcal, updated_at
     FROM app_preferences WHERE id=1`
  );
  return row ? map(row) : EMPTY_BODY_PLAN;
}

export async function saveBodyPlan(
  plan: Omit<BodyPlan, 'updatedAt'>
): Promise<BodyPlan> {
  assertWritable();
  const updatedAt = new Date().toISOString();
  await getDb().runAsync(
    `UPDATE app_preferences SET
       sex=?, age_years=?, height_cm=?, activity_level=?,
       current_weight_kg=?, target_weight_kg=?, plan_weeks=?,
       tdee_mode=?, tdee_kcal=?, updated_at=?
     WHERE id=1`,
    [
      plan.sex,
      plan.ageYears,
      plan.heightCm,
      plan.activityLevel,
      plan.currentWeightKg,
      plan.targetWeightKg,
      plan.planWeeks,
      plan.tdeeMode,
      plan.tdeeKcal,
      updatedAt,
    ]
  );
  scheduleSync();
  return { ...plan, updatedAt };
}
