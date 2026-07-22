import type { DailySummary } from '../../domain/types';
import { buildDailySummary } from '../../domain/dailySummary';
import { resolveGoalForDate } from '../../domain/goals';
import { resolveWaterGoalForDate } from '../../domain/water';
import { listFoodEntriesByDate } from './food';
import { listGoalVersions } from './goals';
import { listWaterEntriesByDate, listWaterGoalVersions } from './water';
import { listExerciseEntriesByDate } from './exercise';
import { getDailyStepTotal } from './steps';
import { getDiaryStatus } from './diaryStatus';
import { getPreferences } from './preferences';
import { getDb } from '../database';

export async function loadDailySummary(localDate: string): Promise<DailySummary> {
  const [
    foodEntries,
    exerciseEntries,
    waterEntries,
    stepTotal,
    goals,
    waterGoals,
    diaryStatus,
    preferences,
  ] = await Promise.all([
    listFoodEntriesByDate(localDate),
    listExerciseEntriesByDate(localDate),
    listWaterEntriesByDate(localDate),
    getDailyStepTotal(localDate),
    listGoalVersions(),
    listWaterGoalVersions(),
    getDiaryStatus(localDate),
    getPreferences(),
  ]);

  return buildDailySummary({
    localDate,
    foodEntries,
    exerciseEntries,
    waterEntries,
    stepTotal,
    goal: resolveGoalForDate(goals, localDate),
    waterGoal: resolveWaterGoalForDate(waterGoals, localDate),
    diaryStatus,
    exerciseCaloriesEnabled: preferences.exerciseCaloriesEnabled,
  });
}

export async function listRecordedFoodDates(
  startDate: string,
  endDate: string
): Promise<string[]> {
  const rows = await getDb().getAllAsync<{ local_date: string }>(
    `SELECT DISTINCT local_date FROM food_entries
     WHERE local_date>=? AND local_date<=? ORDER BY local_date`,
    [startDate, endDate]
  );
  return rows.map((row) => row.local_date);
}
