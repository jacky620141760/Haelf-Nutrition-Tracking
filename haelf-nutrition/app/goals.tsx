import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useApp } from '@/src/context/AppContext';
import { listGoalVersions, upsertGoalForDate } from '@/src/db/repositories/goals';
import { resolveGoalForDate } from '@/src/domain/goals';
import { toLocalDateString } from '@/src/domain/dates';
import { parseFiniteNumber, validateGoalNutrients } from '@/src/domain/validation';
import { Field, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

export default function GoalsScreen() {
  const { todayLocalDate, bumpRefresh, selectedDate } = useApp();
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [effectiveHint, setEffectiveHint] = useState('');

  useEffect(() => {
    (async () => {
      const versions = await listGoalVersions();
      const g = resolveGoalForDate(versions, selectedDate);
      if (g) {
        setKcal(String(g.kcal));
        setProtein(String(g.proteinG));
        setFat(String(g.fatG));
        setCarbs(String(g.carbsG));
        setEffectiveHint(`${zhTW.goals.effectiveFrom}：${g.effectiveDate}`);
      } else {
        setEffectiveHint(zhTW.common.notSet);
      }
    })();
  }, [selectedDate]);

  const onSave = async () => {
    const values = {
      kcal: parseFiniteNumber(kcal),
      protein_g: parseFiniteNumber(protein),
      fat_g: parseFiniteNumber(fat),
      carbs_g: parseFiniteNumber(carbs),
    };
    const errs = validateGoalNutrients(values);
    const map: Record<string, string> = {};
    for (const e of errs) map[e.field] = e.message;
    setErrors(map);
    if (errs.length) return;

    const effectiveDate = todayLocalDate || toLocalDateString();
    await upsertGoalForDate({
      effectiveDate,
      kcal: values.kcal!,
      proteinG: values.protein_g!,
      fatG: values.fat_g!,
      carbsG: values.carbs_g!,
    });
    bumpRefresh();
    Alert.alert('已儲存', `${zhTW.goals.effectiveFrom} ${effectiveDate}`);
    setEffectiveHint(`${zhTW.goals.effectiveFrom}：${effectiveDate}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle title={zhTW.goals.title} />
      <Text style={styles.hint}>{effectiveHint}</Text>
      <Text style={styles.hint}>修改將以今日（{todayLocalDate}）為生效日期，不回溯過去。</Text>
      <Field label={zhTW.food.kcal} value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" error={errors.kcal} />
      <Field label={zhTW.food.protein} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" error={errors.protein_g} />
      <Field label={zhTW.food.fat} value={fat} onChangeText={setFat} keyboardType="decimal-pad" error={errors.fat_g} />
      <Field label={zhTW.food.carbs} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" error={errors.carbs_g} />
      <PrimaryButton label={zhTW.goals.save} onPress={onSave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  hint: { color: theme.colors.textMuted, marginBottom: theme.space.sm, lineHeight: 20 },
});
