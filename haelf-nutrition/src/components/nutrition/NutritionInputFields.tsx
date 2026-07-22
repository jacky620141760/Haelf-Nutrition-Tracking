import { StyleSheet, Text, View } from 'react-native';
import { Field, MfpButton } from '@/src/components/ui';
import type { KcalInputMode } from '@/src/hooks/useLinkedMacroKcal';
import { theme } from '@/src/theme';
import { useApp } from '@/src/context/AppContext';

type Props = {
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
  mode: KcalInputMode;
  errors: Record<string, string>;
  onKcalChange: (value: string) => void;
  onProteinChange: (value: string) => void;
  onFatChange: (value: string) => void;
  onCarbsChange: (value: string) => void;
  onRelink: () => void;
};

export function NutritionInputFields({
  kcal,
  protein,
  fat,
  carbs,
  mode,
  errors,
  onKcalChange,
  onProteinChange,
  onFatChange,
  onCarbsChange,
  onRelink,
}: Props) {
  const { t } = useApp();
  return (
    <View>
      <Field
        label={t('food.kcal')}
        value={kcal}
        onChangeText={onKcalChange}
        keyboardType="decimal-pad"
        error={errors.kcal}
      />
      <View style={styles.modeRow}>
        <Text style={styles.modeText}>
          {mode === 'linked'
            ? t('food.linkedKcal')
            : t('food.manualKcal')}
        </Text>
        {mode === 'manual' ? (
          <MfpButton
            label={t('food.recalculateKcal')}
            variant="outline"
            onPress={onRelink}
          />
        ) : null}
      </View>
      <Field
        label={t('food.protein')}
        value={protein}
        onChangeText={onProteinChange}
        keyboardType="decimal-pad"
        error={errors.protein_g}
      />
      <Field
        label={t('food.fat')}
        value={fat}
        onChangeText={onFatChange}
        keyboardType="decimal-pad"
        error={errors.fat_g}
      />
      <Field
        label={t('food.carbs')}
        value={carbs}
        onChangeText={onCarbsChange}
        keyboardType="decimal-pad"
        error={errors.carbs_g}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    marginTop: -theme.space.xs,
    marginBottom: theme.space.sm,
    gap: theme.space.xs,
  },
  modeText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    lineHeight: 18,
  },
});
