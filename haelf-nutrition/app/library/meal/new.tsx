import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import { listFoodEntriesByDate } from '@/src/db/repositories/food';
import type { FoodEntry, MealType } from '@/src/domain/types';
import { saveMealFromDiary } from '@/src/services/saveMealFromDiary';
import { Field, MfpButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function NewSavedMealScreen() {
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const router = useRouter();
  const { selectedDate, bumpRefresh, t } = useApp();
  const date = params.date ?? selectedDate;
  const meal = params.meal as MealType | undefined;
  const [name, setName] = useState('');
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    void listFoodEntriesByDate(date).then((items) => {
      setEntries(items);
      setSelected(new Set(items.filter((item) => !meal || item.mealType === meal).map((item) => item.id)));
    });
  }, [date, meal]);

  const save = async () => {
    try {
      await saveMealFromDiary(name, entries.filter((entry) => selected.has(entry.id)));
      bumpRefresh();
      router.back();
    } catch (error) {
      Alert.alert(error instanceof Error ? error.message : t('validation.outOfRange'));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={t('library.createMeal')} />
      <Field label={t('savedMeal.name')} value={name} onChangeText={setName} />
      <Text style={styles.date}>{date}</Text>
      {entries.map((entry) => {
        const checked = selected.has(entry.id);
        return (
          <Pressable
            key={entry.id}
            style={styles.row}
            onPress={() =>
              setSelected((current) => {
                const next = new Set(current);
                if (checked) next.delete(entry.id);
                else next.add(entry.id);
                return next;
              })
            }
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            <Text style={styles.check}>{checked ? '☑' : '☐'}</Text>
            <Text style={styles.name}>{entry.name}</Text>
            <Text style={styles.kcal}>{Math.round(entry.snapKcal)} kcal</Text>
          </Pressable>
        );
      })}
      <MfpButton label={t('common.save')} onPress={() => void save()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md },
  date: { color: theme.colors.textMuted, marginBottom: theme.space.sm },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  check: { fontSize: 20, marginRight: theme.space.sm },
  name: { flex: 1, color: theme.colors.text, fontWeight: '600' },
  kcal: { color: theme.colors.textMuted },
});
