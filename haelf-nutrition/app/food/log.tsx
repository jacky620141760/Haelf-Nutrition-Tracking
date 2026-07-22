import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import type { FoodCatalogItem, MealType, Recipe, SavedMeal } from '@/src/domain/types';
import { listCatalog, listFavorites, listRecent } from '@/src/db/repositories/food';
import { listSavedMeals } from '@/src/db/repositories/savedMeals';
import { listRecipes } from '@/src/db/repositories/recipes';
import { setPendingDraft } from '@/src/services/draftStore';
import { searchOpenFoodFacts, type OffSearchHit } from '@/src/services/off';
import { MealPicker } from '@/src/components/Pickers';
import { MfpCard, SectionTitle } from '@/src/components/ui';
import { useApp } from '@/src/context/AppContext';
import { theme } from '@/src/theme';

type Tab = 'history' | 'foods' | 'database' | 'meals' | 'recipes';

export default function FoodLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string }>();
  const { t, refreshToken } = useApp();
  const initialMeal = ['breakfast', 'lunch', 'dinner', 'snack'].includes(params.meal ?? '')
    ? (params.meal as MealType)
    : 'snack';
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [tab, setTab] = useState<Tab>('history');
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<FoodCatalogItem[]>([]);
  const [foods, setFoods] = useState<FoodCatalogItem[]>([]);
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [dbHits, setDbHits] = useState<OffSearchHit[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');
  const searchController = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const [favorites, recent, catalog, saved, recipeList] = await Promise.all([
      listFavorites(),
      listRecent(30),
      listCatalog(search),
      listSavedMeals(),
      listRecipes(),
    ]);
    const seen = new Set<number>();
    setHistory([...favorites, ...recent].filter((item) => !seen.has(item.id) && !!seen.add(item.id)));
    setFoods(catalog);
    setMeals(saved);
    setRecipes(recipeList);
  }, [search]);

  useFocusEffect(useCallback(() => { void load(); }, [load, refreshToken]));

  useEffect(() => {
    if (tab !== 'database') return;
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      searchController.current?.abort();
      setDbHits([]);
      setDbError('');
      setDbLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        searchController.current?.abort();
        const controller = new AbortController();
        searchController.current = controller;
        setDbLoading(true);
        setDbError('');
        const net = await NetInfo.fetch();
        if (!net.isConnected) {
          setDbLoading(false);
          setDbHits([]);
          setDbError(t('foodHub.offlineDatabase'));
          return;
        }
        const result = await searchOpenFoodFacts(trimmed, meal, controller.signal);
        if (controller.signal.aborted) return;
        setDbLoading(false);
        if (!result.ok) {
          if (result.reason === 'cancelled') return;
          setDbHits([]);
          setDbError(
            result.reason === 'server_busy'
              ? t('foodHub.serverBusy')
              : result.reason === 'timeout'
                ? t('foodHub.searchTimeout')
                : result.reason === 'unavailable'
                  ? t('foodHub.searchUnavailable')
                  : /failed to fetch/i.test(result.message)
                    ? t('foodHub.searchNetwork')
                    : result.message
          );
          return;
        }
        setDbHits(result.hits);
        if (!result.hits.length) setDbError(t('foodHub.noDatabaseResults'));
      })();
    }, 500);

    return () => {
      clearTimeout(timer);
      searchController.current?.abort();
    };
  }, [search, tab, meal, t]);

  useEffect(() => () => searchController.current?.abort(), []);

  const selectFood = (item: FoodCatalogItem) => {
    setPendingDraft({
      name: item.name,
      mealType: meal,
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
    router.push(`/food/add?meal=${meal}` as never);
  };

  const selectDatabaseHit = (hit: OffSearchHit) => {
    setPendingDraft({ ...hit.draft, mealType: meal });
    router.push(`/food/add?meal=${meal}` as never);
  };

  const filteredHistory = useMemo(
    () => history.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())),
    [history, search]
  );
  const visibleFoods = tab === 'history' ? filteredHistory : foods;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle title={t('foodHub.title')} />
      <MealPicker value={meal} onChange={setMeal} />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={tab === 'database' ? t('foodHub.databaseHint') : t('common.search')}
        placeholderTextColor={theme.colors.textMute}
        style={styles.search}
      />
      <View style={styles.actions}>
        {[
          [t('foodHub.quickAdd'), () => router.push(`/food/add?meal=${meal}` as never)],
          [t('diary.barcode'), () => router.push(`/food/scan?meal=${meal}` as never)],
          [t('diary.ai'), () => router.push(`/food/ai?meal=${meal}` as never)],
          [t('foodHub.createFood'), () => router.push(`/food/add?meal=${meal}` as never)],
        ].map(([label, action]) => (
          <Pressable key={label as string} style={styles.action} onPress={action as () => void} accessibilityRole="button">
            <Text style={styles.actionText}>{label as string}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabs}>
        {([
          ['history', t('foodHub.history')],
          ['foods', t('foodHub.myFoods')],
          ['database', t('foodHub.database')],
          ['meals', t('foodHub.meals')],
          ['recipes', t('foodHub.recipes')],
        ] as const).map(([key, label]) => (
          <Pressable key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => setTab(key)} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'database' ? (
        <>
          {search.trim().length < 2 ? (
            <Text style={styles.hint}>{t('foodHub.searchMinChars')}</Text>
          ) : null}
          {dbLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.colors.lakeBlue} />
              <Text style={styles.hint}>{t('foodHub.searching')}</Text>
            </View>
          ) : null}
          {dbError ? <Text style={styles.error}>{dbError}</Text> : null}
          {dbHits.map((hit) => (
            <MfpCard key={hit.barcode}>
              <Pressable onPress={() => selectDatabaseHit(hit)} accessibilityRole="button">
                <Text style={styles.name}>{hit.name}</Text>
                <Text style={styles.meta}>{hit.nutritionLabel}</Text>
              </Pressable>
            </MfpCard>
          ))}
        </>
      ) : (tab === 'history' || tab === 'foods')
        ? visibleFoods.map((item) => (
            <MfpCard key={item.id}>
              <Pressable onPress={() => selectFood(item)} accessibilityRole="button">
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.sourceKcal} kcal</Text>
              </Pressable>
            </MfpCard>
          ))
        : tab === 'meals'
          ? meals.map((item) => (
              <MfpCard key={item.id}>
                <Pressable onPress={() => router.push(`/library/meal/${item.id}?meal=${meal}` as never)} accessibilityRole="button">
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.items.length}</Text>
                </Pressable>
              </MfpCard>
            ))
          : recipes.map((item) => (
              <MfpCard key={item.id}>
                <Pressable onPress={() => router.push(`/library/recipe/${item.id}?meal=${meal}` as never)} accessibilityRole="button">
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.totalServings}</Text>
                </Pressable>
              </MfpCard>
            ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md, paddingBottom: theme.space.xl },
  search: { minHeight: theme.minTouch, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, backgroundColor: theme.colors.bg, color: theme.colors.text, paddingHorizontal: theme.space.md, marginVertical: theme.space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm, marginBottom: theme.space.md },
  action: { width: '48%', minHeight: theme.minTouch, borderRadius: theme.radius, backgroundColor: theme.colors.skyBlue, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: theme.colors.lakeBlue, fontWeight: '700', textAlign: 'center' },
  tabScroll: { marginBottom: theme.space.md, flexGrow: 0 },
  tabs: { flexDirection: 'row', gap: theme.space.sm, paddingRight: theme.space.md },
  tab: { minHeight: theme.minTouch, paddingHorizontal: theme.space.md, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: theme.colors.border },
  tabOn: { borderBottomColor: theme.colors.lakeBlue },
  tabText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  tabTextOn: { color: theme.colors.lakeBlue },
  name: { color: theme.colors.text, fontWeight: '700' },
  meta: { color: theme.colors.textMuted, marginTop: 4 },
  hint: { color: theme.colors.textMuted, textAlign: 'center', marginVertical: theme.space.md },
  error: { color: theme.colors.danger, textAlign: 'center', marginBottom: theme.space.md },
  centered: { alignItems: 'center', gap: theme.space.sm, marginVertical: theme.space.md },
});
