import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import {
  createExerciseEntry,
  deleteExerciseEntry,
  listExerciseEntriesByDate,
  updateExerciseEntry,
} from '@/src/db/repositories/exercise';
import { getTimeZoneMetadata, utcNowIso } from '@/src/domain/dates';
import { isValidExercise } from '@/src/domain/exercise';
import type { ExerciseEntry } from '@/src/domain/types';
import { Field, MfpButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function ExerciseScreen() {
  const { selectedDate, bumpRefresh, refreshToken, t } = useApp();
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [editing, setEditing] = useState<ExerciseEntry | null>(null);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [kcal, setKcal] = useState('');

  const load = useCallback(async () => {
    setEntries(await listExerciseEntriesByDate(selectedDate));
  }, [selectedDate]);
  useFocusEffect(useCallback(() => { void load(); }, [load, refreshToken]));

  const clear = () => {
    setEditing(null);
    setName('');
    setMinutes('');
    setKcal('');
  };

  const save = async () => {
    const values = {
      name,
      durationMinutes: Number(minutes),
      burnedKcal: Number(kcal),
    };
    if (!isValidExercise(values)) {
      Alert.alert(t('validation.outOfRange'));
      return;
    }
    if (editing) {
      await updateExerciseEntry(editing.id, {
        ...values,
        utcTimestamp: editing.utcTimestamp,
        localDate: editing.localDate,
        tzIana: editing.tzIana,
        tzOffsetMinutes: editing.tzOffsetMinutes,
      });
    } else {
      const now = new Date();
      const tz = getTimeZoneMetadata(now);
      await createExerciseEntry({
        ...values,
        utcTimestamp: utcNowIso(now),
        localDate: selectedDate,
        tzIana: tz.iana,
        tzOffsetMinutes: tz.utcOffsetMinutes,
      });
    }
    clear();
    bumpRefresh();
    await load();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle title={t('habits.exercise')} />
      <Text style={styles.date}>{selectedDate}</Text>
      <Field label={t('exercise.name')} value={name} onChangeText={setName} />
      <Field label={t('exercise.duration')} value={minutes} onChangeText={setMinutes} keyboardType="decimal-pad" />
      <Field label={t('exercise.burned')} value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" />
      <MfpButton label={editing ? t('common.save') : t('common.add')} onPress={() => void save()} />
      {editing ? (
        <>
          <View style={{ height: theme.space.sm }} />
          <MfpButton label={t('common.cancel')} variant="outline" onPress={clear} />
        </>
      ) : null}
      <View style={styles.list}>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.row}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => {
                setEditing(entry);
                setName(entry.name);
                setMinutes(String(entry.durationMinutes));
                setKcal(String(entry.burnedKcal));
              }}
              accessibilityRole="button"
            >
              <Text style={styles.name}>{entry.name}</Text>
              <Text style={styles.meta}>{entry.durationMinutes} {t('exercise.minutesShort')} · {entry.burnedKcal} kcal</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                await deleteExerciseEntry(entry.id);
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
  list: { marginTop: theme.space.lg },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  name: { color: theme.colors.text, fontWeight: '700' },
  meta: { color: theme.colors.textMuted, marginTop: 3 },
  delete: { color: theme.colors.danger, fontWeight: '600', padding: theme.space.sm },
});
