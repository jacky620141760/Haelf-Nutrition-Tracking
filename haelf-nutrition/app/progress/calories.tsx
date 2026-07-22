import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/src/context/AppContext';
import { listFoodEntriesByDate, listFoodEntriesInDateRange } from '@/src/db/repositories/food';
import { listExerciseEntriesInRange } from '@/src/db/repositories/exercise';
import { listGoalVersions } from '@/src/db/repositories/goals';
import { localDateRangeEnding } from '@/src/domain/dates';
import { resolveGoalForDate } from '@/src/domain/goals';
import type { FoodEntry, MealType } from '@/src/domain/types';
import { MfpCard, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function CaloriesDetailScreen() {
  const { selectedDate, t } = useApp();
  const [dayEntries, setDayEntries] = useState<FoodEntry[]>([]);
  const [week, setWeek] = useState<{ date: string; food: number; exercise: number; goal: number | null }[]>([]);
  useEffect(() => {
    void (async () => {
      const dates = localDateRangeEnding(selectedDate, 7);
      const [day, foods, exercises, goals] = await Promise.all([
        listFoodEntriesByDate(selectedDate),
        listFoodEntriesInDateRange(dates[0], dates[6]),
        listExerciseEntriesInRange(dates[0], dates[6]),
        listGoalVersions(),
      ]);
      setDayEntries(day);
      setWeek(dates.map((date) => ({
        date,
        food: foods.filter((entry) => entry.localDate === date).reduce((sum, entry) => sum + entry.snapKcal, 0),
        exercise: exercises.filter((entry) => entry.localDate === date).reduce((sum, entry) => sum + entry.burnedKcal, 0),
        goal: resolveGoalForDate(goals, date)?.kcal ?? null,
      })));
    })();
  }, [selectedDate]);
  const meals = useMemo(() => {
    const types: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
    const total = dayEntries.reduce((sum, entry) => sum + entry.snapKcal, 0);
    return types.map((meal) => {
      const kcal = dayEntries.filter((entry) => entry.mealType === meal).reduce((sum, entry) => sum + entry.snapKcal, 0);
      return { meal, kcal, percentage: total ? Math.round((kcal / total) * 100) : 0 };
    });
  }, [dayEntries]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={t('progressDetail.calories')} />
      <MfpCard>
        <Text style={styles.title}>{selectedDate}</Text>
        {meals.map((item) => (
          <View key={item.meal} style={styles.row}>
            <Text style={styles.label}>{t(`meal.${item.meal}`)}</Text>
            <Text style={styles.value}>{Math.round(item.kcal)} kcal · {item.percentage}%</Text>
          </View>
        ))}
      </MfpCard>
      <MfpCard>
        <Text style={styles.title}>{t('progressDetail.sevenDays')}</Text>
        {week.map((item) => (
          <View key={item.date} style={styles.row}>
            <Text style={styles.label}>{item.date}</Text>
            <Text style={styles.value}>
              {Math.round(item.food)} / {item.goal == null ? '—' : Math.round(item.goal)} · {item.exercise > 0 ? `+${Math.round(item.exercise)}` : '0'}
            </Text>
          </View>
        ))}
      </MfpCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md },
  title: { color: theme.colors.text, fontWeight: '700', marginBottom: theme.space.sm },
  row: { minHeight: theme.minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  label: { color: theme.colors.textMuted },
  value: { color: theme.colors.text, fontWeight: '600' },
});
