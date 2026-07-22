import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FoodEntry, MealType } from '@/src/domain/types';
import { displayKcal, displayNutrients, sumNutrients } from '@/src/domain/nutrition';
import { theme } from '@/src/theme';
import { useApp } from '@/src/context/AppContext';

export function FoodRow({
  entry,
  onPress,
  onDelete,
}: {
  entry: FoodEntry;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { t } = useApp();
  const d = displayNutrients({
    kcal: entry.snapKcal,
    protein_g: entry.snapProteinG,
    fat_g: entry.snapFatG,
    carbs_g: entry.snapCarbsG,
  });
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.name} ${d.kcal} kcal`}
      accessibilityHint={t('accessibility.editFoodHint')}
    >
      <View style={styles.rowMain}>
        <Text style={styles.foodName} numberOfLines={1}>
          {entry.name}
        </Text>
        <Text style={styles.foodSub} numberOfLines={1}>
          P{d.protein_g} · F{d.fat_g} · C{d.carbs_g}
        </Text>
      </View>
      <Text style={styles.kcal}>{d.kcal}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function MealSection({
  meal,
  entries,
  onAdd,
  onEdit,
  onDelete,
  onMenu,
}: {
  meal: MealType;
  entries: FoodEntry[];
  onAdd: () => void;
  onEdit: (e: FoodEntry) => void;
  onDelete: (e: FoodEntry) => void;
  onMenu?: () => void;
}) {
  const { t } = useApp();
  const mealTotal = displayKcal(
    sumNutrients(
      entries.map((e) => ({
        kcal: e.snapKcal,
        protein_g: e.snapProteinG,
        fat_g: e.snapFatG,
        carbs_g: e.snapCarbsG,
      }))
    ).kcal
  );

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.mealTitle} accessibilityRole="header">{t(`meal.${meal}`)}</Text>
        <View style={styles.headerActions}>
          <Text style={styles.mealTotal}>{mealTotal}</Text>
          {onMenu ? (
            <Pressable onPress={onMenu} style={styles.menu} accessibilityRole="button" accessibilityLabel={t('accessibility.mealActions')}>
              <Text style={styles.menuText}>•••</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={onAdd}
        style={({ pressed }) => [styles.addRow, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t('diary.addFoodPlus')} ${t(`meal.${meal}`)}`}
      >
        <Text style={styles.addIcon}>＋</Text>
        <Text style={styles.addText}>{t('diary.addFood')}</Text>
      </Pressable>
      {entries.map((e) => (
        <FoodRow
          key={e.id}
          entry={e}
          onPress={() => onEdit(e)}
          onDelete={() => onDelete(e)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: theme.colors.bg,
    marginBottom: theme.space.sm,
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  mealTitle: {
    fontSize: theme.font.mealTitle,
    fontWeight: '600',
    color: theme.colors.text,
  },
  mealTotal: {
    fontSize: theme.font.body,
    fontWeight: '600',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  menu: { minWidth: theme.minTouch, minHeight: theme.minTouch, alignItems: 'center', justifyContent: 'center' },
  menuText: { color: theme.colors.textMuted, fontWeight: '800' },
  addRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.md,
    gap: theme.space.sm,
  },
  addIcon: {
    fontSize: 22,
    color: theme.colors.lakeBlue,
    fontWeight: '600',
  },
  addText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.lakeBlue,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  rowPressed: {
    backgroundColor: theme.colors.surface,
  },
  rowMain: { flex: 1, paddingRight: theme.space.sm },
  foodName: {
    fontSize: theme.font.body,
    fontWeight: '500',
    color: theme.colors.text,
  },
  foodSub: {
    marginTop: 2,
    fontSize: theme.font.bodySmall,
    color: theme.colors.textMuted,
  },
  kcal: {
    fontSize: theme.font.body,
    fontWeight: '600',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
    marginRight: 4,
  },
  chevron: {
    fontSize: 20,
    color: theme.colors.textMute,
    marginLeft: 4,
  },
});
