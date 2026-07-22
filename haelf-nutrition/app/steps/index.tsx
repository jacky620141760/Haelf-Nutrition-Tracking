import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import { getDailyStepTotal, upsertDailyStepTotal } from '@/src/db/repositories/steps';
import { normalizeSteps } from '@/src/domain/steps';
import type { DailyStepTotal } from '@/src/domain/types';
import {
  getPedometerStatus,
  startPedometerWatch,
  syncPedometerToday,
} from '@/src/services/pedometer';
import { Field, MfpButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function StepsScreen() {
  const {
    selectedDate,
    todayLocalDate,
    preferences,
    updatePreferences,
    bumpRefresh,
    refreshToken,
    t,
  } = useApp();
  const [total, setTotal] = useState<DailyStepTotal | null>(null);
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setTotal(await getDailyStepTotal(selectedDate));
  }, [selectedDate]);
  useFocusEffect(useCallback(() => { void load(); }, [load, refreshToken]));

  useEffect(() => {
    if (preferences.stepMode !== 'pedometer' || selectedDate !== todayLocalDate) return;
    let disposed = false;
    let subscription: { remove: () => void } | null = null;
    void startPedometerWatch(selectedDate, (next) => {
      if (!disposed) {
        setTotal(next);
        bumpRefresh();
      }
    }).then((nextSubscription) => {
      if (disposed) nextSubscription?.remove();
      else subscription = nextSubscription;
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncPedometerToday(selectedDate).then((next) => {
          if (!disposed && next) setTotal(next);
        });
      }
    });
    return () => {
      disposed = true;
      subscription?.remove();
      appState.remove();
    };
  }, [bumpRefresh, preferences.stepMode, selectedDate, todayLocalDate]);

  const requestPedometer = async () => {
    const permission = await getPedometerStatus(true);
    if (!permission.granted) {
      setStatus(permission.reason === 'unavailable' ? t('steps.unavailable') : t('steps.denied'));
      return;
    }
    await updatePreferences({ stepMode: 'pedometer' });
    const next = await syncPedometerToday(selectedDate);
    if (next) setTotal(next);
    setStatus(t('steps.connected'));
  };

  const saveManual = async () => {
    const steps = normalizeSteps(Number(manual));
    if (steps === null) {
      Alert.alert(t('validation.outOfRange'));
      return;
    }
    await upsertDailyStepTotal({ localDate: selectedDate, steps, source: 'manual' });
    await updatePreferences({ stepMode: 'manual' });
    setManual('');
    bumpRefresh();
    await load();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={t('habits.steps')} />
      <Text style={styles.steps}>{total?.steps.toLocaleString() ?? '—'}</Text>
      <Text style={styles.meta}>
        {total ? `${total.source} · ${total.syncedAt}` : t('common.notRecorded')}
      </Text>
      <Text style={styles.notice}>
        {Platform.OS === 'ios'
          ? t('steps.iosNotice')
          : t('steps.androidNotice')}
      </Text>
      <MfpButton label={t('steps.connect')} onPress={() => void requestPedometer()} />
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <View style={{ height: theme.space.lg }} />
      <Field
        label={t('habits.manualSteps')}
        value={manual}
        onChangeText={setManual}
        keyboardType="number-pad"
      />
      <MfpButton label={t('common.save')} variant="outline" onPress={() => void saveManual()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md },
  steps: { color: theme.colors.text, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  meta: { color: theme.colors.textMuted, marginBottom: theme.space.md },
  notice: { color: theme.colors.textMuted, lineHeight: 20, marginBottom: theme.space.md },
  status: { color: theme.colors.lakeBlue, marginTop: theme.space.sm },
});
