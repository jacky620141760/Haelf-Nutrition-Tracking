import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import { createWaterEntry, deleteWaterEntry, listWaterEntriesByDate } from '@/src/db/repositories/water';
import { getTimeZoneMetadata, utcNowIso } from '@/src/domain/dates';
import { isValidWaterMl, waterToMl } from '@/src/domain/water';
import type { WaterEntry, WaterUnit } from '@/src/domain/types';
import { Field, MfpButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function WaterScreen() {
  const { selectedDate, preferences, updatePreferences, bumpRefresh, refreshToken, t } = useApp();
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [amount, setAmount] = useState('');

  const load = useCallback(async () => {
    setEntries(await listWaterEntriesByDate(selectedDate));
  }, [selectedDate]);
  useFocusEffect(useCallback(() => { void load(); }, [load, refreshToken]));

  const addMl = async (ml: number) => {
    if (!isValidWaterMl(ml)) {
      Alert.alert(t('validation.outOfRange'));
      return;
    }
    const now = new Date();
    const tz = getTimeZoneMetadata(now);
    await createWaterEntry({
      ml,
      utcTimestamp: utcNowIso(now),
      localDate: selectedDate,
      tzIana: tz.iana,
      tzOffsetMinutes: tz.utcOffsetMinutes,
    });
    setAmount('');
    bumpRefresh();
    await load();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={t('habits.water')} />
      <Text style={styles.date}>{selectedDate}</Text>
      <View style={styles.quick}>
        {[250, 350, 500].map((ml) => (
          <Pressable key={ml} style={styles.quickButton} onPress={() => void addMl(ml)} accessibilityRole="button">
            <Text style={styles.quickText}>+ {ml} ml</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.units}>
        {(['ml', 'cup', 'oz'] as WaterUnit[]).map((unit) => (
          <Pressable
            key={unit}
            style={[styles.unit, preferences.waterUnit === unit && styles.unitOn]}
            onPress={() => void updatePreferences({ waterUnit: unit })}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferences.waterUnit === unit }}
          >
            <Text style={styles.unitText}>{unit}</Text>
          </Pressable>
        ))}
      </View>
      <Field
        label={`${t('habits.addWater')} (${preferences.waterUnit})`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <MfpButton
        label={t('common.add')}
        onPress={() => void addMl(waterToMl(Number(amount), preferences.waterUnit))}
      />
      <View style={styles.list}>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.row}>
            <Text style={styles.value}>{Math.round(entry.ml)} ml</Text>
            <Pressable
              onPress={async () => {
                await deleteWaterEntry(entry.id);
                bumpRefresh();
                await load();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.delete}>{t('common.delete')}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md },
  date: { color: theme.colors.textMuted, marginBottom: theme.space.md },
  quick: { flexDirection: 'row', gap: theme.space.sm, marginBottom: theme.space.md },
  quickButton: { flex: 1, minHeight: theme.minTouch, borderRadius: theme.radius, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  quickText: { color: '#0369A1', fontWeight: '700' },
  units: { flexDirection: 'row', gap: theme.space.sm, marginBottom: theme.space.md },
  unit: { flex: 1, minHeight: theme.minTouch, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, alignItems: 'center', justifyContent: 'center' },
  unitOn: { backgroundColor: theme.colors.skyBlue, borderColor: theme.colors.lakeBlue },
  unitText: { color: theme.colors.text, fontWeight: '600' },
  list: { marginTop: theme.space.lg },
  row: { minHeight: theme.minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  value: { color: theme.colors.text, fontWeight: '700' },
  delete: { color: theme.colors.danger, fontWeight: '600' },
});
