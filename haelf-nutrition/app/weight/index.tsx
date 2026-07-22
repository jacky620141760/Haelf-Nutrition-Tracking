import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import {
  createWeightEntry,
  deleteWeightEntry,
  listWeightsByDate,
  updateWeightEntry,
} from '@/src/db/repositories/weight';
import { getTimeZoneMetadata, toLocalDateString, utcNowIso, addLocalDays } from '@/src/domain/dates';
import { displayWeightKg } from '@/src/domain/nutrition';
import { parseFiniteNumber, validateWeightKg } from '@/src/domain/validation';
import type { WeightEntry } from '@/src/domain/types';
import { Field, MfpButton, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

export default function WeightScreen() {
  const { selectedDate, setSelectedDate, bumpRefresh, refreshToken } = useApp();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [kg, setKg] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<WeightEntry | null>(null);

  const load = useCallback(async () => {
    setEntries(await listWeightsByDate(selectedDate));
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, refreshToken])
  );

  useEffect(() => {
    setEditing(null);
    setKg('');
    setError('');
  }, [selectedDate]);

  const onSubmit = async () => {
    const value = parseFiniteNumber(kg);
    const err = validateWeightKg(value);
    if (err || value == null) {
      setError(err?.message ?? zhTW.validation.invalidNumber);
      return;
    }
    setError('');
    if (editing) {
      await updateWeightEntry(editing.id, {
        kg: value,
        utcTimestamp: editing.utcTimestamp,
        localDate: editing.localDate,
        tzIana: editing.tzIana,
        tzOffsetMinutes: editing.tzOffsetMinutes,
      });
      setEditing(null);
    } else {
      const now = new Date();
      const tz = getTimeZoneMetadata(now);
      await createWeightEntry({
        kg: value,
        utcTimestamp: utcNowIso(now),
        localDate: selectedDate || toLocalDateString(now),
        tzIana: tz.iana,
        tzOffsetMinutes: tz.utcOffsetMinutes,
      });
    }
    setKg('');
    bumpRefresh();
    load();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={zhTW.weight.title} />
      <View style={styles.dateRow}>
        <Pressable
          style={styles.dateBtn}
          onPress={() => setSelectedDate(addLocalDays(selectedDate, -1))}
          accessibilityLabel="前一日"
        >
          <Text style={styles.dateBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.dateText}>{selectedDate}</Text>
        <Pressable
          style={styles.dateBtn}
          onPress={() => setSelectedDate(addLocalDays(selectedDate, 1))}
          accessibilityLabel="後一日"
        >
          <Text style={styles.dateBtnText}>›</Text>
        </Pressable>
      </View>

      <Field
        label={zhTW.weight.kg}
        value={kg}
        onChangeText={setKg}
        keyboardType="decimal-pad"
        error={error}
      />
      <PrimaryButton
        label={editing ? '儲存體重修改' : zhTW.weight.add}
        onPress={onSubmit}
      />
      {editing ? (
        <>
          <View style={{ height: theme.space.sm }} />
          <MfpButton
            label={zhTW.common.cancel}
            variant="outline"
            onPress={() => {
              setEditing(null);
              setKg('');
              setError('');
            }}
          />
        </>
      ) : null}

      <View style={{ height: theme.space.lg }} />
      {entries.length === 0 ? (
        <Text style={styles.empty}>{zhTW.weight.empty}</Text>
      ) : (
        entries.map((e) => (
          <View key={e.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kg}>{displayWeightKg(e.kg)} kg</Text>
              <Text style={styles.meta}>{e.utcTimestamp}</Text>
            </View>
            <Pressable
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel={`${zhTW.common.edit} ${displayWeightKg(e.kg)} 公斤`}
              onPress={() => {
                setEditing(e);
                setKg(String(e.kg));
                setError('');
              }}
            >
              <Text style={styles.editText}>{zhTW.common.edit}</Text>
            </Pressable>
            <Pressable
              style={styles.del}
              accessibilityRole="button"
              accessibilityLabel={`${zhTW.common.delete} ${displayWeightKg(e.kg)} 公斤`}
              onPress={() =>
                Alert.alert(zhTW.weight.deleteConfirmTitle, zhTW.weight.deleteConfirmMessage, [
                  { text: zhTW.common.cancel, style: 'cancel' },
                  {
                    text: zhTW.common.delete,
                    style: 'destructive',
                    onPress: async () => {
                      await deleteWeightEntry(e.id);
                      bumpRefresh();
                      load();
                    },
                  },
                ])
              }
            >
              <Text style={styles.delText}>{zhTW.common.delete}</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.space.md },
  dateBtn: {
    minWidth: theme.minTouch,
    minHeight: theme.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnText: { fontSize: 28, color: theme.colors.lakeBlue, fontWeight: '700' },
  dateText: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: theme.font.body, color: theme.colors.text },
  empty: { textAlign: 'center', color: theme.colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.space.sm,
    minHeight: theme.minTouch,
  },
  kg: { fontWeight: '700', fontSize: theme.font.body, color: theme.colors.text, fontVariant: ['tabular-nums'] },
  meta: { color: theme.colors.textMuted, fontSize: theme.font.small },
  del: { minWidth: theme.minTouch, minHeight: theme.minTouch, justifyContent: 'center' },
  action: { minWidth: theme.minTouch, minHeight: theme.minTouch, justifyContent: 'center' },
  editText: { color: theme.colors.lakeBlue, fontWeight: '600' },
  delText: { color: theme.colors.danger, fontWeight: '600' },
});
