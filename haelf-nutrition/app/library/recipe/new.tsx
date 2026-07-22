import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { FoodCatalogItem } from '@/src/domain/types';
import { listCatalog } from '@/src/db/repositories/food';
import { saveRecipe } from '@/src/db/repositories/recipes';
import { useApp } from '@/src/context/AppContext';
import { Field, MfpButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function NewRecipeScreen() {
  const router = useRouter();
  const { bumpRefresh, t } = useApp();
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [foods, setFoods] = useState<FoodCatalogItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  useEffect(() => { void listCatalog().then(setFoods); }, []);

  const save = async () => {
    const totalServings = Number(servings);
    if (!name.trim() || !Number.isFinite(totalServings) || totalServings <= 0 || !selected.size) {
      Alert.alert(t('validation.outOfRange'));
      return;
    }
    await saveRecipe({
      name,
      totalServings,
      ingredients: foods.filter((food) => selected.has(food.id)).map((food, index) => ({
        sortOrder: index,
        name: food.name,
        basis: food.basis,
        sourceKcal: food.sourceKcal,
        sourceProteinG: food.sourceProteinG,
        sourceFatG: food.sourceFatG,
        sourceCarbsG: food.sourceCarbsG,
        quantity: food.basis === 'PER_100_G' ? 100 : 1,
        catalogId: food.id,
      })),
    });
    bumpRefresh();
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={t('library.createRecipe')} />
      <Field label={t('recipe.name')} value={name} onChangeText={setName} />
      <Field label={t('recipe.totalServings')} value={servings} onChangeText={setServings} keyboardType="decimal-pad" />
      <Text style={styles.label}>{t('library.myFoods')}</Text>
      {foods.map((food) => {
        const checked = selected.has(food.id);
        return (
          <Pressable
            key={food.id}
            style={styles.row}
            onPress={() => setSelected((current) => {
              const next = new Set(current);
              if (checked) next.delete(food.id); else next.add(food.id);
              return next;
            })}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            <Text style={styles.check}>{checked ? '☑' : '☐'}</Text>
            <Text style={styles.name}>{food.name}</Text>
            <Text style={styles.meta}>{food.sourceKcal} kcal</Text>
          </Pressable>
        );
      })}
      <MfpButton label={t('common.save')} onPress={() => void save()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md },
  label: { color: theme.colors.textMuted, fontWeight: '600', marginBottom: theme.space.sm },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  check: { fontSize: 20, marginRight: theme.space.sm },
  name: { flex: 1, color: theme.colors.text, fontWeight: '600' },
  meta: { color: theme.colors.textMuted },
});
