import type { DailyGoalVersion, Nutrients } from './types';

/** Resolve goal for a Local_Date: latest effective_date <= target, or null. */
export function resolveGoalForDate(
  versions: DailyGoalVersion[],
  localDate: string
): DailyGoalVersion | null {
  const eligible = versions
    .filter((v) => v.effectiveDate <= localDate)
    .sort((a, b) => {
      if (a.effectiveDate !== b.effectiveDate) {
        return a.effectiveDate < b.effectiveDate ? 1 : -1;
      }
      return b.id - a.id;
    });
  return eligible[0] ?? null;
}

export function goalToNutrients(g: DailyGoalVersion): Nutrients {
  return {
    kcal: g.kcal,
    protein_g: g.proteinG,
    fat_g: g.fatG,
    carbs_g: g.carbsG,
  };
}

export function diffVsGoal(intake: Nutrients, goal: Nutrients): Nutrients {
  return {
    kcal: intake.kcal - goal.kcal,
    protein_g: intake.protein_g - goal.protein_g,
    fat_g: intake.fat_g - goal.fat_g,
    carbs_g: intake.carbs_g - goal.carbs_g,
  };
}
