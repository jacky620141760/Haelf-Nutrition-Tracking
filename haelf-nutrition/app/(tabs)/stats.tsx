import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import { listFoodEntriesInDateRange } from '@/src/db/repositories/food';
import { listGoalVersions } from '@/src/db/repositories/goals';
import { listWeightsInRange, pickDailyLastWeights } from '@/src/db/repositories/weight';
import {
  listWaterEntriesInRange,
  listWaterGoalVersions,
} from '@/src/db/repositories/water';
import { listExerciseEntriesInRange } from '@/src/db/repositories/exercise';
import { listDailyStepTotals } from '@/src/db/repositories/steps';
import { localDateRangeEnding, addLocalDays, weekDates } from '@/src/domain/dates';
import { getPreferences } from '@/src/db/repositories/preferences';
import { resolveGoalForDate, goalToNutrients } from '@/src/domain/goals';
import { displayNutrients, displayWeightKg, sumNutrients } from '@/src/domain/nutrition';
import { resolveWaterGoalForDate } from '@/src/domain/water';
import { totalExerciseMinutes } from '@/src/domain/exercise';
import { rollingWeeklyWeightAverages } from '@/src/domain/progress';
import { CalorieTrendChart, WeightDailyChart, WeightWeeklyChart } from '@/src/components/Charts';
import { PrimaryButton, SectionTitle, MfpCard } from '@/src/components/ui';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

type FoodPoint = { label: string; value: number | null };

