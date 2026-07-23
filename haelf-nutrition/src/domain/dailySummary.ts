import type {
  DailyDiaryStatus,
  DailyGoalVersion,
  DailyStepTotal,
  DailySummary,
  ExerciseEntry,
  FoodEntry,
  WaterEntry,
  WaterGoalVersion,
} from './types';
import { addLocalDays } from './dates';
import { sumNutrients } from './nutrition';
import { totalExerciseKcal } from './exercise';

export function buildDailySummary(input: {
  localDate: string;
  foodEntries: FoodEntry[];
  exerciseEntries: ExerciseEntry[];
  waterEntries: WaterEntry[];
  stepTotal: DailyStepTotal | null;
  goal: DailyGoalVersion | null;
  waterGoal: WaterGoalVersion | null;
  diaryStatus: DailyDiaryStatus | null;
  /** @deprecated No longer affects remaining; kept for call-site compatibility. */
  exerciseCaloriesEnabled?: boolean;
}): DailySummary {
  const food = sumNutrients(
    input.foodEntries.map((entry) => ({
      kcal: entry.snapKcal,
      protein_g: entry.snapProteinG,
      fat_g: entry.snapFatG,
      carbs_g: entry.snapCarbsG,
    }))
  );
  const exerciseKcal = totalExerciseKcal(input.exerciseEntries);
  return {
    localDate: input.localDate,
    food,
    exerciseKcal,
    // Daily goal remaining is food-only; exercise/steps are tracked separately.
    remainingKcal: input.goal ? input.goal.kcal - food.kcal : null,
    waterMl: input.waterEntries.reduce((total, entry) => total + entry.ml, 0),
    waterGoalMl: input.waterGoal?.ml ?? null,
    steps: input.stepTotal?.steps ?? null,
    stepSource: input.stepTotal?.source ?? null,
    goal: input.goal,
    completedAt: input.diaryStatus?.completedAt ?? null,
  };
}

export function foodLoggingStreak(
  recordedDates: Iterable<string>,
  anchorDate: string
): number {
  const dates = new Set(recordedDates);
  let streak = 0;
  let cursor = anchorDate;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
}
