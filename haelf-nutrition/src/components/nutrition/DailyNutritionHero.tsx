import { StyleSheet, Text, View } from 'react-native';
import { displayKcal, displayMacroG } from '@/src/domain/nutrition';
import {
  calorieRingColor,
  calorieRingSemantic,
  nutrientProgress,
  remainingKcal,
} from '@/src/domain/progress';
import type { Nutrients } from '@/src/domain/types';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';
import { MacroMiniRing, ProgressRing } from './ProgressRing';

type Goals = {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
} | null;

type Props = {
  consumed: Nutrients;
  goal: Goals;
  exerciseKcal?: number;
};

export function DailyNutritionHero({ consumed, goal, exerciseKcal = 0 }: Props) {
  const hasGoal = goal != null && goal.kcal > 0;
  const calorieBudget = hasGoal ? goal!.kcal + exerciseKcal : null;
  const progress = nutrientProgress(consumed.kcal, calorieBudget);
  const semantic = calorieRingSemantic(progress, hasGoal);
  const ringColor = calorieRingColor(semantic);
  const remaining = remainingKcal(consumed.kcal, calorieBudget);
  const over = remaining != null && remaining < 0;
  const centerValue =
    remaining == null
      ? displayKcal(consumed.kcal)
      : displayKcal(Math.abs(remaining));
  const centerLabel = remaining == null ? zhTW.diary.food : over ? zhTW.diary.over : zhTW.diary.remainingLabel;

  const foodKcal = displayKcal(consumed.kcal);
  const goalKcal = hasGoal ? displayKcal(goal!.kcal) : null;

  const a11y =
    remaining == null
      ? `已攝取 ${foodKcal} 千卡，目標尚未設定`
      : over
        ? `超出 ${centerValue} 千卡，目標 ${goalKcal}，已攝取 ${foodKcal}`
        : `剩餘 ${centerValue} 千卡，目標 ${goalKcal}，已攝取 ${foodKcal}`;

  const c = displayMacroG(consumed.carbs_g);
  const f = displayMacroG(consumed.fat_g);
  const p = displayMacroG(consumed.protein_g);

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
        <Text style={styles.caloriesLabel}>{zhTW.diary.calories}</Text>
      </ProgressRing>

      <View style={styles.statRow}>
        <StatCol label={zhTW.diary.goal} value={goalKcal != null ? String(goalKcal) : '—'} />
        <StatCol label={zhTW.diary.food} value={String(foodKcal)} />
        <StatCol label={zhTW.diary.exercise} value={String(displayKcal(exerciseKcal))} />
      </View>

      <View style={styles.macroRow}>
        <MacroMiniRing
          label={zhTW.diary.macros.carbs}
          consumed={c}
          goal={goal ? displayMacroG(goal.carbs_g) : null}
          color={theme.colors.carbs}
        />
        <MacroMiniRing
          label={zhTW.diary.macros.fat}
          consumed={f}
          goal={goal ? displayMacroG(goal.fat_g) : null}
          color={theme.colors.fat}
        />
        <MacroMiniRing
          label={zhTW.diary.macros.protein}
          consumed={p}
          goal={goal ? displayMacroG(goal.protein_g) : null}
          color={theme.colors.protein}
        />
      </View>
    </View>
  );
}

function StatCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  statRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: theme.space.lg,
    paddingHorizontal: theme.space.md,
  },
  statCol: { flex: 1, alignItems: 'center' },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.heroNumber,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    marginTop: 4,
    fontSize: theme.font.macroLabel,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  macroRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: theme.space.lg,
    paddingHorizontal: theme.space.sm,
  },
});
