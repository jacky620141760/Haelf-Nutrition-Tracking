import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { useApp } from '@/src/context/AppContext';
import { getAiSettings, saveAiSettings } from '@/src/db/repositories/aiSettings';
import { getApiKey, saveApiKey, isWebPreview } from '@/src/services/secureStore';
import { isAiSettingsFrozen } from '@/src/services/ai/builtinConfig';
import { isStepsOnboardingPending } from '@/src/services/onboarding';
import { Field, MfpButton, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';

export default function SetupAiScreen() {
  const { t, isWeb } = useApp();
  const { session, needsGoalsSetup, needsAiSetup, finishAiOnboarding } = useAuth();
  const router = useRouter();
  const frozen = isAiSettingsFrozen();
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await getAiSettings();
      setEndpoint(s.endpointUrl);
      setModel(s.model);
      setApiKey(frozen ? '••••••••••••••••' : (await getApiKey()) ?? '');
    })();
  }, [frozen]);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (needsGoalsSetup) return <Redirect href="/(auth)/setup-goals" />;
  if (!needsAiSetup) {
    return <Redirect href="/(auth)/setup-steps" />;
  }

  const goNext = async () => {
    await finishAiOnboarding();
    if (await isStepsOnboardingPending()) router.replace('/(auth)/setup-steps');
    // Leave the (auth) stack via root href — `/(tabs)` is not a child of (auth).
    else router.replace('/');
  };

  const onSave = async () => {
    setBusy(true);
    try {
      if (!frozen) {
        await saveAiSettings({
          endpointUrl: endpoint.trim(),
          model: model.trim(),
          resetCapability: true,
        });
        await saveApiKey(apiKey.trim());
      }
      await goNext();
    } catch (error) {
      Alert.alert(t('common.retry'), error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.step}>{t('auth.onboardingStep', { current: 2, total: 3 })}</Text>
      <SectionTitle title={t('auth.setupAiTitle')} />
      <Text style={styles.hint}>
        {frozen ? t('ai.settingsFrozenBody') : t('auth.setupAiSubtitle')}
      </Text>
      {(isWeb || isWebPreview()) && !frozen && (
        <View style={styles.warn} accessibilityRole="alert">
          <Text style={styles.warnText}>{t('ai.webKeyWarning')}</Text>
        </View>
      )}
      {!frozen ? (
        <>
          <Field
            label={t('ai.endpoint')}
            value={endpoint}
            onChangeText={setEndpoint}
            autoCapitalize="none"
            placeholder="https://api.deepseek.com/v1"
          />
          <Field label={t('ai.model')} value={model} onChangeText={setModel} autoCapitalize="none" />
          <Field
            label={t('ai.apiKey')}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            secureTextEntry
          />
          <PrimaryButton label={busy ? t('common.loading') : t('auth.saveAndContinue')} onPress={onSave} />
          <View style={{ height: theme.space.sm }} />
          <MfpButton label={t('auth.skipForNow')} variant="outline" onPress={() => void goNext()} />
        </>
      ) : (
        <PrimaryButton
          label={busy ? t('common.loading') : t('auth.saveAndContinue')}
          onPress={() => void onSave()}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  step: { color: theme.colors.lakeBlue, fontWeight: '700', marginBottom: theme.space.sm },
  hint: { color: theme.colors.textMuted, marginBottom: theme.space.md, lineHeight: 20 },
  warn: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.space.md,
    borderRadius: theme.radius,
    marginBottom: theme.space.md,
  },
  warnText: { color: theme.colors.warning, fontWeight: '600' },
});
