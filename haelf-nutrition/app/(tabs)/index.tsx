import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import {
  deleteFoodEntries,
  deleteFoodEntry,
  listFoodEntriesByDate,
} from '@/src/db/repositories/food';
import type { FoodEntry, MealType } from '@/src/domain/types';
import { theme } from '@/src/theme';
import { DailyNutritionHero } from '@/src/components/nutrition/DailyNutritionHero';
import { MealSection } from '@/src/components/mfp/MealSection';
import { WeekDateStrip } from '@/src/components/today/WeekDateStrip';
import { HealthyHabits } from '@/src/components/today/HealthyHabits';
import { useDiaryDay } from '@/src/hooks/useDiaryDay';
import { displayWeightKg } from '@/src/domain/nutrition';
import { MfpCard } from '@/src/components/ui';
import { addLocalDays } from '@/src/domain/dates';
import { copyMealEntries } from '@/src/services/copyMeal';
import { chooseAction, confirmDialog } from '@/src/services/dialog';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function DiaryScreen() {
  const {
    selectedDate,
    setSelectedDate,
    todayLocalDate,
    viewingHistory,
    goToToday,
    refreshToken,
    bumpRefresh,
    preferences,
    t,
  } = useApp();
  const router = useRouter();
  const { entries, summary, latestWeight, streak, deficit, reload } = useDiaryDay(
    selectedDate,
    refreshToken
  );

  const grouped = useMemo(() => {
    const map: Record<MealType, FoodEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const e of entries) map[e.mealType].push(e);
    return map;
  }, [entries]);

  const goal = summary?.goal
    ? {
        kcal: summary.goal.kcal,
        proteinG: summary.goal.proteinG,
        fatG: summary.goal.fatG,
        carbsG: summary.goal.carbsG,
      }
    : null;

  const onDelete = async (entry: FoodEntry) => {
    const confirmed = await confirmDialog(
      t('diary.deleteConfirmTitle'),
      t('diary.deleteConfirmMessage'),
      { cancel: t('common.cancel'), confirm: t('common.delete') }
    );
    if (!confirmed) return;
    await deleteFoodEntry(entry.id);
    bumpRefresh();
    void reload();
  };

  const onMealMenu = async (meal: MealType) => {
    const mealEntries = grouped[meal];
    const actions = [
      { label: t('copy.yesterday') },
      { label: t('copy.toDateMeal') },
      { label: t('copy.saveAsMeal') },
      ...(mealEntries.length
        ? [{ label: t('copy.deleteMeal'), destructive: true }]
        : []),
    ];
    const action = await chooseAction(t(`meal.${meal}`), actions, t('common.cancel'));
    if (action === 0) {
      const yesterday = await listFoodEntriesByDate(addLocalDays(selectedDate, -1));
      const source = yesterday.filter((entry) => entry.mealType === meal);
      await copyMealEntries(source.map((entry) => entry.id), {
        targetDate: selectedDate,
        targetMeal: meal,
      });
      bumpRefresh();
    } else if (action === 1) {
      router.push(`/diary/copy?sourceDate=${selectedDate}&sourceMeal=${meal}` as never);
    } else if (action === 2) {
      router.push(`/library/meal/new?date=${selectedDate}&meal=${meal}` as never);
    } else if (action === 3) {
      await deleteFoodEntries(mealEntries.map((entry) => entry.id));
      bumpRefresh();
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <WeekDateStrip
          selectedDate={selectedDate}
          todayDate={todayLocalDate}
          weekStart={1}
          locale={preferences.locale}
          onSelect={setSelectedDate}
        />
        <View style={styles.dayHeading}>
          <View>
            <Text style={styles.dateText} accessibilityRole="header">{selectedDate}</Text>
            <Text style={styles.streak}>🔥 {streak} {t('diary.streak')}</Text>
          </View>
          {viewingHistory ? (
            <Pressable onPress={goToToday} accessibilityRole="button">
              <Text style={styles.todayLink}>{t('common.today')}</Text>
            </Pressable>
          ) : null}
        </View>

        <DailyNutritionHero
          consumed={summary?.food ?? { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }}
          goal={goal}
          exerciseKcal={summary?.exerciseKcal ?? 0}
        />

        {deficit ? (
          <Text style={styles.deficitLine} accessibilityRole="text">
            {deficit.deficitKcal > 0
              ? `${t('diary.deficitLabel')} ${Math.abs(deficit.deficitKcal).toLocaleString('zh-TW')} kcal（${t('diary.deficitKg', { kg: Math.abs(deficit.approxKgLost).toFixed(2) })}）`
              : deficit.deficitKcal < 0
                ? `${t('diary.surplusLabel')} ${Math.abs(deficit.deficitKcal).toLocaleString('zh-TW')} kcal（${t('diary.surplusKg', { kg: Math.abs(deficit.approxKgLost).toFixed(2) })}）`
                : `${t('diary.balanceNeutral')}（0 kg）`}
          </Text>
        ) : (
          <Text style={styles.deficitHint}>{t('diary.deficitNeedTdee')}</Text>
        )}

        <View style={styles.quickLinks}>
          <Pressable
            onPress={() => router.push('/food/log' as never)}
            style={styles.quickLink}
            accessibilityRole="button"
          >
            <Text style={styles.quickLinkText}>{t('foodHub.title')}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/food/ai')}
            style={styles.quickLink}
            accessibilityRole="button"
          >
            <Text style={styles.quickLinkText}>{t('diary.ai')}</Text>
          </Pressable>
        </View>

        {MEAL_ORDER.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={grouped[meal]}
            onAdd={() => router.push(`/food/log?meal=${meal}` as never)}
            onEdit={(e) => router.push(`/food/edit/${e.id}`)}
            onDelete={(entry) => void onDelete(entry)}
            onMenu={() => void onMealMenu(meal)}
          />
        ))}

        {summary ? (
          <HealthyHabits
            summary={summary}
            onWater={() => router.push('/water' as never)}
            onExercise={() => router.push('/exercise' as never)}
            onSteps={() => router.push('/steps' as never)}
          />
        ) : null}

        <View style={styles.bottomCards}>
          <MfpCard>
            <Pressable onPress={() => router.push('/weight')} accessibilityRole="button">
              <Text style={styles.cardTitle}>{t('weight.title')}</Text>
              <Text style={styles.cardValue}>
                {latestWeight ? `${displayWeightKg(latestWeight.kg)} kg` : t('common.notRecorded')}
              </Text>
            </Pressable>
          </MfpCard>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingBottom: theme.space.xl },
  dayHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.sm,
  },
  dateText: {
    fontSize: theme.font.section,
    fontWeight: '700',
    color: theme.colors.text,
  },
  todayLink: { color: theme.colors.lakeBlue, marginTop: 4, fontWeight: '600' },
  streak: { color: theme.colors.textMuted, marginTop: 2, fontSize: theme.font.bodySmall },
  deficitLine: {
    textAlign: 'center',
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.sm,
    color: theme.colors.lakeBlue,
    fontWeight: '600',
    fontSize: theme.font.body,
    lineHeight: 22,
  },
  deficitHint: {
    textAlign: 'center',
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.sm,
    color: theme.colors.textMuted,
    fontSize: theme.font.bodySmall,
  },
  quickLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  quickLink: { minHeight: theme.minTouch, justifyContent: 'center' },
  quickLinkText: { color: theme.colors.lakeBlue, fontWeight: '600', fontSize: 14 },
  bottomCards: { padding: theme.space.md, backgroundColor: theme.colors.surface },
  cardTitle: { color: theme.colors.textMuted, fontWeight: '600' },
  cardValue: { color: theme.colors.text, fontSize: 24, fontWeight: '700', marginTop: theme.space.xs },
});
