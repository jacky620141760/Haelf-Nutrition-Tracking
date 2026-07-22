import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import { getFoodEntry, deleteFoodEntry } from '@/src/db/repositories/food';
import type { FoodEntry, MealType, NutritionBasis } from '@/src/domain/types';
import { validateFoodDraft } from '@/src/domain/validation';
import { collectDataQualityWarnings } from '@/src/domain/quality';
import { displayNutrients } from '@/src/domain/nutrition';
import { confirmFoodDraft } from '@/src/services/confirmFood';
import { emptyDraft } from '@/src/services/draftStore';
import { BasisPicker, MealPicker } from '@/src/components/Pickers';
import { Field, PrimaryButton } from '@/src/components/ui';
import { NutritionInputFields } from '@/src/components/nutrition/NutritionInputFields';
import { useFoodNutrientForm } from '@/src/hooks/useFoodNutrientForm';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

export default function EditFoodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bumpRefresh } = useApp();
  const [loaded, setLoaded] = useState(false);
  const form = useFoodNutrientForm(emptyDraft());
  const {
    draft,
    setDraft,
    name,
    setName,
    kcal,
    protein,
    fat,
    carbs,
    quantity,
    setQuantity,
    errors,
    kcalMode,
    preview,
  } = form;
  const [entryLocalDate, setEntryLocalDate] = useState('');
  const [entryTime, setEntryTime] = useState<
    Pick<FoodEntry, 'utcTimestamp' | 'localDate' | 'tzIana' | 'tzOffsetMinutes'> | null
  >(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [qualityConfirmed, setQualityConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setEntryTime(null);
    setEntryLocalDate('');
    setWarnings([]);
    setQualityConfirmed(false);

    (async () => {
      const entry = await getFoodEntry(Number(id));
      if (cancelled) return;
      if (!entry) {
        Alert.alert('找不到紀錄');
        router.back();
        return;
      }
      setEntryLocalDate(entry.localDate);
      setEntryTime({
        utcTimestamp: entry.utcTimestamp,
        localDate: entry.localDate,
        tzIana: entry.tzIana,
        tzOffsetMinutes: entry.tzOffsetMinutes,
      });
      form.applyDraft({
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
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  useEffect(() => {
    setQualityConfirmed(false);
  }, [name, kcal, protein, fat, carbs, quantity, draft.basis]);

  if (!loaded || !entryTime) {
    return (
      <View style={styles.center}>
        <Text>{zhTW.common.loading}</Text>
      </View>
    );
  }

  const onSave = async () => {
    const d = form.buildDraft();
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
    form.setValidationErrors(errs);
    setWarnings(d.dataQualityWarnings);
    if (errs.length) return;
    if (d.dataQualityWarnings.length && !qualityConfirmed) {
      Alert.alert(zhTW.food.qualityWarning, d.dataQualityWarnings.join('\n'));
      return;
    }

    const result = await confirmFoodDraft(d, {
      editId: Number(id),
      originalTime: entryTime,
    });
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
      <NutritionInputFields
        kcal={kcal}
        protein={protein}
        fat={fat}
        carbs={carbs}
        mode={kcalMode}
        errors={errors}
        onKcalChange={form.onKcalChange}
        onProteinChange={form.onProteinChange}
        onFatChange={form.onFatChange}
        onCarbsChange={form.onCarbsChange}
        onRelink={form.relinkKcal}
      />
      <Field
        label={draft.basis === 'PER_100_G' ? zhTW.food.quantityG : zhTW.food.quantityServing}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="decimal-pad"
        error={errors.quantity}
      />
      {preview ? (
        <Text style={styles.preview}>
          {zhTW.diary.intake}：{displayNutrients(preview).kcal} kcal
        </Text>
      ) : null}
      {warnings.length ? (
        <View style={styles.warnBox} accessibilityRole="alert">
          <Text style={styles.warnTitle}>⚠ {zhTW.food.qualityWarning}</Text>
          {warnings.map((warning) => (
            <Text key={warning} style={styles.warnText}>{warning}</Text>
          ))}
          <Pressable
            onPress={() => setQualityConfirmed((value) => !value)}
            style={styles.checkRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: qualityConfirmed }}
            accessibilityLabel={zhTW.food.qualityConfirm}
          >
            <Text>{qualityConfirmed ? '☑' : '☐'} {zhTW.food.qualityConfirm}</Text>
          </Pressable>
        </View>
      ) : null}
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
  preview: { marginBottom: theme.space.md, fontWeight: '600', color: theme.colors.text },
  warnBox: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.space.md,
    borderRadius: theme.radius,
    marginBottom: theme.space.md,
  },
  warnTitle: { fontWeight: '700', color: theme.colors.warning, marginBottom: 4 },
  warnText: { color: theme.colors.warning },
  checkRow: { marginTop: theme.space.sm, minHeight: theme.minTouch, justifyContent: 'center' },
});
