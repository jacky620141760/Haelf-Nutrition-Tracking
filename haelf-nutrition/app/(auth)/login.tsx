import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Field, PrimaryButton, MfpButton, MfpCard, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';
import { useApp } from '@/src/context/AppContext';

const GUEST_LOGIN_ENABLED =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? true
    : process.env.EXPO_PUBLIC_ENABLE_GUEST_LOGIN === 'true';

export default function LoginScreen() {
  const { t } = useApp();
  const { signIn, signInGuest, session, loading, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Redirect href="/(tabs)" />;

  const onSubmit = async () => {
    setBusy(true);
    setError('');
    const result = await signIn(email, password);
    if (!result.ok) setError(result.message);
    setBusy(false);
  };

  const onGuest = async () => {
    setBusy(true);
    setError('');
    const result = await signInGuest();
    if (!result.ok) setError(result.message);
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <SectionTitle title={t('auth.loginTitle')} />
      <Text style={styles.sub}>{t('auth.loginSubtitle')}</Text>
      {!configured ? <Text style={styles.warn}>{t('auth.notConfigured')}</Text> : null}
      <MfpCard>
        <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" />
        <Field
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={busy ? t('common.loading') : t('auth.login')} onPress={onSubmit} />
        {GUEST_LOGIN_ENABLED ? (
          <MfpButton
            label={busy ? t('common.loading') : t('auth.guestLogin')}
            onPress={onGuest}
            disabled={busy || !configured}
            variant="outline"
          />
        ) : null}
        <Link href="/(auth)/register" style={styles.link}>
          {t('auth.needAccount')}
        </Link>
        <Link href="/(auth)/forgot-password" style={styles.link}>
          {t('auth.forgotPassword')}
        </Link>
      </MfpCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space.md, justifyContent: 'center' },
  sub: { color: theme.colors.textMuted, marginBottom: theme.space.md, lineHeight: 20 },
  warn: { color: theme.colors.warning, marginBottom: theme.space.md, fontWeight: '600' },
  error: { color: theme.colors.danger, marginBottom: theme.space.sm },
  link: { marginTop: theme.space.md, color: theme.colors.lakeBlue, fontWeight: '600' },
});
