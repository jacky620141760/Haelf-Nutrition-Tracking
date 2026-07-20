import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import {
  deleteFoodEntry,
  listFoodEntriesByDate,
} from '@/src/db/repositories/food';
import { listGoalVersions } from '@/src/db/repositories/goals';
import { resolveGoalForDate } from '@/src/domain/goals';
import { displayNutrients, sumNutrients } from '@/src/domain/nutrition';
import { addLocalDays } from '@/src/domain/dates';
import type { FoodEntry, MealType } from '@/src/domain/types';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';
import { PrimaryButton } from '@/src/components/ui';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function TodayScreen() {
  const {
    selectedDate,
    setSelectedDate,
    todayLocalDate,
    viewingHistory,
    goToToday,
    refreshToken,
    bumpRefresh,
  } = useApp();
  const router = useRouter();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goalLabel, setGoalLabel] = useState<string>(zhTW.common.notSet);

  const load = useCallback(async () => {
    const list = await listFoodEntriesByDate(selectedDate);
    setEntries(list);
    const versions = await listGoalVersions();
    const g = resolveGoalForDate(versions, selectedDate);
    if (!g) setGoalLabel(zhTW.common.notSet);
    else {
      const d = displayNutrients({
        kcal: g.kcal,
        protein_g: g.proteinG,
        fat_g: g.fatG,
        carbs_g: g.carbsG,
      });
      setGoalLabel(`${d.kcal} kcal · P${d.protein_g} F${d.fat_g} C${d.carbs_g}`);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, refreshToken])
  );

  useEffect(() => {
    load();
  }, [load, refreshToken]);

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

  const totals = useMemo(() => {
    const raw = sumNutrients(
      entries.map((e) => ({
        kcal: e.snapKcal,
        protein_g: e.snapProteinG,
        fat_g: e.snapFatG,
        carbs_g: e.snapCarbsG,
      }))
    );
    return displayNutrients(raw);
  }, [entries]);

  const onDelete = (entry: FoodEntry) => {
    Alert.alert(zhTW.diary.deleteConfirmTitle, zhTW.diary.deleteConfirmMessage, [
      { text: zhTW.common.cancel, style: 'cancel' },
      {
        text: zhTW.common.delete,
        style: 'destructive',
        onPress: async () => {
          await deleteFoodEntry(entry.id);
          bumpRefresh();
          load();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.dateRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="前一日"
          style={styles.dateBtn}
          onPress={() => setSelectedDate(addLocalDays(selectedDate, -1))}
        >
          <Text style={styles.dateBtnText}>‹</Text>
        </Pressable>
        <View style={styles.dateCenter}>
          <Text style={styles.dateText} accessibilityRole="header">
            {selectedDate}
          </Text>
          {viewingHistory ? (
            <Pressable onPress={goToToday} accessibilityRole="button" accessibilityLabel={zhTW.common.today}>
              <Text style={styles.todayLink}>{zhTW.common.today}</Text>
            </Pressable>
          ) : (
            <Text style={styles.todayHint}>{todayLocalDate === selectedDate ? '今日' : ''}</Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="後一日"
          style={styles.dateBtn}
          onPress={() => setSelectedDate(addLocalDays(selectedDate, 1))}
        >
          <Text style={styles.dateBtnText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.summary} accessibilityLabel={`${zhTW.diary.total} ${totals.kcal} kcal`}>
        <Text style={styles.summaryTitle}>
          {zhTW.diary.total}：{totals.kcal} kcal
        </Text>
        <Text style={styles.summarySub}>
          P {totals.protein_g} · F {totals.fat_g} · C {totals.carbs_g}
        </Text>
        <Text style={styles.goal}>
          {zhTW.diary.goal}：{goalLabel}
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label={zhTW.diary.manual} onPress={() => router.push('/food/add')} />
        <PrimaryButton label={zhTW.diary.barcode} onPress={() => router.push('/food/scan')} />
        <PrimaryButton label={zhTW.diary.ai} onPress={() => router.push('/food/ai')} />
      </View>

      {entries.length === 0 ? (
        <Text style={styles.empty}>{zhTW.diary.empty}</Text>
      ) : (
        MEAL_ORDER.map((meal) => {
          const list = grouped[meal];
          if (!list.length) return null;
          return (
            <View key={meal} style={styles.section}>
              <View style={[styles.mealHeader, { borderLeftColor: theme.colors.mealAccent[meal] }]}>
                <Text style={styles.mealTitle}>{zhTW.meal[meal]}</Text>
                <Text style={styles.mealShape}>◆</Text>
              </View>
              {list.map((e) => {
                const d = displayNutrients({
                  kcal: e.snapKcal,
                  protein_g: e.snapProteinG,
                  fat_g: e.snapFatG,
                  carbs_g: e.snapCarbsG,
                });
                return (
                  <Pressable
                    key={e.id}
                    style={styles.entry}
                    onPress={() => router.push(`/food/edit/${e.id}`)}
                    onLongPress={() => onDelete(e)}
                    accessibilityRole="button"
                    accessibilityLabel={`${e.name} ${d.kcal} 千卡`}
                    accessibilityHint="點擊編輯，長按刪除"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryName}>{e.name}</Text>
                      <Text style={styles.entryMeta}>
                        {d.kcal} kcal · P{d.protein_g} F{d.fat_g} C{d.carbs_g}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onDelete(e)}
                      accessibilityRole="button"
                      accessibilityLabel={`${zhTW.common.delete} ${e.name}`}
                      style={styles.deleteHit}
                    >
                      <Text style={styles.deleteText}>{zhTW.common.delete}</Text>
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          );
        })
      )}

      <Link href="/food/add?tab=favorites" asChild>
        <Pressable style={styles.linkBtn} accessibilityRole="button">
          <Text style={styles.linkText}>{zhTW.diary.favorites} / {zhTW.diary.recent}</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md, paddingBottom: theme.space.xl },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space.md,
  },
  dateBtn: {
    minWidth: theme.minTouch,
    minHeight: theme.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnText: { fontSize: 28, color: theme.colors.accent, fontWeight: '700' },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateText: { fontSize: theme.font.title, fontWeight: '700', color: theme.colors.text },
  todayLink: { color: theme.colors.accent, marginTop: 4, fontWeight: '600' },
  todayHint: { color: theme.colors.textMuted, marginTop: 4 },
  summary: {
    backgroundColor: theme.colors.accentSoft,
    padding: theme.space.md,
    borderRadius: theme.radius,
    marginBottom: theme.space.md,
  },
  summaryTitle: { fontSize: theme.font.body, fontWeight: '700', color: theme.colors.text },
  summarySub: { color: theme.colors.textMuted, marginTop: 4 },
  goal: { marginTop: 8, color: theme.colors.text },
  actions: { gap: theme.space.sm, marginBottom: theme.space.lg },
  empty: { textAlign: 'center', color: theme.colors.textMuted, marginVertical: theme.space.lg },
  section: { marginBottom: theme.space.lg },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    paddingLeft: theme.space.sm,
    marginBottom: theme.space.sm,
    gap: theme.space.sm,
  },
  mealTitle: { fontSize: theme.font.body, fontWeight: '700' },
  mealShape: { color: theme.colors.textMuted },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    padding: theme.space.md,
    marginBottom: theme.space.sm,
    minHeight: theme.minTouch,
  },
  entryName: { fontWeight: '600', color: theme.colors.text },
  entryMeta: { color: theme.colors.textMuted, marginTop: 2, fontSize: theme.font.small },
  deleteHit: { minWidth: theme.minTouch, minHeight: theme.minTouch, justifyContent: 'center' },
  deleteText: { color: theme.colors.danger, fontWeight: '600' },
  linkBtn: {
    minHeight: theme.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { color: theme.colors.accent, fontWeight: '600' },
});
