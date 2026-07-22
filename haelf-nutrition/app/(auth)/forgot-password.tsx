import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Field, PrimaryButton, MfpCard, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';
import { useApp } from '@/src/context/AppContext';

export default function ForgotPasswordScreen() {
  const { t } = useApp();
  const { sendPasswordReset, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    const result = await sendPasswordReset(email);
    if (!result.ok) setError(result.message);
    else setMessage(t('auth.resetSent'));
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <SectionTitle title={t('auth.forgotTitle')} />
      <Text style={styles.sub}>{t('auth.forgotSubtitle')}</Text>
      {!configured ? <Text style={styles.warn}>{t('auth.notConfigured')}</Text> : null}
      <MfpCard>
        <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.ok}>{message}</Text> : null}
        <PrimaryButton label={busy ? t('common.loading') : t('auth.sendReset')} onPress={onSubmit} />
        <Link href="/(auth)/login" style={styles.link}>
          {t('auth.backToLogin')}
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
  ok: { color: theme.colors.lakeBlue, marginBottom: theme.space.sm, fontWeight: '600' },
  link: { marginTop: theme.space.md, color: theme.colors.lakeBlue, fontWeight: '600' },
});
