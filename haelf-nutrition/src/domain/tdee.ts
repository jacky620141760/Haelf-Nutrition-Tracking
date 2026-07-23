/** Mifflin–St Jeor BMR / TDEE helpers and weight-plan calorie suggestions. */

export type BiologicalSex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
/** auto = estimate BMR from body metrics; manual = user-entered BMR (stored in tdeeKcal). */
export type TdeeMode = 'auto' | 'manual';

export type BodyPlanInput = {
  sex: BiologicalSex;
  ageYears: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  currentWeightKg: number;
  targetWeightKg: number;
  planWeeks: number;
  tdeeMode: TdeeMode;
  /** Manual basal metabolic rate (BMR) when tdeeMode is manual. Column name remains tdee_kcal. */
  tdeeKcal?: number | null;
};

export type NutritionSuggestion = {
  bmr: number;
  tdee: number;
  dailyDeficit: number;
  dailyKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** Approximate kg change over the plan at this intake. */
  expectedDeltaKg: number;
  warnings: Array<'aggressive' | 'floor' | 'gain' | 'maintain'>;
};

const ACTIVITY_MULT: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** ~kcal to lose/gain 1 kg of body weight (rule of thumb). */
export const KCAL_PER_KG = 7700;

export function activityMultiplier(level: ActivityLevel): number {
  return ACTIVITY_MULT[level];
}

export function calculateBmr(input: {
  sex: BiologicalSex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  return Math.round(input.sex === 'male' ? base + 5 : base - 161);
}

export function calculateTdee(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULT[activity]);
}

function resolveBmr(plan: {
  tdeeMode: TdeeMode;
  tdeeKcal: number | null;
  sex: BiologicalSex | null;
  ageYears: number | null;
  heightCm: number | null;
  currentWeightKg: number | null;
}): number | null {
  if (
    plan.tdeeMode === 'manual' &&
    typeof plan.tdeeKcal === 'number' &&
    Number.isFinite(plan.tdeeKcal) &&
    plan.tdeeKcal > 0
  ) {
    return Math.round(plan.tdeeKcal);
  }
  if (
    plan.sex &&
    plan.ageYears != null &&
    plan.heightCm != null &&
    plan.currentWeightKg != null
  ) {
    return calculateBmr({
      sex: plan.sex,
      weightKg: plan.currentWeightKg,
      heightCm: plan.heightCm,
      ageYears: plan.ageYears,
    });
  }
  return null;
}

/** TDEE = BMR × activity. Manual mode uses user BMR; auto estimates BMR from metrics. */
export function resolveEffectiveTdee(plan: {
  tdeeMode: TdeeMode;
  tdeeKcal: number | null;
  sex: BiologicalSex | null;
  ageYears: number | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  currentWeightKg: number | null;
}): number | null {
  if (!plan.activityLevel) return null;
  const bmr = resolveBmr(plan);
  if (bmr == null) return null;
  return calculateTdee(bmr, plan.activityLevel);
}

/**
 * Metabolic balance for the day: TDEE + logged exercise − food.
 * Positive deficit ≈ weight loss direction.
 */
export function dayCalorieDeficit(input: {
  tdee: number;
  foodKcal: number;
  exerciseKcal: number;
}): { deficitKcal: number; approxKgLost: number } {
  const deficitKcal = Math.round(input.tdee + input.exerciseKcal - input.foodKcal);
  const approxKgLost = Math.round((deficitKcal / KCAL_PER_KG) * 1000) / 1000;
  return { deficitKcal, approxKgLost };
}

function calorieFloor(sex: BiologicalSex): number {
  return sex === 'female' ? 1200 : 1500;
}

function roundMacro(n: number): number {
  return Math.max(0, Math.round(n));
}

/**
 * Suggest daily kcal + macros from body metrics and a weight target over N weeks.
 * Protein ~2.0 g/kg current weight; fat ~0.8 g/kg; carbs fill remaining kcal.
 */
export function suggestNutritionPlan(input: BodyPlanInput): NutritionSuggestion {
  const autoBmr = calculateBmr({
    sex: input.sex,
    weightKg: input.currentWeightKg,
    heightCm: input.heightCm,
    ageYears: input.ageYears,
  });
  const bmr =
    input.tdeeMode === 'manual' &&
    typeof input.tdeeKcal === 'number' &&
    Number.isFinite(input.tdeeKcal) &&
    input.tdeeKcal > 0
      ? Math.round(input.tdeeKcal)
      : autoBmr;
  const tdee = calculateTdee(bmr, input.activityLevel);

  const days = Math.max(1, input.planWeeks * 7);
  const deltaKg = input.currentWeightKg - input.targetWeightKg;
  const warnings: NutritionSuggestion['warnings'] = [];

  let dailyDeficit = 0;
  if (Math.abs(deltaKg) < 0.05) {
    warnings.push('maintain');
    dailyDeficit = 0;
  } else if (deltaKg < 0) {
    warnings.push('gain');
    dailyDeficit = (deltaKg * KCAL_PER_KG) / days; // negative → surplus
  } else {
    dailyDeficit = (deltaKg * KCAL_PER_KG) / days;
  }

  // Cap aggressive cuts (~1 kg/week or 25% of TDEE).
  const maxDeficit = Math.min(tdee * 0.25, (1 * KCAL_PER_KG) / 7);
  if (dailyDeficit > maxDeficit) {
    dailyDeficit = maxDeficit;
    warnings.push('aggressive');
  }

  const floor = calorieFloor(input.sex);
  let dailyKcal = Math.round(tdee - dailyDeficit);
  if (dailyKcal < floor) {
    dailyKcal = floor;
    dailyDeficit = tdee - dailyKcal;
    warnings.push('floor');
  }

  const proteinG = roundMacro(2.0 * input.currentWeightKg);
  let fatG = roundMacro(0.8 * input.currentWeightKg);
  let proteinKcal = proteinG * 4;
  let fatKcal = fatG * 9;
  let carbKcal = dailyKcal - proteinKcal - fatKcal;
  if (carbKcal < dailyKcal * 0.1) {
    // Keep some carbs: trim fat toward 0.6 g/kg.
    fatG = roundMacro(Math.max(0.6 * input.currentWeightKg, (dailyKcal * 0.2) / 9));
    fatKcal = fatG * 9;
    proteinKcal = proteinG * 4;
    carbKcal = dailyKcal - proteinKcal - fatKcal;
  }
  if (carbKcal < 0) {
    // Extremely low calorie: scale protein/fat down proportionally.
    const scale = dailyKcal / Math.max(1, proteinKcal + fatKcal);
    const scaledProtein = roundMacro(proteinG * scale);
    const scaledFat = roundMacro(fatG * scale);
    return {
      bmr,
      tdee,
      dailyDeficit: Math.round(dailyDeficit),
      dailyKcal,
      proteinG: scaledProtein,
      fatG: scaledFat,
      carbsG: 0,
      expectedDeltaKg: roundMacro((dailyDeficit * days) / KCAL_PER_KG * 10) / 10,
      warnings,
    };
  }

  return {
    bmr,
    tdee,
    dailyDeficit: Math.round(dailyDeficit),
    dailyKcal,
    proteinG,
    fatG,
    carbsG: roundMacro(carbKcal / 4),
    expectedDeltaKg: Math.round(((tdee - dailyKcal) * days) / KCAL_PER_KG * 10) / 10,
    warnings,
  };
}
