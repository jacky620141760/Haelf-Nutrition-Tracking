import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import {
  deleteCatalogItem,
  listFavorites,
  listRecent,
  setCatalogFavorite,
} from '@/src/db/repositories/food';
import type { FoodCatalogItem, MealType, NutritionBasis } from '@/src/domain/types';
import { collectDataQualityWarnings } from '@/src/domain/quality';
import { displayNutrients } from '@/src/domain/nutrition';
import { validateFoodDraft } from '@/src/domain/validation';
import { confirmFoodDraft } from '@/src/services/confirmFood';
import { consumePendingDraft, emptyDraft } from '@/src/services/draftStore';
import { BasisPicker, MealPicker } from '@/src/components/Pickers';
import { Field, MfpButton, PrimaryButton } from '@/src/components/ui';
import { NutritionInputFields } from '@/src/components/nutrition/NutritionInputFields';
import { useFoodNutrientForm } from '@/src/hooks/useFoodNutrientForm';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

export default function AddFoodScreen() {
  const router = useRouter();
  const { selectedDate, bumpRefresh } = useApp();
  const params = useLocalSearchParams<{ tab?: string; meal?: string }>();
  const initialMeal = (['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).includes(
    params.meal as MealType
  )
    ? (params.meal as MealType)
    : 'lunch';
  const [tab, setTab] = useState<'form' | 'favorites' | 'recent'>(
    params.tab === 'favorites' ? 'favorites' : 'form'
  );
  const form = useFoodNutrientForm(emptyDraft(initialMeal));
  const {
    draft,
    setDraft,
    name,
    setName,
    kcal,
    protein,
    fat,
    carbs,
    quantity,
    setQuantity,
    errors,
    kcalMode,
    preview,
  } = form;
  const [warnings, setWarnings] = useState<string[]>([]);
  const [needQualityConfirm, setNeedQualityConfirm] = useState(false);
  const [qualityConfirmed, setQualityConfirmed] = useState(false);
  const [favorites, setFavorites] = useState<FoodCatalogItem[]>([]);
  const [recent, setRecent] = useState<FoodCatalogItem[]>([]);

  const applyFoodDraft = (d: ReturnType<typeof form.buildDraft>) => {
    form.applyDraft(d);
    setWarnings(d.dataQualityWarnings);
    setNeedQualityConfirm(d.dataQualityWarnings.length > 0);
    setQualityConfirmed(false);
    setTab('form');
  };

  useEffect(() => {
    const pending = consumePendingDraft();
    if (pending) applyFoodDraft(pending);
  }, []);

  useEffect(() => {
    (async () => {
      setFavorites(await listFavorites());
      setRecent(await listRecent(20));
    })();
  }, [tab]);

  useEffect(() => {
    setQualityConfirmed(false);
  }, [name, kcal, protein, fat, carbs, quantity, draft.basis]);

  const buildDraftFromForm = () => {
    const d = form.buildDraft();
    d.dataQualityWarnings = collectDataQualityWarnings(d);
    return d;
  };

  const onConfirm = async () => {
    const d = buildDraftFromForm();
    const errs = validateFoodDraft({
      name: d.name,
      basis: d.basis,
      sourceKcal: d.sourceKcal,
      sourceProteinG: d.sourceProteinG,
      sourceFatG: d.sourceFatG,
      sourceCarbsG: d.sourceCarbsG,
      quantity: d.quantity,
    });
    form.setValidationErrors(errs);
    setWarnings(d.dataQualityWarnings);
    if (errs.length) return;
    if (d.dataQualityWarnings.length && !qualityConfirmed) {
      setNeedQualityConfirm(true);
      Alert.alert(zhTW.food.qualityWarning, d.dataQualityWarnings.join('\n'));
      return;
    }
    const result = await confirmFoodDraft(d, { localDate: selectedDate });
    if (!result.ok) {
      Alert.alert('驗證失敗', result.errors.join('\n'));
      return;
    }
    bumpRefresh();
    router.back();
  };

  const pickCatalog = (item: FoodCatalogItem) => {
    applyFoodDraft({
      name: item.name,
      mealType: draft.mealType,
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
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.tabs}>
        {(['form', 'favorites', 'recent'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={styles.tabText}>
              {t === 'form' ? zhTW.diary.manual : t === 'favorites' ? zhTW.diary.favorites : zhTW.diary.recent}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'favorites' || tab === 'recent' ? (
        <View>
          {(tab === 'favorites' ? favorites : recent).map((item) => (
            <View key={item.id} style={styles.catalogRow}>
              <Pressable
                style={{ flex: 1, minHeight: theme.minTouch, justifyContent: 'center' }}
                onPress={() => pickCatalog(item)}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                accessibilityHint="建立可編輯草稿"
              >
                <Text style={styles.catalogName}>{item.name}</Text>
                <Text style={styles.catalogMeta}>
                  {item.basis === 'PER_100_G' ? zhTW.food.per100g : zhTW.food.perServing} · {item.sourceKcal} kcal
                </Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await setCatalogFavorite(item.id, !item.isFavorite);
                  setFavorites(await listFavorites());
                  setRecent(await listRecent(20));
                }}
                accessibilityRole="button"
                accessibilityLabel={item.isFavorite ? zhTW.food.unfavorite : zhTW.food.favorite}
                style={styles.favBtn}
              >
                <Text>{item.isFavorite ? '★' : '☆'}</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  Alert.alert(zhTW.common.delete, item.name, [
                    { text: zhTW.common.cancel, style: 'cancel' },
                    {
                      text: zhTW.common.delete,
                      style: 'destructive',
                      onPress: async () => {
                        await deleteCatalogItem(item.id);
                        setFavorites(await listFavorites());
                        setRecent(await listRecent(20));
                      },
                    },
                  ])
                }
                style={styles.favBtn}
                accessibilityLabel={`${zhTW.common.delete} ${item.name}`}
              >
                <Text style={{ color: theme.colors.danger }}>刪</Text>
              </Pressable>
            </View>
          ))}
          {(tab === 'favorites' ? favorites : recent).length === 0 ? (
            <Text style={styles.empty}>尚無項目</Text>
          ) : null}
        </View>
      ) : (
        <View>
          {draft.source !== 'manual' ? (
            <Text style={styles.source}>
              {zhTW.food.source}：
              {draft.source === 'ai'
                ? zhTW.food.sourceAi
                : draft.source === 'off'
                  ? zhTW.food.sourceOff
                  : draft.source === 'cache'
                    ? zhTW.food.sourceCache
                    : zhTW.food.sourceManual}
              {draft.confidence != null ? ` · ${zhTW.food.confidence} ${draft.confidence}` : ''}
            </Text>
          ) : null}
          <Field label={zhTW.food.name} value={name} onChangeText={setName} error={errors.name} />
          <Text style={styles.label}>{zhTW.food.mealType}</Text>
          <MealPicker
            value={draft.mealType}
            onChange={(mealType: MealType) => setDraft((d) => ({ ...d, mealType }))}
          />
          <Text style={styles.label}>{zhTW.food.basis}</Text>
          <BasisPicker
            value={draft.basis}
            onChange={(basis: NutritionBasis) => setDraft((d) => ({ ...d, basis }))}
          />
          <NutritionInputFields
            kcal={kcal}
            protein={protein}
            fat={fat}
            carbs={carbs}
            mode={kcalMode}
            errors={errors}
            onKcalChange={form.onKcalChange}
            onProteinChange={form.onProteinChange}
            onFatChange={form.onFatChange}
            onCarbsChange={form.onCarbsChange}
            onRelink={form.relinkKcal}
          />
          <Field
            label={draft.basis === 'PER_100_G' ? zhTW.food.quantityG : zhTW.food.quantityServing}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            error={errors.quantity}
          />
          {preview ? (
            <Text style={styles.preview}>
              {zhTW.diary.intake}：{displayNutrients(preview).kcal} kcal · P
              {displayNutrients(preview).protein_g} F{displayNutrients(preview).fat_g} C
              {displayNutrients(preview).carbs_g}
            </Text>
          ) : null}
          {warnings.length ? (
            <View style={styles.warnBox} accessibilityRole="alert">
              <Text style={styles.warnTitle}>⚠ {zhTW.food.qualityWarning}</Text>
              {warnings.map((w) => (
                <Text key={w} style={styles.warnText}>
                  {w}
                </Text>
              ))}
              {needQualityConfirm ? (
                <Pressable
                  onPress={() => setQualityConfirmed((v) => !v)}
                  style={styles.checkRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: qualityConfirmed }}
                  accessibilityLabel={zhTW.food.qualityConfirm}
                >
                  <Text>{qualityConfirmed ? '☑' : '☐'} {zhTW.food.qualityConfirm}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <PrimaryButton label={zhTW.food.confirmDraft} onPress={onConfirm} />
          <View style={{ height: theme.space.md }} />
          <MfpButton label={zhTW.common.cancel} variant="outline" onPress={() => router.back()} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md, paddingBottom: theme.space.xl },
  tabs: { flexDirection: 'row', gap: theme.space.sm, marginBottom: theme.space.md },
  tab: {
    flex: 1,
    minHeight: theme.minTouch,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  tabOn: { backgroundColor: theme.colors.skyBlue, borderColor: theme.colors.lakeBlue },
  tabText: { fontWeight: '600', fontSize: theme.font.small, color: theme.colors.textMuted },
  label: { marginBottom: theme.space.xs, color: theme.colors.textMuted, fontSize: theme.font.small },
  source: { marginBottom: theme.space.md, color: theme.colors.lakeBlue, fontWeight: '600' },
  preview: {
    marginBottom: theme.space.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  warnBox: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.space.md,
    borderRadius: theme.radius,
    marginBottom: theme.space.md,
  },
  warnTitle: { fontWeight: '700', color: theme.colors.warning, marginBottom: 4 },
  warnText: { color: theme.colors.warning },
  checkRow: { marginTop: theme.space.sm, minHeight: theme.minTouch, justifyContent: 'center' },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.space.sm,
    minHeight: 56,
  },
  catalogName: { fontWeight: '600', color: theme.colors.text },
  catalogMeta: { color: theme.colors.textMuted, fontSize: theme.font.small },
  favBtn: { minWidth: theme.minTouch, minHeight: theme.minTouch, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: theme.space.lg },
});
