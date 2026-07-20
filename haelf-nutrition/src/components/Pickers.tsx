import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MealType } from '@/src/domain/types';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function MealPicker({
  value,
  onChange,
}: {
  value: MealType;
  onChange: (m: MealType) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={zhTW.food.mealType}>
      {MEALS.map((m) => {
        const selected = value === m;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={zhTW.meal[m]}
            style={[
              styles.chip,
              { borderColor: theme.colors.mealAccent[m] },
              selected && { backgroundColor: theme.colors.mealAccent[m] },
            ]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextOn]}>
              {zhTW.meal[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BasisPicker({
  value,
  onChange,
}: {
  value: 'PER_100_G' | 'PER_SERVING';
  onChange: (b: 'PER_100_G' | 'PER_SERVING') => void;
}) {
  const options: { id: 'PER_100_G' | 'PER_SERVING'; label: string }[] = [
    { id: 'PER_100_G', label: zhTW.food.per100g },
    { id: 'PER_SERVING', label: zhTW.food.perServing },
  ];
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={zhTW.food.basis}>
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
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
    marginBottom: theme.space.md,
  },
  chip: {
    minHeight: theme.minTouch,
    paddingHorizontal: theme.space.md,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: theme.colors.accent,
  },
  chipText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  chipTextOn: {
    color: '#fff',
  },
});
