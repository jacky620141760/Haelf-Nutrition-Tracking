import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { FoodCatalogItem, Recipe, SavedMeal } from '@/src/domain/types';
import { listCatalog } from '@/src/db/repositories/food';
import { listSavedMeals } from '@/src/db/repositories/savedMeals';
import { listRecipes } from '@/src/db/repositories/recipes';
import { setPendingDraft } from '@/src/services/draftStore';
import { useApp } from '@/src/context/AppContext';
import { MfpButton, MfpCard, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

type Tab = 'foods' | 'meals' | 'recipes';

export default function LibraryScreen() {
  const router = useRouter();
  const { t, refreshToken } = useApp();
  const [tab, setTab] = useState<Tab>('foods');
  const [search, setSearch] = useState('');
  const [foods, setFoods] = useState<FoodCatalogItem[]>([]);
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const load = useCallback(async () => {
    const [nextFoods, nextMeals, nextRecipes] = await Promise.all([
      listCatalog(search),
      listSavedMeals(),
      listRecipes(),
    ]);
    setFoods(nextFoods);
    setMeals(nextMeals.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())));
    setRecipes(nextRecipes.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())));
  }, [search]);

  useFocusEffect(useCallback(() => { void load(); }, [load, refreshToken]));

  const addFood = (item: FoodCatalogItem) => {
    setPendingDraft({
      name: item.name,
      mealType: 'snack',
      basis: item.basis,
      sourceKcal: item.sourceKcal,
      sourceProteinG: item.sourceProteinG,
      sourceFatG: item.sourceFatG,
      sourceCarbsG: item.sourceCarbsG,
      quantity: item.basis === 'PER_100_G' ? 100 : 1,
      source: 'manual',
      catalogId: item.id,
      barcode: item.barcode,
      dataQualityWarnings: [],
    });
    router.push('/food/add');
  };

  const visible = tab === 'foods' ? foods : tab === 'meals' ? meals : recipes;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle title={t('library.title')} />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('common.search')}
        placeholderTextColor={theme.colors.textMute}
        style={styles.search}
        accessibilityLabel={t('common.search')}
      />
      <View style={styles.tabs} accessibilityRole="tablist">
        {([
          ['foods', t('library.myFoods')],
          ['meals', t('library.meals')],
          ['recipes', t('library.recipes')],
        ] as const).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.tab, tab === key && styles.tabOn]}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'meals' ? (
        <MfpButton label={t('library.createMeal')} onPress={() => router.push('/library/meal/new' as never)} />
      ) : tab === 'recipes' ? (
        <MfpButton label={t('library.createRecipe')} onPress={() => router.push('/library/recipe/new' as never)} />
      ) : null}
      <View style={{ height: theme.space.sm }} />

      {visible.length === 0 ? <Text style={styles.empty}>{t('library.empty')}</Text> : null}
      {tab === 'foods'
        ? foods.map((item) => (
          <MfpCard key={item.id}>
            <Pressable onPress={() => addFood(item)} accessibilityRole="button">
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.sourceKcal} kcal · {item.basis === 'PER_100_G' ? '100 g' : '1 serving'}</Text>
            </Pressable>
          </MfpCard>
        ))
        : tab === 'meals'
          ? meals.map((item) => (
            <MfpCard key={item.id}>
              <Pressable onPress={() => router.push(`/library/meal/${item.id}` as never)} accessibilityRole="button">
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.items.length} items</Text>
              </Pressable>
            </MfpCard>
          ))
          : recipes.map((item) => (
            <MfpCard key={item.id}>
              <Pressable onPress={() => router.push(`/library/recipe/${item.id}` as never)} accessibilityRole="button">
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.totalServings} servings · {item.ingredients.length} ingredients</Text>
              </Pressable>
            </MfpCard>
          ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md, paddingBottom: theme.space.xl },
  search: {
    minHeight: theme.minTouch,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    backgroundColor: theme.colors.bg,
    color: theme.colors.text,
    paddingHorizontal: theme.space.md,
    marginBottom: theme.space.md,
  },
  tabs: { flexDirection: 'row', gap: theme.space.xs, marginBottom: theme.space.md },
  tab: { flex: 1, minHeight: theme.minTouch, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius },
  tabOn: { backgroundColor: theme.colors.skyBlue },
  tabText: { color: theme.colors.textMuted, fontWeight: '600' },
  tabTextOn: { color: theme.colors.lakeBlue },
  name: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '700' },
  meta: { color: theme.colors.textMuted, marginTop: theme.space.xs, fontSize: theme.font.bodySmall },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginVertical: theme.space.lg },
});
