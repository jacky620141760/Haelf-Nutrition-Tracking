import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { useApp } from '@/src/context/AppContext';
import { upsertOngoingGoals } from '@/src/db/repositories/goals';
import { upsertOngoingWaterGoal } from '@/src/db/repositories/water';
import { parseFiniteNumber, validateGoalNutrients } from '@/src/domain/validation';
import { isValidWaterMl } from '@/src/domain/water';
import { NutritionInputFields } from '@/src/components/nutrition/NutritionInputFields';
import { useLinkedMacroKcal } from '@/src/hooks/useLinkedMacroKcal';
import { Field, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function SetupGoalsScreen() {
  const { t, bumpRefresh } = useApp();
  const { session, needsGoalsSetup, refreshOnboardingGate, syncNow, needsAiSetup, needsStepsSetup } =
    useAuth();
  const router = useRouter();
  const nutrients = useLinkedMacroKcal({ mode: 'linked' });
  const [water, setWater] = useState('2000');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!needsGoalsSetup) {
    if (needsAiSetup) return <Redirect href="/(auth)/setup-ai" />;
    if (needsStepsSetup) return <Redirect href="/(auth)/setup-steps" />;
    return <Redirect href="/(tabs)" />;
  }

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

    setBusy(true);
    try {
      const waterMl = parseFiniteNumber(water);
      if (waterMl == null || !isValidWaterMl(waterMl)) {
        setErrors((current) => ({ ...current, water: t('validation.outOfRange') }));
        setBusy(false);
        return;
      }
      await upsertOngoingGoals({
        kcal: values.kcal!,
        proteinG: values.protein_g!,
        fatG: values.fat_g!,
        carbsG: values.carbs_g!,
      });
      await upsertOngoingWaterGoal(waterMl);
      await refreshOnboardingGate();
      await syncNow();
      bumpRefresh();
      router.replace('/(auth)/setup-ai');
    } catch (error) {
      Alert.alert(t('common.retry'), error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.step}>{t('auth.onboardingStep', { current: 1, total: 3 })}</Text>
      <SectionTitle title={t('auth.setupGoalsTitle')} />
      <Text style={styles.hint}>{t('auth.setupGoalsRequired')}</Text>
      <Text style={styles.hint}>{t('auth.setupGoalsOngoing')}</Text>
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
      <PrimaryButton
        label={busy ? t('common.loading') : t('auth.saveGoalsContinue')}
        onPress={onSave}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  step: { color: theme.colors.lakeBlue, fontWeight: '700', marginBottom: theme.space.sm },
  hint: { color: theme.colors.textMuted, marginBottom: theme.space.sm, lineHeight: 20 },
});
