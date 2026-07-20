import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import { getFoodEntry, deleteFoodEntry } from '@/src/db/repositories/food';
import type { FoodDraft, MealType, NutritionBasis } from '@/src/domain/types';
import { getTimeZoneMetadata, toLocalDateString } from '@/src/domain/dates';
import { parseFiniteNumber, validateFoodDraft } from '@/src/domain/validation';
import { collectDataQualityWarnings } from '@/src/domain/quality';
import { confirmFoodDraft } from '@/src/services/confirmFood';
import { BasisPicker, MealPicker } from '@/src/components/Pickers';
import { Field, PrimaryButton } from '@/src/components/ui';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

export default function EditFoodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bumpRefresh } = useApp();
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<FoodDraft | null>(null);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [qty, setQty] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [entryLocalDate, setEntryLocalDate] = useState('');

  useEffect(() => {
    (async () => {
      const entry = await getFoodEntry(Number(id));
      if (!entry) {
        Alert.alert('找不到紀錄');
        router.back();
        return;
      }
      setEntryLocalDate(entry.localDate);
      setDraft({
        name: entry.name,
        mealType: entry.mealType,
        basis: entry.basis,
        sourceKcal: entry.sourceKcal,
        sourceProteinG: entry.sourceProteinG,
        sourceFatG: entry.sourceFatG,
        sourceCarbsG: entry.sourceCarbsG,
        quantity: entry.quantity,
        source: entry.source,
        catalogId: entry.catalogId,
        barcode: entry.barcode,
        dataQualityWarnings: [],
        utcTimestamp: entry.utcTimestamp,
      });
      setName(entry.name);
      setKcal(String(entry.sourceKcal));
      setProtein(String(entry.sourceProteinG));
      setFat(String(entry.sourceFatG));
      setCarbs(String(entry.sourceCarbsG));
      setQty(String(entry.quantity));
      setLoaded(true);
    })();
  }, [id, router]);

  if (!loaded || !draft) {
    return (
      <View style={styles.center}>
        <Text>{zhTW.common.loading}</Text>
      </View>
    );
  }

  const onSave = async () => {
    const editedAt = new Date();
    const tz = getTimeZoneMetadata(editedAt);
    const d: FoodDraft = {
      ...draft,
      name,
      sourceKcal: parseFiniteNumber(kcal),
      sourceProteinG: parseFiniteNumber(protein),
      sourceFatG: parseFiniteNumber(fat),
      sourceCarbsG: parseFiniteNumber(carbs),
      quantity: parseFiniteNumber(qty),
      utcTimestamp: editedAt.toISOString(),
    };
    d.dataQualityWarnings = collectDataQualityWarnings(d);
    const errs = validateFoodDraft({
      name: d.name,
      basis: d.basis,
      sourceKcal: d.sourceKcal,
      sourceProteinG: d.sourceProteinG,
      sourceFatG: d.sourceFatG,
      sourceCarbsG: d.sourceCarbsG,
      quantity: d.quantity,
    });
    const map: Record<string, string> = {};
    for (const e of errs) map[e.field] = e.message;
    setErrors(map);
    if (errs.length) return;

    // Recompute local date from edited time (Req 5.3)
    const newLocal = toLocalDateString(editedAt);
    const result = await confirmFoodDraft(
      {
        ...d,
        utcTimestamp: editedAt.toISOString(),
      },
      { localDate: newLocal, editId: Number(id) }
    );
    // Also update TZ on edit via updateFoodEntry path - confirmFood uses device TZ
    void tz;
    if (!result.ok) {
      Alert.alert('驗證失敗', result.errors.join('\n'));
      return;
    }
    bumpRefresh();
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.meta}>原日期：{entryLocalDate}</Text>
      <Field label={zhTW.food.name} value={name} onChangeText={setName} error={errors.name} />
      <MealPicker
        value={draft.mealType}
        onChange={(mealType: MealType) => setDraft({ ...draft, mealType })}
      />
      <BasisPicker
        value={draft.basis}
        onChange={(basis: NutritionBasis) => setDraft({ ...draft, basis })}
      />
      <Field label={zhTW.food.kcal} value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" error={errors.kcal} />
      <Field label={zhTW.food.protein} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" error={errors.protein_g} />
      <Field label={zhTW.food.fat} value={fat} onChangeText={setFat} keyboardType="decimal-pad" error={errors.fat_g} />
      <Field label={zhTW.food.carbs} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" error={errors.carbs_g} />
      <Field
        label={draft.basis === 'PER_100_G' ? zhTW.food.quantityG : zhTW.food.quantityServing}
        value={qty}
        onChangeText={setQty}
        keyboardType="decimal-pad"
        error={errors.quantity}
      />
      <PrimaryButton label={zhTW.common.save} onPress={onSave} />
      <View style={{ height: theme.space.md }} />
      <PrimaryButton
        label={zhTW.common.delete}
        danger
        onPress={() =>
          Alert.alert(zhTW.diary.deleteConfirmTitle, zhTW.diary.deleteConfirmMessage, [
            { text: zhTW.common.cancel, style: 'cancel' },
            {
              text: zhTW.common.delete,
              style: 'destructive',
              onPress: async () => {
                await deleteFoodEntry(Number(id));
                bumpRefresh();
                router.back();
              },
            },
          ])
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  meta: { color: theme.colors.textMuted, marginBottom: theme.space.md },
});
