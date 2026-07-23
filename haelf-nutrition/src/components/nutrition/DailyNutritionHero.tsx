import { StyleSheet, Text, View } from 'react-native';
import { displayKcal, displayMacroG } from '@/src/domain/nutrition';
import {
  calorieRingColor,
  calorieRingSemantic,
  nutrientProgress,
  remainingKcal,
} from '@/src/domain/progress';
import type { Nutrients } from '@/src/domain/types';
import { useApp } from '@/src/context/AppContext';
import { theme } from '@/src/theme';
import { MacroMiniRing, ProgressRing } from './ProgressRing';

type Goals = {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
} | null;

type Props = {
  consumed: Nutrients;
  goal: Goals;
};

export function DailyNutritionHero({ consumed, goal }: Props) {
  const { t } = useApp();
  const hasGoal = goal != null && goal.kcal > 0;
  const calorieBudget = hasGoal ? goal!.kcal : null;
  const progress = nutrientProgress(consumed.kcal, calorieBudget);
  const semantic = calorieRingSemantic(progress, hasGoal);
  const ringColor = calorieRingColor(semantic);
  const remaining = remainingKcal(consumed.kcal, calorieBudget);
  const over = remaining != null && remaining < 0;
  const centerValue =
    remaining == null
      ? displayKcal(consumed.kcal)
      : displayKcal(Math.abs(remaining));
  const centerLabel =
    remaining == null
      ? t('diary.food')
      : over
        ? t('diary.over')
        : t('diary.remainingLabel');

  const foodKcal = displayKcal(consumed.kcal);
  const goalKcal = hasGoal ? displayKcal(goal!.kcal) : null;

  const a11y =
    remaining == null
      ? `${t('diary.food')} ${foodKcal} kcal`
      : over
        ? `${t('diary.over')} ${centerValue} kcal · ${t('diary.goal')} ${goalKcal}`
        : `${t('diary.remainingLabel')} ${centerValue} kcal · ${t('diary.goal')} ${goalKcal}`;

  return (
    <View style={styles.wrap}>
      <ProgressRing
        size={theme.ring.calorieSize}
        strokeWidth={theme.ring.calorieStroke}
        progress={hasGoal ? progress : 0}
        color={hasGoal ? ringColor : theme.colors.ringTrack}
        accessibilityLabel={a11y}
      >
        <Text style={styles.remainingLabel}>{centerLabel}</Text>
        <Text style={styles.heroNumber}>{centerValue.toLocaleString('zh-TW')}</Text>
        <Text style={styles.caloriesLabel}>{t('diary.calories')}</Text>
      </ProgressRing>

      <View style={styles.macroRow}>
        <MacroMiniRing
          label={t('diary.macros.carbs')}
          consumed={displayMacroG(consumed.carbs_g)}
          goal={goal?.carbsG ?? null}
          color={theme.colors.carbs}
        />
        <MacroMiniRing
          label={t('diary.macros.fat')}
          consumed={displayMacroG(consumed.fat_g)}
          goal={goal?.fatG ?? null}
          color={theme.colors.fat}
        />
        <MacroMiniRing
          label={t('diary.macros.protein')}
          consumed={displayMacroG(consumed.protein_g)}
          goal={goal?.proteinG ?? null}
          color={theme.colors.protein}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: theme.space.md,
    backgroundColor: theme.colors.bg,
  },
  remainingLabel: {
    fontSize: theme.font.bodySmall,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  heroNumber: {
    fontSize: theme.font.calorieHero,
    fontWeight: '700',
    color: theme.colors.heroNumber,
    fontVariant: ['tabular-nums'],
    lineHeight: theme.font.calorieHero,
    letterSpacing: -1,
  },
  caloriesLabel: {
    fontSize: theme.font.bodySmall,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  macroRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: theme.space.lg,
    paddingHorizontal: theme.space.md,
    gap: theme.space.sm,
  },
});
