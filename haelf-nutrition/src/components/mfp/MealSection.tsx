import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import type { FoodEntry, MealType } from '@/src/domain/types';
import { displayKcal, sumNutrients } from '@/src/domain/nutrition';
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
  const swipeRef = useRef<Swipeable>(null);
  const kcal = displayKcal(entry.snapKcal);

  const renderRightActions = () => (
    <Pressable
      onPress={() => {
        swipeRef.current?.close();
        onDelete();
      }}
      style={styles.deleteAction}
      accessibilityRole="button"
      accessibilityLabel={t('common.delete')}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
    </Pressable>
  );

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      overshootRight={false}
      rightThreshold={40}
      renderRightActions={renderRightActions}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${entry.name} ${kcal} kcal`}
        accessibilityHint={t('accessibility.editFoodHint')}
      >
        <View style={styles.rowMain}>
          <Text style={styles.foodName} numberOfLines={1}>
            {entry.name}
          </Text>
        </View>
        <Text style={styles.kcal}>{kcal}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Swipeable>
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
        <Text style={styles.mealTitle} accessibilityRole="header">
          {t(`meal.${meal}`)}
        </Text>
        <View style={styles.headerActions}>
          <Text style={styles.mealTotal}>{mealTotal}</Text>
          {onMenu ? (
            <Pressable
              onPress={onMenu}
              style={styles.menu}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.mealActions')}
            >
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
  menu: {
    minWidth: theme.minTouch,
    minHeight: theme.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  deleteAction: {
    width: 72,
    minHeight: 64,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
