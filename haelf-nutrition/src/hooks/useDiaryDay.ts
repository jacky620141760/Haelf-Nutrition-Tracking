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

export function useDiaryDay(localDate: string, refreshToken: number) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [nextSummary, nextEntries, weight, recordedDates] = await Promise.all([
      loadDailySummary(localDate),
      listFoodEntriesByDate(localDate),
      getLatestWeightOnOrBefore(localDate),
      listRecordedFoodDates(addLocalDays(localDate, -365), localDate),
    ]);
    setSummary(nextSummary);
    setEntries(nextEntries);
    setLatestWeight(weight);
    setStreak(foodLoggingStreak(recordedDates, localDate));
    setLoading(false);
  }, [localDate]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  return { summary, entries, latestWeight, streak, loading, reload: load };
}
