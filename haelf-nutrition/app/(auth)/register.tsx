import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Field, PrimaryButton, MfpCard, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';
import { useApp } from '@/src/context/AppContext';

export default function RegisterScreen() {
  const { t } = useApp();
  const router = useRouter();
  const { signUp, session, loading, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Redirect href="/(auth)/setup-goals" />;

  const onSubmit = async () => {
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    const result = await signUp(email, password);
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    setBusy(false);
    router.replace('/(auth)/setup-goals');
  };

  return (
    <View style={styles.container}>
      <SectionTitle title={t('auth.registerTitle')} />
      <Text style={styles.sub}>{t('auth.registerSubtitle')}</Text>
      {!configured ? <Text style={styles.warn}>{t('auth.notConfigured')}</Text> : null}
      <MfpCard>
        <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" />
        <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry />
        <Field label={t('auth.confirmPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={busy ? t('common.loading') : t('auth.register')} onPress={onSubmit} />
        <Link href="/(auth)/login" style={styles.link}>
          {t('auth.haveAccount')}
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
