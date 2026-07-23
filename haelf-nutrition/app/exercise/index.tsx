import { useCallback, useMemo, useState } from 'react';
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
import {
  CARDIO_DURATION_PRESETS,
  STRENGTH_SET_PRESETS,
  estimateCardioKcal,
  estimateStrengthKcal,
  formatStrengthName,
  inferExerciseKind,
  isValidExercise,
  isValidStrengthSets,
  parseStrengthSets,
  strengthDurationMinutes,
  totalExerciseKcal,
  type ExerciseKind,
} from '@/src/domain/exercise';
import type { ExerciseEntry } from '@/src/domain/types';
import { Field, MfpButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function ExerciseScreen() {
  const { selectedDate, bumpRefresh, refreshToken, t } = useApp();
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [editing, setEditing] = useState<ExerciseEntry | null>(null);
  const [kind, setKind] = useState<ExerciseKind>('cardio');
  const [minutes, setMinutes] = useState('30');
  const [sets, setSets] = useState('12');

  const kindLabel = useCallback(
    (k: ExerciseKind) => (k === 'cardio' ? t('exercise.cardio') : t('exercise.strength')),
    [t]
  );

  const estimatedKcal = useMemo(() => {
    if (kind === 'strength') return estimateStrengthKcal(Number(sets));
    return estimateCardioKcal(Number(minutes));
  }, [kind, minutes, sets]);

  const dayTotal = useMemo(() => totalExerciseKcal(entries), [entries]);

  const load = useCallback(async () => {
    setEntries(await listExerciseEntriesByDate(selectedDate));
  }, [selectedDate]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, refreshToken])
  );

  const clear = () => {
    setEditing(null);
    setKind('cardio');
    setMinutes('30');
    setSets('12');
  };

  const entryMeta = (entry: ExerciseEntry) => {
    const parsed = parseStrengthSets(entry.name);
    if (parsed != null || inferExerciseKind(entry.name, t('exercise.cardio'), t('exercise.strength')) === 'strength') {
      const count = parsed ?? Math.round(entry.durationMinutes / 2.5);
      return `${count} ${t('exercise.setsShort')} · ${entry.burnedKcal} kcal`;
    }
    return `${entry.durationMinutes} ${t('exercise.minutesShort')} · ${entry.burnedKcal} kcal`;
  };

  const save = async () => {
    let values: { name: string; durationMinutes: number; burnedKcal: number };

    if (kind === 'strength') {
      const setCount = Number(sets);
      if (!isValidStrengthSets(setCount)) {
        Alert.alert(t('validation.outOfRange'));
        return;
      }
      values = {
        name: formatStrengthName(kindLabel('strength'), setCount),
        durationMinutes: strengthDurationMinutes(setCount),
        burnedKcal: estimateStrengthKcal(setCount),
      };
    } else {
      const durationMinutes = Number(minutes);
      values = {
        name: kindLabel('cardio'),
        durationMinutes,
        burnedKcal: estimateCardioKcal(durationMinutes),
      };
    }

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SectionTitle title={t('habits.exercise')} />
      <Text style={styles.date}>{selectedDate}</Text>
      <Text style={styles.dayTotal}>
        {t('exercise.dayTotal')}: {dayTotal} kcal
      </Text>
      <Text style={styles.hint}>{t('exercise.hint')}</Text>

      <Text style={styles.label}>{t('exercise.kind')}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {(['cardio', 'strength'] as const).map((k) => {
          const selected = kind === k;
          return (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={kindLabel(k)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {kindLabel(k)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {kind === 'strength' ? (
        <>
          <Field
            label={t('exercise.sets')}
            value={sets}
            onChangeText={setSets}
            keyboardType="number-pad"
          />
          <View style={styles.row}>
            {STRENGTH_SET_PRESETS.map((n) => (
              <Pressable
                key={n}
                onPress={() => setSets(String(n))}
                accessibilityRole="button"
                accessibilityLabel={`${n} ${t('exercise.setsShort')}`}
                style={[styles.chip, sets === String(n) && styles.chipSelected]}
              >
                <Text style={[styles.chipText, sets === String(n) && styles.chipTextOn]}>
                  {n}
                  {t('exercise.setsShort')}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <Field
            label={t('exercise.duration')}
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="decimal-pad"
          />
          <View style={styles.row}>
            {CARDIO_DURATION_PRESETS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMinutes(String(m))}
                accessibilityRole="button"
                accessibilityLabel={`${m} ${t('exercise.minutesShort')}`}
                style={[styles.chip, minutes === String(m) && styles.chipSelected]}
              >
                <Text style={[styles.chipText, minutes === String(m) && styles.chipTextOn]}>
                  {m}
                  {t('exercise.minutesShort')}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.estimate}>
        {t('exercise.estimated')}: ~{estimatedKcal} kcal
      </Text>

      <MfpButton
        label={editing ? t('common.save') : t('common.add')}
        onPress={() => void save()}
      />
      {editing ? (
        <>
          <View style={{ height: theme.space.sm }} />
          <MfpButton label={t('common.cancel')} variant="outline" onPress={clear} />
        </>
      ) : null}

      <View style={styles.list}>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.item}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => {
                const nextKind = inferExerciseKind(
                  entry.name,
                  t('exercise.cardio'),
                  t('exercise.strength')
                );
                setEditing(entry);
                setKind(nextKind);
                if (nextKind === 'strength') {
                  const parsed = parseStrengthSets(entry.name);
                  setSets(String(parsed ?? 12));
                } else {
                  setMinutes(String(entry.durationMinutes));
                }
              }}
              accessibilityRole="button"
            >
              <Text style={styles.name}>
                {inferExerciseKind(entry.name, t('exercise.cardio'), t('exercise.strength')) ===
                'strength'
                  ? t('exercise.strength')
                  : entry.name.includes('·')
                    ? t('exercise.cardio')
                    : entry.name}
              </Text>
              <Text style={styles.meta}>{entryMeta(entry)}</Text>
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
  date: { color: theme.colors.textMuted, marginBottom: theme.space.xs },
  dayTotal: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: theme.font.body,
    marginBottom: theme.space.xs,
  },
  hint: { color: theme.colors.textMuted, marginBottom: theme.space.md, lineHeight: 20 },
  label: { color: theme.colors.textMuted, marginBottom: 6, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
    marginBottom: theme.space.md,
  },
  chip: {
    minHeight: theme.minTouch,
    paddingHorizontal: theme.space.md,
    borderWidth: 1.5,
    borderColor: theme.colors.lakeBlue,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
  },
  chipSelected: { backgroundColor: theme.colors.lakeBlue },
  chipText: { color: theme.colors.lakeBlue, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  estimate: {
    color: theme.colors.text,
    fontWeight: '700',
    marginBottom: theme.space.md,
  },
  list: { marginTop: theme.space.lg },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  name: { color: theme.colors.text, fontWeight: '700' },
  meta: { color: theme.colors.textMuted, marginTop: 3 },
  delete: { color: theme.colors.danger, fontWeight: '600', padding: theme.space.sm },
});
