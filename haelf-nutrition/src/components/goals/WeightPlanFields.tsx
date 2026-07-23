import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field, PrimaryButton } from '@/src/components/ui';
import type { BodyPlan } from '@/src/db/repositories/bodyPlan';
import {
  type ActivityLevel,
  type BiologicalSex,
  type NutritionSuggestion,
  type TdeeMode,
  suggestNutritionPlan,
} from '@/src/domain/tdee';
import { parseFiniteNumber } from '@/src/domain/validation';
import { theme } from '@/src/theme';

export type BodyPlanFormState = {
  sex: BiologicalSex | null;
  age: string;
  height: string;
  activity: ActivityLevel | null;
  currentWeight: string;
  targetWeight: string;
  planWeeks: string;
  tdeeMode: TdeeMode;
  tdeeKcal: string;
};

export function bodyPlanToForm(plan: BodyPlan): BodyPlanFormState {
  return {
    sex: plan.sex,
    age: plan.ageYears != null ? String(plan.ageYears) : '',
    height: plan.heightCm != null ? String(plan.heightCm) : '',
    activity: plan.activityLevel,
    currentWeight: plan.currentWeightKg != null ? String(plan.currentWeightKg) : '',
    targetWeight: plan.targetWeightKg != null ? String(plan.targetWeightKg) : '',
    planWeeks: plan.planWeeks != null ? String(plan.planWeeks) : '12',
    tdeeMode: plan.tdeeMode,
    tdeeKcal: plan.tdeeKcal != null ? String(plan.tdeeKcal) : '',
  };
}

export type BodyPlanParseOk = {
  ok: true;
  plan: Omit<BodyPlan, 'updatedAt'>;
  suggestion: NutritionSuggestion;
};

export type BodyPlanParseFail = {
  ok: false;
  errors: Record<string, string>;
};

export function parseBodyPlanForm(
  form: BodyPlanFormState,
  requiredMsg: string,
  rangeMsg: string
): BodyPlanParseOk | BodyPlanParseFail {
  const errors: Record<string, string> = {};
  if (!form.sex) errors.sex = requiredMsg;
  if (!form.activity) errors.activity = requiredMsg;

  const ageYears = parseFiniteNumber(form.age);
  const heightCm = parseFiniteNumber(form.height);
  const currentWeightKg = parseFiniteNumber(form.currentWeight);
  const targetWeightKg = parseFiniteNumber(form.targetWeight);
  const planWeeks = parseFiniteNumber(form.planWeeks);
  const manualBmr = parseFiniteNumber(form.tdeeKcal);

  if (ageYears == null || ageYears < 10 || ageYears > 120) errors.age = rangeMsg;
  if (heightCm == null || heightCm < 100 || heightCm > 250) errors.height = rangeMsg;
  if (currentWeightKg == null || currentWeightKg < 30 || currentWeightKg > 300) {
    errors.currentWeight = rangeMsg;
  }
  if (targetWeightKg == null || targetWeightKg < 30 || targetWeightKg > 300) {
    errors.targetWeight = rangeMsg;
  }
  if (planWeeks == null || planWeeks < 1 || planWeeks > 104) errors.planWeeks = rangeMsg;
  // Manual field is BMR (basal), not TDEE.
  if (form.tdeeMode === 'manual' && (manualBmr == null || manualBmr < 600 || manualBmr > 4000)) {
    errors.tdeeKcal = rangeMsg;
  }

  if (Object.keys(errors).length || !form.sex || !form.activity) {
    return { ok: false, errors };
  }

  const suggestion = suggestNutritionPlan({
    sex: form.sex,
    ageYears: ageYears!,
    heightCm: heightCm!,
    activityLevel: form.activity,
    currentWeightKg: currentWeightKg!,
    targetWeightKg: targetWeightKg!,
    planWeeks: planWeeks!,
    tdeeMode: form.tdeeMode,
    tdeeKcal: form.tdeeMode === 'manual' ? manualBmr : null,
  });

  return {
    ok: true,
    suggestion,
    plan: {
      sex: form.sex,
      ageYears: ageYears!,
      heightCm: heightCm!,
      activityLevel: form.activity,
      currentWeightKg: currentWeightKg!,
      targetWeightKg: targetWeightKg!,
      planWeeks: planWeeks!,
      tdeeMode: form.tdeeMode,
      // Persist manual BMR only; auto leaves null so TDEE recomputes from metrics.
      tdeeKcal: form.tdeeMode === 'manual' ? manualBmr! : null,
    },
  };
}

type Labels = {
  title: string;
  hint: string;
  sex: string;
  male: string;
  female: string;
  age: string;
  height: string;
  activity: string;
  activitySedentary: string;
  activityLight: string;
  activityModerate: string;
  activityActive: string;
  activityVeryActive: string;
  currentWeight: string;
  targetWeight: string;
  planWeeks: string;
  tdeeMode: string;
  tdeeAuto: string;
  tdeeManual: string;
  tdeeKcal: string;
  calculate: string;
  summaryTitle: string;
  bmr: string;
  tdee: string;
  deficit: string;
  suggestedKcal: string;
  applySuggestion: string;
  warningAggressive: string;
  warningFloor: string;
  warningGain: string;
  warningMaintain: string;
};

