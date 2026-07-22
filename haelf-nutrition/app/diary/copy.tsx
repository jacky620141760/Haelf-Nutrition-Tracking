import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { FoodEntry, MealType } from '@/src/domain/types';
import { listFoodEntriesByDate } from '@/src/db/repositories/food';
import { copyMealEntries } from '@/src/services/copyMeal';
import { MealPicker } from '@/src/components/Pickers';
import { Field, MfpButton, SectionTitle } from '@/src/components/ui';
import { useApp } from '@/src/context/AppContext';
import { theme } from '@/src/theme';

export default function CopyMealScreen() {
  const params = useLocalSearchParams<{ sourceDate: string; sourceMeal: MealType }>();
  const router = useRouter();
  const { selectedDate, bumpRefresh, t } = useApp();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetDate, setTargetDate] = useState(selectedDate);
  const [targetMeal, setTargetMeal] = useState<MealType>(params.sourceMeal ?? 'snack');
  useEffect(() => {
    void listFoodEntriesByDate(params.sourceDate).then((items) => {
      const mealItems = items.filter((item) => item.mealType === params.sourceMeal);
      setEntries(mealItems);
      setSelected(new Set(mealItems.map((item) => item.id)));
    });
  }, [params.sourceDate, params.sourceMeal]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={t('copy.title')} />
      {entries.map((entry) => {
        const checked = selected.has(entry.id);
        return (
          <Pressable key={entry.id} style={styles.row} onPress={() => setSelected((current) => {
            const next = new Set(current);
            if (checked) next.delete(entry.id); else next.add(entry.id);
            return next;
          })} accessibilityRole="checkbox" accessibilityState={{ checked }}>
            <Text style={styles.check}>{checked ? '☑' : '☐'}</Text>
            <Text style={styles.name}>{entry.name}</Text>
            <Text style={styles.meta}>{Math.round(entry.snapKcal)} kcal</Text>
          </Pressable>
        );
      })}
      <Field label={t('copy.targetDate')} value={targetDate} onChangeText={setTargetDate} />
      <MealPicker value={targetMeal} onChange={setTargetMeal} />
      <MfpButton label={t('copy.selected')} onPress={async () => {
        try {
          await copyMealEntries([...selected], { targetDate, targetMeal });
          bumpRefresh();
          router.replace('/');
        } catch (error) {
          Alert.alert(error instanceof Error ? error.message : t('validation.outOfRange'));
        }
      }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  check: { fontSize: 20, marginRight: theme.space.sm },
  name: { flex: 1, color: theme.colors.text, fontWeight: '600' },
  meta: { color: theme.colors.textMuted },
});