export default function StatsScreen() {
  const { selectedDate, setSelectedDate, refreshToken } = useApp();
  const router = useRouter();
  const [endDate, setEndDate] = useState(selectedDate);
  const [foodPoints, setFoodPoints] = useState<FoodPoint[]>([]);
  const [foodGoalKcal, setFoodGoalKcal] = useState<number | null>(null);
  const [foodLocale, setFoodLocale] = useState('zh-TW');
  const [foodAvg, setFoodAvg] = useState<string>('');
  const [foodEmpty, setFoodEmpty] = useState(false);
  const [weightDailyPoints, setWeightDailyPoints] = useState<FoodPoint[]>([]);
  const [weightWeeklyPoints, setWeightWeeklyPoints] = useState<FoodPoint[]>([]);
  const [weightChange, setWeightChange] = useState('');
  const [weightDailyEmpty, setWeightDailyEmpty] = useState(false);
  const [weightWeeklyEmpty, setWeightWeeklyEmpty] = useState(false);
  const [habitStats, setHabitStats] = useState({
    waterGoalDays: 0,
    exerciseMinutes: 0,
    stepsAverage: 0,
    stepDays: 0,
  });

  const load = useCallback(async (targetEndDate: string) => {
    const prefs = await getPreferences();
    setFoodLocale(prefs.locale === 'en' ? 'en' : 'zh-TW');
    const foodDays = weekDates(targetEndDate, prefs.weekStart);
    const foods = await listFoodEntriesInDateRange(foodDays[0], foodDays[foodDays.length - 1]);
    const goals = await listGoalVersions();
    const byDate = new Map<string, typeof foods>();
    for (const f of foods) {
      const arr = byDate.get(f.localDate) ?? [];
      arr.push(f);
      byDate.set(f.localDate, arr);
    }
    const bars = foodDays.map((d) => {
      const list = byDate.get(d);
      const g = resolveGoalForDate(goals, d);
      if (!list?.length) {
        return { label: d, value: null };
      }
      const sum = sumNutrients(
        list.map((e) => ({
          kcal: e.snapKcal,
          protein_g: e.snapProteinG,
          fat_g: e.snapFatG,
          carbs_g: e.snapCarbsG,
        }))
      );
      return {
        label: d,
        value: displayNutrients(sum).kcal,
      };
    });
    setFoodPoints(bars);
    const weekGoal = resolveGoalForDate(goals, foodDays[foodDays.length - 1]);
    setFoodGoalKcal(weekGoal ? displayNutrients(goalToNutrients(weekGoal)).kcal : null);
    const recordedDays = foodDays.filter((date) => (byDate.get(date)?.length ?? 0) > 0);
    setFoodEmpty(bars.every((bar) => bar.value == null) && !weekGoal);
    let avgText = '';
    if (recordedDays.length) {
      const totalKcal = recordedDays.reduce((sum, date) => {
        const list = byDate.get(date) ?? [];
        const day = sumNutrients(
          list.map((e) => ({
            kcal: e.snapKcal,
            protein_g: e.snapProteinG,
            fat_g: e.snapFatG,
            carbs_g: e.snapCarbsG,
          }))
        );
        return sum + displayNutrients(day).kcal;
      }, 0);
      const avgKcal = Math.round(totalKcal / recordedDays.length);
      avgText = `${zhTW.stats.average}：${avgKcal} kcal`;
    }
    setFoodAvg(avgText);

    const [waterEntries, waterGoals, exercises, steps] = await Promise.all([
      listWaterEntriesInRange(foodDays[0], foodDays[foodDays.length - 1]),
      listWaterGoalVersions(),
      listExerciseEntriesInRange(foodDays[0], foodDays[foodDays.length - 1]),
      listDailyStepTotals(foodDays[0], foodDays[foodDays.length - 1]),
    ]);
    const waterByDate = new Map<string, number>();
    for (const entry of waterEntries) {
      waterByDate.set(entry.localDate, (waterByDate.get(entry.localDate) ?? 0) + entry.ml);
    }
    const waterGoalDays = foodDays.filter((date) => {
      const goal = resolveWaterGoalForDate(waterGoals, date);
      return goal != null && (waterByDate.get(date) ?? 0) >= goal.ml;
    }).length;
    const stepsAverage = steps.length
      ? Math.round(steps.reduce((total, item) => total + item.steps, 0) / steps.length)
      : 0;
    setHabitStats({
      waterGoalDays,
      exerciseMinutes: Math.round(totalExerciseMinutes(exercises)),
      stepsAverage,
      stepDays: steps.length,
    });

    const wDays = localDateRangeEnding(targetEndDate, 30);
    const weights = await listWeightsInRange(
      addLocalDays(targetEndDate, -(12 * 7 - 1)),
      targetEndDate
    );
    const lastMap = pickDailyLastWeights(weights);
    const dailyPts = wDays.map((d) => {
      const w = lastMap.get(d);
      return { label: d, value: w ? w.kg : null };
    });
    setWeightDailyPoints(dailyPts);
    const dailyKg = new Map<string, number>();
    for (const [date, entry] of lastMap) dailyKg.set(date, entry.kg);
    const weeklyPts = rollingWeeklyWeightAverages(dailyKg, targetEndDate, 12);
    setWeightWeeklyPoints(weeklyPts);

    const dailyPresent = dailyPts.filter((p) => p.value != null);
    setWeightDailyEmpty(dailyPresent.length === 0);
    setWeightWeeklyEmpty(weeklyPts.every((p) => p.value == null));
    if (dailyPresent.length >= 2) {
      const first = dailyPresent[0].value as number;
      const last = dailyPresent[dailyPresent.length - 1].value as number;
      const delta = last - first;
      setWeightChange(
        `${zhTW.weight.change}（30 日）：${delta >= 0 ? '+' : ''}${displayWeightKg(delta)} kg`
      );
    } else if (dailyPresent.length === 1) {
      setWeightChange(`${zhTW.weight.change}：${zhTW.weight.insufficient}`);
    } else {
      setWeightChange('');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const targetEndDate = selectedDate;
      setEndDate(targetEndDate);
      void load(targetEndDate);
    }, [load, selectedDate, refreshToken])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={zhTW.stats.title} />
      <View style={styles.dateRow}>
        <Pressable
          style={styles.dateBtn}
          onPress={() => {
            const d = addLocalDays(endDate, -1);
            setEndDate(d);
            setSelectedDate(d);
          }}
          accessibilityLabel="結束日期前移"
        >
          <Text style={styles.dateBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.dateText}>
          {zhTW.stats.endDate}：{endDate}
        </Text>
        <Pressable
          style={styles.dateBtn}
          onPress={() => {
            const d = addLocalDays(endDate, 1);
            setEndDate(d);
            setSelectedDate(d);
          }}
          accessibilityLabel="結束日期後移"
        >
          <Text style={styles.dateBtnText}>›</Text>
        </Pressable>
      </View>

      <MfpCard>
        <Text style={styles.blockTitle}>{zhTW.stats.food7d}</Text>
        {foodEmpty ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.empty}>{zhTW.stats.noFood}</Text>
            <PrimaryButton label={zhTW.diary.addFood} onPress={() => router.push('/food/add')} />
          </View>
        ) : (
          <>
            <CalorieTrendChart
              points={foodPoints}
              goalKcal={foodGoalKcal}
              locale={foodLocale}
              emptyLabel={zhTW.stats.noFood}
              accessibilityLabel={zhTW.stats.food7d}
            />
            {foodAvg ? <Text style={styles.meta}>{foodAvg}</Text> : null}
            <View style={styles.detailLinks}>
              <PrimaryButton label={zhTW.progressDetail.calories} onPress={() => router.push('/progress/calories' as never)} />
              <PrimaryButton label={zhTW.progressDetail.macros} onPress={() => router.push('/progress/macros' as never)} />
            </View>
          </>
        )}
      </MfpCard>

      <MfpCard>
        <Text style={styles.blockTitle}>{zhTW.habits.title}</Text>
        <View style={styles.habitRow}>
          <Stat label={zhTW.habits.water} value={`${habitStats.waterGoalDays}/7`} />
          <Stat label={zhTW.habits.exercise} value={`${habitStats.exerciseMinutes} min`} />
          <Stat label={zhTW.habits.steps} value={habitStats.stepDays ? habitStats.stepsAverage.toLocaleString() : '—'} />
        </View>
      </MfpCard>

      <MfpCard>
        <Text style={styles.blockTitle}>{zhTW.stats.weight30d}</Text>
        {weightDailyEmpty ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.empty}>{zhTW.stats.noWeight}</Text>
            <PrimaryButton label={zhTW.weight.add} onPress={() => router.push('/weight')} />
          </View>
        ) : (
          <WeightDailyChart
            points={weightDailyPoints}
            emptyLabel={zhTW.stats.noWeight}
            accessibilityLabel={zhTW.stats.weight30d}
          />
        )}

        <Text style={[styles.blockTitle, styles.blockTitleSpaced]}>{zhTW.stats.weightWeekly12}</Text>
        {weightWeeklyEmpty ? (
          <Text style={styles.empty}>{zhTW.stats.noWeight}</Text>
        ) : (
          <WeightWeeklyChart
            points={weightWeeklyPoints}
            emptyLabel={zhTW.stats.noWeight}
            accessibilityLabel={zhTW.stats.weightWeekly12}
          />
        )}
        {weightChange ? <Text style={styles.meta}>{weightChange}</Text> : null}
      </MfpCard>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.habitStat}>
      <Text style={styles.habitValue}>{value}</Text>
      <Text style={styles.habitLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md, paddingBottom: theme.space.xl },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space.md,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateBtn: {
    minWidth: theme.minTouch,
    minHeight: theme.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnText: { fontSize: 28, color: theme.colors.lakeBlue, fontWeight: '700' },
  dateText: { flex: 1, textAlign: 'center', fontWeight: '600', color: theme.colors.text },
  blockTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: theme.space.sm,
    color: theme.colors.textMuted,
  },
  blockTitleSpaced: { marginTop: theme.space.lg },
  meta: {
    color: theme.colors.textMuted,
    marginVertical: theme.space.sm,
    lineHeight: 20,
    fontSize: theme.font.bodySmall,
  },
  emptyBlock: { gap: theme.space.md, marginBottom: theme.space.sm },
  empty: { color: theme.colors.textMuted, textAlign: 'center' },
  detailLinks: { gap: theme.space.sm, marginTop: theme.space.sm },
  habitRow: { flexDirection: 'row' },
  habitStat: { flex: 1, alignItems: 'center' },
  habitValue: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
  habitLabel: { color: theme.colors.textMuted, fontSize: theme.font.bodySmall, marginTop: 4 },
});