function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: T | null;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  error?: string;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => onChange(o.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function WeightPlanFields({
  form,
  errors,
  labels,
  suggestion,
  onChange,
  onCalculate,
  onApply,
}: {
  form: BodyPlanFormState;
  errors: Record<string, string>;
  labels: Labels;
  suggestion: NutritionSuggestion | null;
  onChange: (next: BodyPlanFormState) => void;
  onCalculate: () => void;
  onApply: () => void;
}) {
  const activityOptions: { id: ActivityLevel; label: string }[] = [
    { id: 'sedentary', label: labels.activitySedentary },
    { id: 'light', label: labels.activityLight },
    { id: 'moderate', label: labels.activityModerate },
    { id: 'active', label: labels.activityActive },
    { id: 'very_active', label: labels.activityVeryActive },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{labels.title}</Text>
      <Text style={styles.hint}>{labels.hint}</Text>

      <ChipRow
        label={labels.sex}
        value={form.sex}
        options={[
          { id: 'male', label: labels.male },
          { id: 'female', label: labels.female },
        ]}
        onChange={(sex) => onChange({ ...form, sex })}
        error={errors.sex}
      />

      <Field
        label={labels.age}
        value={form.age}
        onChangeText={(age) => onChange({ ...form, age })}
        keyboardType="number-pad"
        error={errors.age}
      />
      <Field
        label={`${labels.height} (cm)`}
        value={form.height}
        onChangeText={(height) => onChange({ ...form, height })}
        keyboardType="decimal-pad"
        error={errors.height}
      />

      <ChipRow
        label={labels.activity}
        value={form.activity}
        options={activityOptions}
        onChange={(activity) => onChange({ ...form, activity })}
        error={errors.activity}
      />

      <Field
        label={`${labels.currentWeight} (kg)`}
        value={form.currentWeight}
        onChangeText={(currentWeight) => onChange({ ...form, currentWeight })}
        keyboardType="decimal-pad"
        error={errors.currentWeight}
      />
      <Field
        label={`${labels.targetWeight} (kg)`}
        value={form.targetWeight}
        onChangeText={(targetWeight) => onChange({ ...form, targetWeight })}
        keyboardType="decimal-pad"
        error={errors.targetWeight}
      />
      <Field
        label={labels.planWeeks}
        value={form.planWeeks}
        onChangeText={(planWeeks) => onChange({ ...form, planWeeks })}
        keyboardType="decimal-pad"
        error={errors.planWeeks}
      />

      <ChipRow
        label={labels.tdeeMode}
        value={form.tdeeMode}
        options={[
          { id: 'auto', label: labels.tdeeAuto },
          { id: 'manual', label: labels.tdeeManual },
        ]}
        onChange={(tdeeMode) => onChange({ ...form, tdeeMode })}
      />
      {form.tdeeMode === 'manual' ? (
        <Field
          label={labels.tdeeKcal}
          value={form.tdeeKcal}
          onChangeText={(tdeeKcal) => onChange({ ...form, tdeeKcal })}
          keyboardType="decimal-pad"
          error={errors.tdeeKcal}
        />
      ) : null}

      <PrimaryButton label={labels.calculate} onPress={onCalculate} />

      {suggestion ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{labels.summaryTitle}</Text>
          <Text style={styles.summaryLine}>
            {labels.bmr}: {suggestion.bmr} · {labels.tdee}: {suggestion.tdee}
          </Text>
          <Text style={styles.summaryLine}>
            {labels.deficit}: {suggestion.dailyDeficit} kcal/day
          </Text>
          <Text style={styles.summaryLine}>
            {labels.suggestedKcal}: {suggestion.dailyKcal} · P {suggestion.proteinG}g · F{' '}
            {suggestion.fatG}g · C {suggestion.carbsG}g
          </Text>
          {suggestion.warnings.includes('aggressive') ? (
            <Text style={styles.warn}>{labels.warningAggressive}</Text>
          ) : null}
          {suggestion.warnings.includes('floor') ? (
            <Text style={styles.warn}>{labels.warningFloor}</Text>
          ) : null}
          {suggestion.warnings.includes('gain') ? (
            <Text style={styles.warn}>{labels.warningGain}</Text>
          ) : null}
          {suggestion.warnings.includes('maintain') ? (
            <Text style={styles.warn}>{labels.warningMaintain}</Text>
          ) : null}
          <View style={{ height: theme.space.sm }} />
          <PrimaryButton label={labels.applySuggestion} onPress={onApply} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: theme.space.md },
  title: {
    fontSize: theme.font.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.space.xs,
  },
  hint: { color: theme.colors.textMuted, marginBottom: theme.space.md, lineHeight: 20 },
  block: { marginBottom: theme.space.sm },
  label: { color: theme.colors.textMuted, marginBottom: 6, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  chip: {
    minHeight: theme.minTouch,
    paddingHorizontal: theme.space.md,
    borderWidth: 1.5,
    borderColor: theme.colors.lakeBlue,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
  },
  chipSelected: { backgroundColor: theme.colors.lakeBlue },
  chipText: { color: theme.colors.lakeBlue, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  error: { color: theme.colors.danger, marginTop: 4, fontSize: theme.font.small },
  summary: {
    marginTop: theme.space.md,
    padding: theme.space.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  summaryTitle: { fontWeight: '700', marginBottom: theme.space.sm, color: theme.colors.text },
  summaryLine: { color: theme.colors.text, marginBottom: 4, lineHeight: 20 },
  warn: { color: theme.colors.warning, marginTop: 6, lineHeight: 18, fontSize: theme.font.small },
});
