import { useCallback, useEffect, useState } from 'react';
import type { DailySummary, FoodEntry, WeightEntry } from '@/src/domain/types';
import { foodLoggingStreak } from '@/src/domain/dailySummary';
import { addLocalDays } from '@/src/domain/dates';
import { listFoodEntriesByDate } from '@/src/db/repositories/food';
import {
  listRecordedFoodDates,
  loadDailySummary,
} from '@/src/db/repositories/dailySummary';
import { getLatestWeightOnOrBefore } from '@/src/db/repositories/weight';
import { getBodyPlan } from '@/src/db/repositories/bodyPlan';
import { dayCalorieDeficit, resolveEffectiveTdee } from '@/src/domain/tdee';
import { getPreferences } from '@/src/db/repositories/preferences';

export type DiaryDeficit = {
  tdee: number;
  deficitKcal: number;
  approxKgLost: number;
};

export function useDiaryDay(localDate: string, refreshToken: number) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [streak, setStreak] = useState(0);
  const [deficit, setDeficit] = useState<DiaryDeficit | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [nextSummary, nextEntries, weight, recordedDates, plan, prefs] = await Promise.all([
      loadDailySummary(localDate),
      listFoodEntriesByDate(localDate),
      getLatestWeightOnOrBefore(localDate),
      listRecordedFoodDates(addLocalDays(localDate, -365), localDate),
      getBodyPlan(),
      getPreferences(),
    ]);
    setSummary(nextSummary);
    setEntries(nextEntries);
    setLatestWeight(weight);
    setStreak(foodLoggingStreak(recordedDates, localDate));

    const tdee = resolveEffectiveTdee(plan);
    if (tdee != null) {
      const exerciseKcal =
        prefs.exerciseCaloriesEnabled === false ? 0 : nextSummary.exerciseKcal;
      const balance = dayCalorieDeficit({
        tdee,
        foodKcal: nextSummary.food.kcal,
        exerciseKcal,
      });
      setDeficit({ tdee, ...balance });
    } else {
      setDeficit(null);
    }
    setLoading(false);
  }, [localDate]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  return { summary, entries, latestWeight, streak, deficit, loading, reload: load };
}
