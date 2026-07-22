import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { MealType, SavedMeal } from '@/src/domain/types';
import {
  deleteSavedMeal,
  getSavedMeal,
  saveSavedMeal,
} from '@/src/db/repositories/savedMeals';
import { applySavedMeal } from '@/src/services/applySavedMeal';
import { useApp } from '@/src/context/AppContext';
import { MealPicker } from '@/src/components/Pickers';
import { Field, MfpButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function SavedMealDetailScreen() {
  const params = useLocalSearchParams<{ id: string; meal?: string }>();
  const router = useRouter();
  const { selectedDate, bumpRefresh, t } = useApp();
  const [savedMeal, setSavedMeal] = useState<SavedMeal | null>(null);
  const [name, setName] = useState('');
  const [meal, setMeal] = useState<MealType>(
    ['breakfast', 'lunch', 'dinner', 'snack'].includes(params.meal ?? '')
      ? (params.meal as MealType)
      : 'snack'
  );

  useEffect(() => {
    void getSavedMeal(Number(params.id)).then((value) => {
      setSavedMeal(value);
      setName(value?.name ?? '');
    });
  }, [params.id]);

  if (!savedMeal) return <View style={styles.center}><Text>{t('common.loading')}</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={savedMeal.name} />
      <Field label={t('savedMeal.name')} value={name} onChangeText={setName} />
      <MfpButton
        label={t('common.save')}
        variant="outline"
        onPress={async () => {
          await saveSavedMeal({ name, photoUri: savedMeal.photoUri, items: savedMeal.items.map(({ id: _id, savedMealId: _parent, ...item }) => item) }, savedMeal.id);
          bumpRefresh();
          setSavedMeal(await getSavedMeal(savedMeal.id));
        }}
      />
      <View style={{ height: theme.space.md }} />
      {savedMeal.items.map((item) => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>{item.defaultQuantity} · {item.sourceKcal} kcal</Text>
        </View>
      ))}
      <Text style={styles.label}>{t('food.mealType')}</Text>
      <MealPicker value={meal} onChange={setMeal} />
      <MfpButton
        label={t('library.log')}
        onPress={async () => {
          const result = await applySavedMeal(savedMeal.id, { localDate: selectedDate, mealType: meal });
          if (!result.ok) Alert.alert(result.errors.join('\n'));
          else {
            bumpRefresh();
            router.replace('/');
          }
        }}
      />
      <View style={{ height: theme.space.sm }} />
      <MfpButton
        label={t('common.delete')}
        danger
        onPress={async () => {
          await deleteSavedMeal(savedMeal.id);
          bumpRefresh();
          router.back();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { paddingVertical: theme.space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  name: { color: theme.colors.text, fontWeight: '700' },
  meta: { color: theme.colors.textMuted, marginTop: 3 },
  label: { color: theme.colors.textMuted, marginTop: theme.space.md, marginBottom: theme.space.xs },
});
