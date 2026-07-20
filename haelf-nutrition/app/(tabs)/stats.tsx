import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import { listFoodEntriesInDateRange } from '@/src/db/repositories/food';
import { listGoalVersions } from '@/src/db/repositories/goals';
import { listWeightsInRange, pickDailyLastWeights } from '@/src/db/repositories/weight';
import { localDateRangeEnding, addLocalDays } from '@/src/domain/dates';
import { resolveGoalForDate, diffVsGoal, goalToNutrients } from '@/src/domain/goals';
import { displayNutrients, displayWeightKg, sumNutrients } from '@/src/domain/nutrition';
import { SimpleBarChart, SimpleLineChart } from '@/src/components/Charts';
import { PrimaryButton, SectionTitle } from '@/src/components/ui';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

type WeightRange = 7 | 30;

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

  const load = useCallback(async () => {
    const foodDays = localDateRangeEnding(endDate, 7);
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
      if (!list?.length) return { label: d, value: null as number | null, goal: null };
      const sum = sumNutrients(
        list.map((e) => ({
          kcal: e.snapKcal,
          protein_g: e.snapProteinG,
          fat_g: e.snapFatG,
          carbs_g: e.snapCarbsG,
        }))
      );
      const g = resolveGoalForDate(goals, d);
      return {
        label: d,
        value: displayNutrients(sum).kcal,
        goal: g ? displayNutrients(goalToNutrients(g)).kcal : null,
      };
    });
    setFoodBars(bars);
    const recorded = bars.filter((b) => b.value != null);
    setFoodEmpty(recorded.length === 0);
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
      let avgText = `${zhTW.stats.average}：${avg.kcal} kcal · P${avg.protein_g} F${avg.fat_g} C${avg.carbs_g}（${zhTW.stats.recordedDays} ${recorded.length}）`;
      const lastDay = foodDays[foodDays.length - 1];
      const lastList = byDate.get(lastDay);
      const lastGoal = resolveGoalForDate(goals, lastDay);
      if (lastList?.length && lastGoal) {
        const intake = sumNutrients(
          lastList.map((e) => ({
            kcal: e.snapKcal,
            protein_g: e.snapProteinG,
            fat_g: e.snapFatG,
            carbs_g: e.snapCarbsG,
          }))
        );
        const diff = displayNutrients(diffVsGoal(intake, goalToNutrients(lastGoal)));
        avgText += `\n${zhTW.stats.vsGoal}（${lastDay}）：${diff.kcal} kcal · P${diff.protein_g} F${diff.fat_g} C${diff.carbs_g}`;
      }
      setFoodAvg(avgText);
    } else {
      setFoodAvg('');
    }

    const wDays = localDateRangeEnding(endDate, weightRange);
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
  }, [endDate, weightRange]);

  useFocusEffect(
    useCallback(() => {
      setEndDate(selectedDate);
      load();
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
        </>
      )}

      <View style={styles.weightTabs}>
        <Pressable
          onPress={() => setWeightRange(7)}
          style={[styles.tab, weightRange === 7 && styles.tabOn]}
          accessibilityRole="tab"
          accessibilityState={{ selected: weightRange === 7 }}
          accessibilityLabel={zhTW.stats.weight7d}
        >
          <Text style={styles.tabText}>{zhTW.stats.weight7d}</Text>
        </Pressable>
        <Pressable
          onPress={() => setWeightRange(30)}
          style={[styles.tab, weightRange === 30 && styles.tabOn]}
          accessibilityRole="tab"
          accessibilityState={{ selected: weightRange === 30 }}
          accessibilityLabel={zhTW.stats.weight30d}
        >
          <Text style={styles.tabText}>{zhTW.stats.weight30d}</Text>
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
            accessibilityLabel={weightRange === 7 ? zhTW.stats.weight7d : zhTW.stats.weight30d}
          />
          {weightChange ? <Text style={styles.meta}>{weightChange}</Text> : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md, paddingBottom: theme.space.xl },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space.lg,
  },
  dateBtn: {
    minWidth: theme.minTouch,
    minHeight: theme.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnText: { fontSize: 28, color: theme.colors.accent, fontWeight: '700' },
  dateText: { flex: 1, textAlign: 'center', fontWeight: '600' },
  blockTitle: {
    fontSize: theme.font.body,
    fontWeight: '700',
    marginBottom: theme.space.sm,
    color: theme.colors.text,
  },
  meta: {
    color: theme.colors.textMuted,
    marginVertical: theme.space.sm,
    lineHeight: 20,
  },
  emptyBlock: { gap: theme.space.md, marginBottom: theme.space.lg },
  empty: { color: theme.colors.textMuted, textAlign: 'center' },
  weightTabs: { flexDirection: 'row', gap: theme.space.sm, marginVertical: theme.space.md },
  tab: {
    flex: 1,
    minHeight: theme.minTouch,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: theme.colors.accentSoft },
  tabText: { fontWeight: '600', color: theme.colors.text },
});
