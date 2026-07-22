import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useApp } from '@/src/context/AppContext';
import { useAuth } from '@/src/context/AuthContext';
import { listGoalVersions, upsertOngoingGoals } from '@/src/db/repositories/goals';
import {
  listWaterGoalVersions,
  upsertOngoingWaterGoal,
} from '@/src/db/repositories/water';
import { resolveGoalForDate } from '@/src/domain/goals';
import { resolveWaterGoalForDate, isValidWaterMl } from '@/src/domain/water';
import { toLocalDateString } from '@/src/domain/dates';
import { parseFiniteNumber, validateGoalNutrients } from '@/src/domain/validation';
import { Field, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { NutritionInputFields } from '@/src/components/nutrition/NutritionInputFields';
import { useLinkedMacroKcal } from '@/src/hooks/useLinkedMacroKcal';
import { theme } from '@/src/theme';

export default function GoalsScreen() {
  const { todayLocalDate, bumpRefresh, t } = useApp();
  const { syncNow } = useAuth();
  const nutrients = useLinkedMacroKcal({ mode: 'linked' });
  const [water, setWater] = useState('2000');
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      setErrors((current) => ({ ...current, water: t('validation.outOfRange') }));
      return;
    }

    await upsertOngoingGoals({
      kcal: values.kcal!,
      proteinG: values.protein_g!,
      fatG: values.fat_g!,
      carbsG: values.carbs_g!,
    });
    await upsertOngoingWaterGoal(waterMl);
    await syncNow();
    bumpRefresh();
    Alert.alert(t('common.save'), t('goals.ongoingSaved'));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle title={t('goals.title')} />
      <Text style={styles.hint}>{t('goals.ongoingHint')}</Text>
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
        label={`${t('goals.water')} (ml)`}
        value={water}
        onChangeText={setWater}
        keyboardType="decimal-pad"
        error={errors.water}
      />
      <PrimaryButton label={t('goals.save')} onPress={onSave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  hint: { color: theme.colors.textMuted, marginBottom: theme.space.sm, lineHeight: 20 },
});
