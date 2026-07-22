import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/src/context/AppContext';
import { listFoodEntriesByDate, listFoodEntriesInDateRange } from '@/src/db/repositories/food';
import { listGoalVersions } from '@/src/db/repositories/goals';
import { localDateRangeEnding } from '@/src/domain/dates';
import { resolveGoalForDate } from '@/src/domain/goals';
import { sumNutrients } from '@/src/domain/nutrition';
import type { DailyGoalVersion, FoodEntry, Nutrients } from '@/src/domain/types';
import { MacroMiniRing } from '@/src/components/nutrition/ProgressRing';
import { MfpCard, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

const EMPTY: Nutrients = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };

function total(entries: FoodEntry[]): Nutrients {
  return sumNutrients(entries.map((entry) => ({
    kcal: entry.snapKcal,
    protein_g: entry.snapProteinG,
    fat_g: entry.snapFatG,
    carbs_g: entry.snapCarbsG,
  })));
}

export default function MacrosDetailScreen() {
  const { selectedDate, t } = useApp();
  const [day, setDay] = useState<Nutrients>(EMPTY);
  const [weekEntries, setWeekEntries] = useState<FoodEntry[]>([]);
  const [goal, setGoal] = useState<DailyGoalVersion | null>(null);
  useEffect(() => {
    void (async () => {
      const dates = localDateRangeEnding(selectedDate, 7);
      const [dayEntries, rangeEntries, goals] = await Promise.all([
        listFoodEntriesByDate(selectedDate),
        listFoodEntriesInDateRange(dates[0], dates[6]),
        listGoalVersions(),
      ]);
      setDay(total(dayEntries));
      setWeekEntries(rangeEntries);
      setGoal(resolveGoalForDate(goals, selectedDate));
    })();
  }, [selectedDate]);
  const average = useMemo(() => {
    const dates = new Set(weekEntries.map((entry) => entry.localDate));
    if (!dates.size) return EMPTY;
    const summed = total(weekEntries);
    return {
      kcal: summed.kcal / dates.size,
      protein_g: summed.protein_g / dates.size,
      fat_g: summed.fat_g / dates.size,
      carbs_g: summed.carbs_g / dates.size,
    };
  }, [weekEntries]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={t('progressDetail.macros')} />
      <MfpCard>
        <Text style={styles.title}>{selectedDate}</Text>
        <View style={styles.rings}>
          <MacroMiniRing label={t('diary.macros.carbs')} consumed={Math.round(day.carbs_g)} goal={goal?.carbsG ?? null} color={theme.colors.carbs} />
          <MacroMiniRing label={t('diary.macros.fat')} consumed={Math.round(day.fat_g)} goal={goal?.fatG ?? null} color={theme.colors.fat} />
          <MacroMiniRing label={t('diary.macros.protein')} consumed={Math.round(day.protein_g)} goal={goal?.proteinG ?? null} color={theme.colors.protein} />
        </View>
      </MfpCard>
      <MfpCard>
        <Text style={styles.title}>{t('progressDetail.loggedAverage')}</Text>
        <Text style={styles.average}>C {average.carbs_g.toFixed(1)} g · F {average.fat_g.toFixed(1)} g · P {average.protein_g.toFixed(1)} g</Text>
      </MfpCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md },
  title: { color: theme.colors.text, fontWeight: '700', marginBottom: theme.space.md },
  rings: { flexDirection: 'row' },
  average: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600' },
});
