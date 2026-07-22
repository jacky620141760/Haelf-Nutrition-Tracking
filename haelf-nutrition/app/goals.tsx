import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useApp } from '@/src/context/AppContext';
import { listGoalVersions, upsertGoalForDate } from '@/src/db/repositories/goals';
import { resolveGoalForDate } from '@/src/domain/goals';
import {
  listWaterGoalVersions,
  upsertWaterGoalForDate,
} from '@/src/db/repositories/water';
import { resolveWaterGoalForDate, isValidWaterMl } from '@/src/domain/water';
import { toLocalDateString } from '@/src/domain/dates';
import { parseFiniteNumber, validateGoalNutrients } from '@/src/domain/validation';
import { Field, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { NutritionInputFields } from '@/src/components/nutrition/NutritionInputFields';
import { useLinkedMacroKcal } from '@/src/hooks/useLinkedMacroKcal';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

export default function GoalsScreen() {
  const { todayLocalDate, bumpRefresh } = useApp();
  const nutrients = useLinkedMacroKcal({ mode: 'linked' });
  const [water, setWater] = useState('2000');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [effectiveHint, setEffectiveHint] = useState('');

  useEffect(() => {
    (async () => {
      const [versions, waterVersions] = await Promise.all([
        listGoalVersions(),
        listWaterGoalVersions(),
      ]);
      const effectiveDate = todayLocalDate || toLocalDateString();
      const g = resolveGoalForDate(versions, effectiveDate);
      const waterGoal = resolveWaterGoalForDate(waterVersions, effectiveDate);
      if (waterGoal) setWater(String(waterGoal.ml));
      if (g) {
        nutrients.setValues({
          kcal: String(g.kcal),
          protein: String(g.proteinG),
          fat: String(g.fatG),
          carbs: String(g.carbsG),
          mode: 'linked',
        });
        setEffectiveHint(`${zhTW.goals.effectiveFrom}：${g.effectiveDate}`);
      } else {
        setEffectiveHint(zhTW.common.notSet);
      }
    })();
  }, [todayLocalDate]);

  const onSave = async () => {
    const values = {
      kcal: parseFiniteNumber(nutrients.kcal),
      protein_g: parseFiniteNumber(nutrients.protein),
      fat_g: parseFiniteNumber(nutrients.fat),
      carbs_g: parseFiniteNumber(nutrients.carbs),
    };
    const errs = validateGoalNutrients(values);
    const map: Record<string, string> = {};
    for (const e of errs) map[e.field] = e.message;
    setErrors(map);
    if (errs.length) return;
    const waterMl = parseFiniteNumber(water);
    if (waterMl == null || !isValidWaterMl(waterMl)) {
      setErrors((current) => ({ ...current, water: zhTW.validation.outOfRange }));
      return;
    }

    const effectiveDate = todayLocalDate || toLocalDateString();
    await upsertGoalForDate({
      effectiveDate,
      kcal: values.kcal!,
      proteinG: values.protein_g!,
      fatG: values.fat_g!,
      carbsG: values.carbs_g!,
    });
    await upsertWaterGoalForDate(effectiveDate, waterMl);
    bumpRefresh();
    Alert.alert('已儲存', `${zhTW.goals.effectiveFrom} ${effectiveDate}`);
    setEffectiveHint(`${zhTW.goals.effectiveFrom}：${effectiveDate}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle title={zhTW.goals.title} />
      <Text style={styles.hint}>{effectiveHint}</Text>
      <Text style={styles.hint}>修改將以今日（{todayLocalDate}）為生效日期，不回溯過去。</Text>
      <NutritionInputFields
        kcal={nutrients.kcal}
        protein={nutrients.protein}
        fat={nutrients.fat}
        carbs={nutrients.carbs}
        mode={nutrients.kcalMode}
        errors={errors}
        onKcalChange={nutrients.onKcalChange}
        onProteinChange={nutrients.onProteinChange}
        onFatChange={nutrients.onFatChange}
        onCarbsChange={nutrients.onCarbsChange}
        onRelink={nutrients.relinkKcal}
      />
      <Field
        label={`${zhTW.goals.water} (ml)`}
        value={water}
        onChangeText={setWater}
        keyboardType="decimal-pad"
        error={errors.water}
      />
      <PrimaryButton label={zhTW.goals.save} onPress={onSave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  hint: { color: theme.colors.textMuted, marginBottom: theme.space.sm, lineHeight: 20 },
});
