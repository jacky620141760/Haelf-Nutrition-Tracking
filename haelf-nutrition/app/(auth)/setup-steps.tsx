import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { useApp } from '@/src/context/AppContext';
import { getPedometerStatus, syncPedometerToday } from '@/src/services/pedometer';
import { toLocalDateString } from '@/src/domain/dates';
import { MfpButton, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function SetupStepsScreen() {
  const { t, updatePreferences, bumpRefresh, todayLocalDate } = useApp();
  const {
    session,
    needsGoalsSetup,
    needsAiSetup,
    needsStepsSetup,
    finishStepsOnboarding,
  } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (needsGoalsSetup) return <Redirect href="/(auth)/setup-goals" />;
  if (needsAiSetup) return <Redirect href="/(auth)/setup-ai" />;
  if (!needsStepsSetup) return <Redirect href="/" />;

  const finish = async () => {
    await finishStepsOnboarding();
    bumpRefresh();
    // Leave the (auth) stack via root href — `/(tabs)` is not a child of (auth).
    router.replace('/');
  };

  const connectPedometer = async () => {
    setBusy(true);
    setStatus('');
    try {
      if (Platform.OS !== 'ios') {
        setStatus(t('auth.setupStepsNonIos'));
        return;
      }
      const permission = await getPedometerStatus(true);
      if (!permission.granted) {
        setStatus(
          permission.reason === 'unavailable' ? t('steps.unavailable') : t('steps.denied')
        );
        return;
      }
      await updatePreferences({ stepMode: 'pedometer' });
      const day = todayLocalDate || toLocalDateString();
      await syncPedometerToday(day, true);
      setStatus(t('steps.connected'));
      await finish();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.step}>{t('auth.onboardingStep', { current: 3, total: 3 })}</Text>
      <SectionTitle title={t('auth.setupStepsTitle')} />
      <Text style={styles.hint}>{t('auth.setupStepsSubtitle')}</Text>
      <Text style={styles.hint}>
        {Platform.OS === 'ios' ? t('steps.iosNotice') : t('auth.setupStepsNonIos')}
      </Text>
      {Platform.OS === 'ios' ? (
        <PrimaryButton
          label={busy ? t('common.loading') : t('auth.connectAppleHealthSteps')}
          onPress={() => void connectPedometer()}
        />
      ) : (
        <PrimaryButton label={t('auth.continueWithoutSteps')} onPress={() => void finish()} />
      )}
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <View style={{ height: theme.space.sm }} />
      <MfpButton label={t('auth.skipForNow')} variant="outline" onPress={() => void finish()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  step: { color: theme.colors.lakeBlue, fontWeight: '700', marginBottom: theme.space.sm },
  hint: { color: theme.colors.textMuted, marginBottom: theme.space.md, lineHeight: 20 },
  status: { color: theme.colors.lakeBlue, marginTop: theme.space.sm, fontWeight: '600' },
});
