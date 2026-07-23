import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { useApp } from '@/src/context/AppContext';
import { saveBodyPlan } from '@/src/db/repositories/bodyPlan';
import { upsertOngoingGoals } from '@/src/db/repositories/goals';
import { upsertOngoingWaterGoal } from '@/src/db/repositories/water';
import { createWeightEntry } from '@/src/db/repositories/weight';
import {
  WeightPlanFields,
  parseBodyPlanForm,
  type BodyPlanFormState,
} from '@/src/components/goals/WeightPlanFields';
import type { NutritionSuggestion } from '@/src/domain/tdee';
import { getTimeZoneMetadata, toLocalDateString, utcNowIso } from '@/src/domain/dates';
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
  const [planForm, setPlanForm] = useState<BodyPlanFormState>({
    sex: null,
    age: '',
    height: '',
    activity: null,
    currentWeight: '',
    targetWeight: '',
    planWeeks: '12',
    tdeeMode: 'auto',
    tdeeKcal: '',
  });
  const [suggestion, setSuggestion] = useState<NutritionSuggestion | null>(null);

  const planLabels = useMemo(
    () => ({
      title: t('goals.planTitle'),
      hint: t('goals.planHint'),
      sex: t('goals.sex'),
      male: t('goals.male'),
      female: t('goals.female'),
      age: t('goals.age'),
      height: t('goals.height'),
      activity: t('goals.activity'),
      activitySedentary: t('goals.activitySedentary'),
      activityLight: t('goals.activityLight'),
      activityModerate: t('goals.activityModerate'),
      activityActive: t('goals.activityActive'),
      activityVeryActive: t('goals.activityVeryActive'),
      currentWeight: t('goals.currentWeight'),
      targetWeight: t('goals.targetWeight'),
      planWeeks: t('goals.planWeeks'),
      tdeeMode: t('goals.tdeeMode'),
      tdeeAuto: t('goals.tdeeAuto'),
      tdeeManual: t('goals.tdeeManual'),
      tdeeKcal: t('goals.tdeeKcal'),
      calculate: t('goals.calculate'),
      summaryTitle: t('goals.summaryTitle'),
      bmr: t('goals.bmr'),
      tdee: t('goals.tdee'),
      deficit: t('goals.deficit'),
      suggestedKcal: t('goals.suggestedKcal'),
      applySuggestion: t('goals.applySuggestion'),
      warningAggressive: t('goals.warningAggressive'),
      warningFloor: t('goals.warningFloor'),
      warningGain: t('goals.warningGain'),
      warningMaintain: t('goals.warningMaintain'),
    }),
    [t]
  );

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!needsGoalsSetup) {
    if (needsAiSetup) return <Redirect href="/(auth)/setup-ai" />;
    if (needsStepsSetup) return <Redirect href="/(auth)/setup-steps" />;
    return <Redirect href="/" />;
  }

  const runCalculate = (): NutritionSuggestion | null => {
    const parsed = parseBodyPlanForm(
      planForm,
      t('common.required'),
      t('validation.outOfRange')
    );
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setSuggestion(null);
      return null;
    }
    setErrors({});
    setSuggestion(parsed.suggestion);
    return parsed.suggestion;
  };

  const applySuggestion = (s: NutritionSuggestion) => {
    nutrients.setValues({
      kcal: String(s.dailyKcal),
      protein: String(s.proteinG),
      fat: String(s.fatG),
      carbs: String(s.carbsG),
      mode: 'linked',
    });
  };

  const onSave = async () => {
    const parsed = parseBodyPlanForm(
      planForm,
      t('common.required'),
      t('validation.outOfRange')
    );
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }

    let values = {
      kcal: parseFiniteNumber(nutrients.kcal),
      protein_g: parseFiniteNumber(nutrients.protein),
      fat_g: parseFiniteNumber(nutrients.fat),
      carbs_g: parseFiniteNumber(nutrients.carbs),
    };
    // If macros still empty, auto-apply suggestion.
    if (
      values.kcal == null ||
      values.protein_g == null ||
      values.fat_g == null ||
      values.carbs_g == null
    ) {
      applySuggestion(parsed.suggestion);
      values = {
        kcal: parsed.suggestion.dailyKcal,
        protein_g: parsed.suggestion.proteinG,
        fat_g: parsed.suggestion.fatG,
        carbs_g: parsed.suggestion.carbsG,
      };
      setSuggestion(parsed.suggestion);
    }

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

      await saveBodyPlan(parsed.plan);
      await upsertOngoingGoals({
        kcal: values.kcal!,
        proteinG: values.protein_g!,
        fatG: values.fat_g!,
        carbsG: values.carbs_g!,
      });
      await upsertOngoingWaterGoal(waterMl);

      const now = new Date();
      const tz = getTimeZoneMetadata(now);
      await createWeightEntry({
        kg: parsed.plan.currentWeightKg!,
        utcTimestamp: utcNowIso(now),
        localDate: toLocalDateString(now),
        tzIana: tz.iana,
        tzOffsetMinutes: tz.utcOffsetMinutes,
      });

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

      <WeightPlanFields
        form={planForm}
        errors={errors}
        labels={planLabels}
        suggestion={suggestion}
        onChange={setPlanForm}
        onCalculate={() => {
          const s = runCalculate();
          if (s) applySuggestion(s);
        }}
        onApply={() => {
          if (suggestion) applySuggestion(suggestion);
        }}
      />

      <SectionTitle title={t('goals.title')} />
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
