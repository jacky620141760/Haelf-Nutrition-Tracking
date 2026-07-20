import { Text, View, StyleSheet, Pressable } from 'react-native';
import type { DbInitResult } from '@/src/domain/types';
import { useApp } from '@/src/context/AppContext';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';
import { PrimaryButton } from '@/src/components/ui';

export function RecoveryScreen({ status }: { status: DbInitResult }) {
  const { wipeAndRestart } = useApp();
  const message =
    status.status === 'migration_failed'
      ? zhTW.recovery.migrationFailed
      : zhTW.recovery.unsupported;

  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Text style={styles.title}>{zhTW.recovery.title}</Text>
      <Text style={styles.body}>{message}</Text>
      {'error' in status && status.error ? (
        <Text style={styles.detail}>{status.error}</Text>
      ) : null}
      <Text style={styles.hint}>{zhTW.recovery.keepData}</Text>
      <PrimaryButton
        label={zhTW.recovery.restartFresh}
        danger
        onPress={() => wipeAndRestart()}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={zhTW.recovery.keepData}>
        <Text style={styles.keep}>{zhTW.recovery.keepData}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: theme.space.lg,
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
    gap: theme.space.md,
  },
  title: {
    fontSize: theme.font.title,
    fontWeight: '700',
    color: theme.colors.danger,
  },
  body: { fontSize: theme.font.body, color: theme.colors.text },
  detail: { fontSize: theme.font.small, color: theme.colors.textMuted },
  hint: { fontSize: theme.font.small, color: theme.colors.textMuted },
  keep: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    minHeight: theme.minTouch,
    textAlignVertical: 'center',
  },
});
