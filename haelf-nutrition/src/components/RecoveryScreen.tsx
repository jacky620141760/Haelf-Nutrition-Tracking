import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DbInitResult } from '@/src/domain/types';
import { useApp } from '@/src/context/AppContext';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';
import { PrimaryButton } from '@/src/components/ui';

export function RecoveryScreen({ status }: { status: DbInitResult }) {
  const { wipeAndRestart } = useApp();
  const [confirmation, setConfirmation] = useState('');
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
      <Text style={styles.hint}>
        若要刪除裝置上的所有營養資料並重新開始，請輸入「刪除全部資料」。
      </Text>
      <TextInput
        value={confirmation}
        onChangeText={setConfirmation}
        placeholder="刪除全部資料"
        placeholderTextColor={theme.colors.textMute}
        style={styles.input}
        accessibilityLabel="破壞性操作確認"
      />
      <PrimaryButton
        label={zhTW.recovery.restartFresh}
        danger
        disabled={confirmation !== '刪除全部資料'}
        onPress={() => wipeAndRestart()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={zhTW.recovery.keepData}
        onPress={() =>
          Alert.alert(
            '資料已保留',
            '裝置資料沒有被刪除。為避免破壞資料，App 仍維持唯讀鎖定；請更新 App 或將 App 關閉。'
          )
        }
      >
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
  input: {
    minHeight: theme.minTouch,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  keep: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    minHeight: theme.minTouch,
    textAlignVertical: 'center',
  },
});
