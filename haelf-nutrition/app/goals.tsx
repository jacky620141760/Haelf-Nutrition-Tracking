import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import { useAuth } from '@/src/context/AuthContext';
import { getBodyPlan, saveBodyPlan } from '@/src/db/repositories/bodyPlan';
import { getOngoingGoals, upsertOngoingGoals } from '@/src/db/repositories/goals';
import {
  listWaterGoalVersions,
  upsertOngoingWaterGoal,
} from '@/src/db/repositories/water';
import { createWeightEntry, getLatestWeightOnOrBefore } from '@/src/db/repositories/weight';
import {
  WeightPlanFields,
  bodyPlanToForm,
  parseBodyPlanForm,
  type BodyPlanFormState,
} from '@/src/components/goals/WeightPlanFields';
import type { NutritionSuggestion } from '@/src/domain/tdee';
import { resolveWaterGoalForDate, isValidWaterMl } from '@/src/domain/water';
import { getTimeZoneMetadata, toLocalDateString, utcNowIso } from '@/src/domain/dates';
import { parseFiniteNumber, validateGoalNutrients } from '@/src/domain/validation';
import { Field, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { NutritionInputFields } from '@/src/components/nutrition/NutritionInputFields';
import { useLinkedMacroKcal } from '@/src/hooks/useLinkedMacroKcal';
import { theme } from '@/src/theme';

const EMPTY_PLAN_FORM: BodyPlanFormState = {
  sex: null,
  age: '',
  height: '',
  activity: null,
  currentWeight: '',
  targetWeight: '',
  planWeeks: '12',
  tdeeMode: 'auto',
  tdeeKcal: '',
};

export default function GoalsScreen() {
  const { todayLocalDate, bumpRefresh, t } = useApp();
  const { syncNow } = useAuth();
  const nutrients = useLinkedMacroKcal({ mode: 'linked' });
  const [water, setWater] = useState('2000');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [planForm, setPlanForm] = useState<BodyPlanFormState>(EMPTY_PLAN_FORM);
  const [suggestion, setSuggestion] = useState<NutritionSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

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

  const load = useCallback(async () => {
    const effectiveDate = todayLocalDate || toLocalDateString();
    const [ongoing, waterVersions, plan, latestWeight] = await Promise.all([
      getOngoingGoals(),
      listWaterGoalVersions(),
      getBodyPlan(),
      getLatestWeightOnOrBefore(effectiveDate),
    ]);
    const waterGoal = resolveWaterGoalForDate(waterVersions, effectiveDate);
    if (waterGoal) setWater(String(waterGoal.ml));
    if (ongoing) {
      nutrients.setValues({
        kcal: String(ongoing.kcal),
        protein: String(ongoing.proteinG),
        fat: String(ongoing.fatG),
        carbs: String(ongoing.carbsG),
        mode: 'linked',
      });
    }
    const form = bodyPlanToForm(plan);
    if (!form.currentWeight && latestWeight) {
      form.currentWeight = String(latestWeight.kg);
    }
    setPlanForm(form);
    setDirty(false);
    if (
      plan.sex &&
      plan.ageYears &&
      plan.heightCm &&
      plan.activityLevel &&
      plan.currentWeightKg &&
      plan.targetWeightKg &&
      plan.planWeeks
    ) {
      const parsed = parseBodyPlanForm(form, t('common.required'), t('validation.outOfRange'));
      if (parsed.ok) setSuggestion(parsed.suggestion);
    }
    // nutrients.setValues is stable enough for this screen; omit from deps to avoid reload loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayLocalDate, t]);

  useFocusEffect(
    useCallback(() => {
      if (dirty) return;
      void load();
    }, [load, dirty])
  );
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
    setDirty(true);
    nutrients.setValues({
      kcal: String(s.dailyKcal),
      protein: String(s.proteinG),
      fat: String(s.fatG),
      carbs: String(s.carbsG),
      mode: 'linked',
    });
  };

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

    const waterMl = parseFiniteNumber(water);
    if (waterMl == null || !isValidWaterMl(waterMl)) {
      map.water = t('validation.outOfRange');
    }

    // Body plan is optional when only changing daily macros / water.
    const planTouched =
      planForm.sex != null ||
      planForm.age.trim() !== '' ||
      planForm.height.trim() !== '' ||
      planForm.activity != null ||
      planForm.currentWeight.trim() !== '' ||
      planForm.targetWeight.trim() !== '' ||
      (planForm.planWeeks.trim() !== '' && planForm.planWeeks.trim() !== '12') ||
      planForm.tdeeMode === 'manual' ||
      planForm.tdeeKcal.trim() !== '';

    const parsed = planTouched
      ? parseBodyPlanForm(planForm, t('common.required'), t('validation.outOfRange'))
      : null;
    if (parsed && !parsed.ok) {
      Object.assign(map, parsed.errors);
    }

    setErrors(map);
    if (Object.keys(map).length || errs.length) return;

    setBusy(true);
    try {
      if (parsed?.ok) {
        await saveBodyPlan(parsed.plan);
        const now = new Date();
        const tz = getTimeZoneMetadata(now);
        const localDate = todayLocalDate || toLocalDateString(now);
        const latest = await getLatestWeightOnOrBefore(localDate);
        if (!latest || Math.abs(latest.kg - parsed.plan.currentWeightKg!) >= 0.05) {
          await createWeightEntry({
            kg: parsed.plan.currentWeightKg!,
            utcTimestamp: utcNowIso(now),
            localDate,
            tzIana: tz.iana,
            tzOffsetMinutes: tz.utcOffsetMinutes,
          });
        }
      }

      await upsertOngoingGoals({
        kcal: values.kcal!,
        proteinG: values.protein_g!,
        fatG: values.fat_g!,
        carbsG: values.carbs_g!,
      });
      await upsertOngoingWaterGoal(waterMl!);

      setDirty(false);
      await syncNow();
      bumpRefresh();
      await load();
      Alert.alert(t('common.save'), t('goals.ongoingSaved'));
    } catch (error) {
      Alert.alert(t('common.retry'), error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle title={t('goals.title')} />
      <Text style={styles.hint}>{t('goals.ongoingHint')}</Text>

      <WeightPlanFields
        form={planForm}
        errors={errors}
        labels={planLabels}
        suggestion={suggestion}
        onChange={(next) => {
          setDirty(true);
          setPlanForm(next);
        }}
        onCalculate={() => {
          const s = runCalculate();
          if (s) applySuggestion(s);
        }}
        onApply={() => {
          if (suggestion) applySuggestion(suggestion);
        }}
      />

      <NutritionInputFields
        kcal={nutrients.kcal}
        protein={nutrients.protein}
        fat={nutrients.fat}
        carbs={nutrients.carbs}
        mode={nutrients.kcalMode}
        errors={errors}
        onKcalChange={(v) => {
          setDirty(true);
          nutrients.onKcalChange(v);
        }}
        onProteinChange={(v) => {
          setDirty(true);
          nutrients.onProteinChange(v);
        }}
        onFatChange={(v) => {
          setDirty(true);
          nutrients.onFatChange(v);
        }}
        onCarbsChange={(v) => {
          setDirty(true);
          nutrients.onCarbsChange(v);
        }}
        onRelink={nutrients.relinkKcal}
      />
      <Field
        label={`${t('goals.water')} (ml)`}
        value={water}
        onChangeText={(v) => {
          setDirty(true);
          setWater(v);
        }}
        keyboardType="decimal-pad"
        error={errors.water}
      />
      <PrimaryButton
        label={busy ? t('common.loading') : t('goals.save')}
        onPress={onSave}
        disabled={busy}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  hint: { color: theme.colors.textMuted, marginBottom: theme.space.sm, lineHeight: 20 },
});
