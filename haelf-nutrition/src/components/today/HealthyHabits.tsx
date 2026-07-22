import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DailySummary } from '@/src/domain/types';
import { useApp } from '@/src/context/AppContext';
import { theme } from '@/src/theme';

type Props = {
  summary: DailySummary;
  onWater: () => void;
  onExercise: () => void;
  onSteps: () => void;
};

export function HealthyHabits({ summary, onWater, onExercise, onSteps }: Props) {
  const { t } = useApp();
  const items = [
    {
      key: 'water',
      label: t('habits.water'),
      value: summary.waterGoalMl
        ? `${Math.round(summary.waterMl)} / ${Math.round(summary.waterGoalMl)} ml`
        : `${Math.round(summary.waterMl)} ml`,
      onPress: onWater,
      color: '#0EA5E9',
    },
    {
      key: 'exercise',
      label: t('habits.exercise'),
      value: `${Math.round(summary.exerciseKcal)} kcal`,
      onPress: onExercise,
      color: '#F97316',
    },
    {
      key: 'steps',
      label: t('habits.steps'),
      value: summary.steps == null ? t('common.notRecorded') : summary.steps.toLocaleString(),
      onPress: onSteps,
      color: '#8B5CF6',
    },
  ];
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">{t('habits.title')}</Text>
      <View style={styles.row}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            style={styles.card}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} ${item.value}`}
          >
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.value}>{item.value}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: theme.space.md, backgroundColor: theme.colors.surface },
  title: { fontSize: theme.font.mealTitle, fontWeight: '700', color: theme.colors.text, marginBottom: theme.space.sm },
  row: { flexDirection: 'row', gap: theme.space.sm },
  card: {
    flex: 1,
    minHeight: 104,
    borderRadius: theme.radius,
    backgroundColor: theme.colors.bg,
    padding: theme.space.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: theme.space.sm },
  label: { color: theme.colors.textMuted, fontSize: theme.font.bodySmall, fontWeight: '600' },
  value: { color: theme.colors.text, marginTop: theme.space.xs, fontWeight: '700', fontSize: 14 },
});
