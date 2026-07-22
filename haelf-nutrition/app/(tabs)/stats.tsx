import { useCallback, useEffect, useState } from 'react';
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
import { localDateRangeEnding, addLocalDays } from '@/src/domain/dates';
import { resolveGoalForDate, diffVsGoal, goalToNutrients } from '@/src/domain/goals';
import { displayNutrients, displayWeightKg, sumNutrients } from '@/src/domain/nutrition';
import { resolveWaterGoalForDate } from '@/src/domain/water';
import { totalExerciseMinutes } from '@/src/domain/exercise';
import { SimpleBarChart, SimpleLineChart } from '@/src/components/Charts';
import { PrimaryButton, SectionTitle, MfpCard } from '@/src/components/ui';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

type WeightRange = 7 | 30 | 90;

export default function StatsScreen() {
  const { selectedDate, setSelectedDate, refreshToken } = useApp();
  const router = useRouter();
  const [endDate, setEndDate] = useState(selectedDate);
  const [weightRange, setWeightRange] = useState<WeightRange>(7);
  const [foodBars, setFoodBars] = useState<
    { label: string; value: number | null; goal?: number | null }[]
  >([]);
  const [foodAvg, setFoodAvg] = useState<string>('');
  const [foodEmpty, setFoodEmpty] = useState(false);
  const [weightPoints, setWeightPoints] = useState<{ label: string; value: number | null }[]>([]);
  const [weightChange, setWeightChange] = useState('');
  const [weightEmpty, setWeightEmpty] = useState(false);
  const [habitStats, setHabitStats] = useState({
    waterGoalDays: 0,
    exerciseMinutes: 0,
    stepsAverage: 0,
    stepDays: 0,
  });

  const load = useCallback(async (targetEndDate: string) => {
    const foodDays = localDateRangeEnding(targetEndDate, 7);
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
        return {
          label: d,
          value: g ? 0 : null,
          goal: g ? displayNutrients(goalToNutrients(g)).kcal : null,
        };
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
        goal: g ? displayNutrients(goalToNutrients(g)).kcal : null,
      };
    });
    setFoodBars(bars);
    const recordedDays = foodDays.filter((date) => (byDate.get(date)?.length ?? 0) > 0);
    setFoodEmpty(bars.every((bar) => bar.value == null && bar.goal == null));
    let avgText = '';
    const recorded = bars.filter((bar) => recordedDays.includes(bar.label));
    if (recorded.length) {
      const rawDays = foodDays
        .map((d) => {
          const list = byDate.get(d);
          if (!list?.length) return null;
          return sumNutrients(
            list.map((e) => ({
              kcal: e.snapKcal,
              protein_g: e.snapProteinG,
              fat_g: e.snapFatG,
              carbs_g: e.snapCarbsG,
            }))
          );
        })
        .filter(Boolean) as {
        kcal: number;
        protein_g: number;
        fat_g: number;
        carbs_g: number;
      }[];
      const avgRaw = sumNutrients(rawDays);
      avgRaw.kcal /= rawDays.length;
      avgRaw.protein_g /= rawDays.length;
      avgRaw.fat_g /= rawDays.length;
      avgRaw.carbs_g /= rawDays.length;
      const avg = displayNutrients(avgRaw);
      avgText = `${zhTW.stats.average}：${avg.kcal} kcal · P${avg.protein_g} F${avg.fat_g} C${avg.carbs_g}（${zhTW.stats.recordedDays} ${recorded.length}）`;
    }

    const goalLines = foodDays.flatMap((date) => {
      const goal = resolveGoalForDate(goals, date);
      if (!goal) return [];
      const list = byDate.get(date) ?? [];
      const intake = sumNutrients(
        list.map((entry) => ({
          kcal: entry.snapKcal,
          protein_g: entry.snapProteinG,
          fat_g: entry.snapFatG,
          carbs_g: entry.snapCarbsG,
        }))
      );
      const shownIntake = displayNutrients(intake);
      const shownGoal = displayNutrients(goalToNutrients(goal));
      const diff = displayNutrients(diffVsGoal(intake, goalToNutrients(goal)));
      return [
        `${date}：攝取 ${shownIntake.kcal}／目標 ${shownGoal.kcal}／差值 ${diff.kcal} kcal`,
      ];
    });
    setFoodAvg([avgText, ...goalLines].filter(Boolean).join('\n'));

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

    const wDays = localDateRangeEnding(targetEndDate, weightRange);
    const weights = await listWeightsInRange(wDays[0], wDays[wDays.length - 1]);
    const lastMap = pickDailyLastWeights(weights);
    const pts = wDays.map((d) => {
      const w = lastMap.get(d);
      return { label: d, value: w ? w.kg : null };
    });
    setWeightPoints(pts);
    const present = pts.filter((p) => p.value != null);
    setWeightEmpty(present.length === 0);
    if (present.length >= 2) {
      const first = present[0].value as number;
      const last = present[present.length - 1].value as number;
      const delta = last - first;
      setWeightChange(
        `${zhTW.weight.change}：${delta >= 0 ? '+' : ''}${displayWeightKg(delta)} kg`
      );
    } else if (present.length === 1) {
      setWeightChange(`${zhTW.weight.change}：${zhTW.weight.insufficient}`);
    } else {
      setWeightChange('');
    }
  }, [weightRange]);

  useFocusEffect(
    useCallback(() => {
      const targetEndDate = selectedDate;
      setEndDate(targetEndDate);
      void load(targetEndDate);
    }, [load, selectedDate, refreshToken])
  );

  // Tab switches must reload even while the screen stays focused.
  useEffect(() => {
    void load(endDate);
  }, [weightRange]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally range-only

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
            <SimpleBarChart
              points={foodBars}
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
        <View style={styles.weightTabs}>
          <Pressable
            onPress={() => setWeightRange(7)}
            style={[styles.tab, weightRange === 7 && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: weightRange === 7 }}
            accessibilityLabel={zhTW.stats.weight7d}
          >
            <Text style={[styles.tabText, weightRange === 7 && styles.tabTextOn]}>
              {zhTW.stats.weight7d}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setWeightRange(90)}
            style={[styles.tab, weightRange === 90 && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: weightRange === 90 }}
            accessibilityLabel={zhTW.stats.weight90d}
          >
            <Text style={[styles.tabText, weightRange === 90 && styles.tabTextOn]}>
              {zhTW.stats.weight90d}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setWeightRange(30)}
            style={[styles.tab, weightRange === 30 && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: weightRange === 30 }}
            accessibilityLabel={zhTW.stats.weight30d}
          >
            <Text style={[styles.tabText, weightRange === 30 && styles.tabTextOn]}>
              {zhTW.stats.weight30d}
            </Text>
          </Pressable>
        </View>

        {weightEmpty ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.empty}>{zhTW.stats.noWeight}</Text>
            <PrimaryButton label={zhTW.weight.add} onPress={() => router.push('/weight')} />
          </View>
        ) : (
          <>
            <SimpleLineChart
              points={weightPoints}
              emptyLabel={zhTW.stats.noWeight}
              accessibilityLabel={
                weightRange === 7
                  ? zhTW.stats.weight7d
                  : weightRange === 30
                    ? zhTW.stats.weight30d
                    : zhTW.stats.weight90d
              }
            />
            {weightChange ? <Text style={styles.meta}>{weightChange}</Text> : null}
          </>
        )}
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
  meta: {
    color: theme.colors.textMuted,
    marginVertical: theme.space.sm,
    lineHeight: 20,
    fontSize: theme.font.bodySmall,
  },
  emptyBlock: { gap: theme.space.md, marginBottom: theme.space.sm },
  empty: { color: theme.colors.textMuted, textAlign: 'center' },
  weightTabs: { flexDirection: 'row', gap: theme.space.sm, marginBottom: theme.space.md },
  tab: {
    flex: 1,
    minHeight: theme.minTouch,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  tabOn: {
    backgroundColor: theme.colors.skyBlue,
    borderColor: theme.colors.lakeBlue,
  },
  tabText: { fontWeight: '600', color: theme.colors.textMuted },
  tabTextOn: { color: theme.colors.lakeBlue },
  detailLinks: { gap: theme.space.sm, marginTop: theme.space.sm },
  habitRow: { flexDirection: 'row' },
  habitStat: { flex: 1, alignItems: 'center' },
  habitValue: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
  habitLabel: { color: theme.colors.textMuted, fontSize: theme.font.bodySmall, marginTop: 4 },
});
