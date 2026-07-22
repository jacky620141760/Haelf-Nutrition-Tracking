import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { MealType, Recipe } from '@/src/domain/types';
import { deleteRecipe, getRecipe, saveRecipe } from '@/src/db/repositories/recipes';
import { recipePerServing } from '@/src/domain/recipes';
import { logRecipe } from '@/src/services/logRecipe';
import { useApp } from '@/src/context/AppContext';
import { MealPicker } from '@/src/components/Pickers';
import { Field, MfpButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function RecipeDetailScreen() {
  const params = useLocalSearchParams<{ id: string; meal?: string }>();
  const router = useRouter();
  const { selectedDate, bumpRefresh, t } = useApp();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [name, setName] = useState('');
  const [totalServings, setTotalServings] = useState('');
  const [logServings, setLogServings] = useState('1');
  const [meal, setMeal] = useState<MealType>(
    ['breakfast', 'lunch', 'dinner', 'snack'].includes(params.meal ?? '')
      ? (params.meal as MealType)
      : 'snack'
  );
  useEffect(() => {
    void getRecipe(Number(params.id)).then((value) => {
      setRecipe(value);
      setName(value?.name ?? '');
      setTotalServings(value ? String(value.totalServings) : '');
    });
  }, [params.id]);
  if (!recipe) return <View style={styles.center}><Text>{t('common.loading')}</Text></View>;
  const perServing = recipePerServing(recipe.ingredients, recipe.totalServings);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={recipe.name} />
      <Field label={t('recipe.name')} value={name} onChangeText={setName} />
      <Field label={t('recipe.totalServings')} value={totalServings} onChangeText={setTotalServings} keyboardType="decimal-pad" />
      <MfpButton
        label={t('common.save')}
        variant="outline"
        onPress={async () => {
          await saveRecipe({
            name,
            totalServings: Number(totalServings),
            photoUri: recipe.photoUri,
            ingredients: recipe.ingredients.map(({ id: _id, recipeId: _parent, ...ingredient }) => ingredient),
          }, recipe.id);
          bumpRefresh();
          setRecipe(await getRecipe(recipe.id));
        }}
      />
      <View style={{ height: theme.space.md }} />
      {recipe.ingredients.map((ingredient) => (
        <View key={ingredient.id} style={styles.row}>
          <Text style={styles.name}>{ingredient.name}</Text>
          <Text style={styles.meta}>{ingredient.quantity}</Text>
        </View>
      ))}
      {perServing ? (
        <Text style={styles.summary}>
          {Math.round(perServing.kcal)} kcal
        </Text>
      ) : null}
      <MealPicker value={meal} onChange={setMeal} />
      <Field label={t('recipe.servingsToLog')} value={logServings} onChangeText={setLogServings} keyboardType="decimal-pad" />
      <MfpButton
        label={t('library.log')}
        onPress={async () => {
          const result = await logRecipe(recipe.id, { localDate: selectedDate, mealType: meal, servings: Number(logServings) });
          if (!result.ok) Alert.alert(result.errors.join('\n'));
          else {
            bumpRefresh();
            router.replace('/');
          }
        }}
      />
      <View style={{ height: theme.space.sm }} />
      <MfpButton label={t('common.delete')} danger onPress={async () => {
        await deleteRecipe(recipe.id);
        bumpRefresh();
        router.back();
      }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { paddingVertical: theme.space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  name: { color: theme.colors.text, fontWeight: '700' },
  meta: { color: theme.colors.textMuted },
  summary: { color: theme.colors.text, fontWeight: '700', marginVertical: theme.space.md },
});
