import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/src/context/AppContext';
import { clearBarcodeCache } from '@/src/db/repositories/barcode';
import { clearAllAppTables } from '@/src/db/database';
import { clearApiKey } from '@/src/services/secureStore';
import { Field, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

export default function DataSettingsScreen() {
  const { bumpRefresh } = useApp();
  const [confirmText, setConfirmText] = useState('');

  const onClearCache = () => {
    Alert.alert(zhTW.settings.clearBarcodeCache, '僅清除條碼快取，其他資料不變。', [
      { text: zhTW.common.cancel, style: 'cancel' },
      {
        text: zhTW.common.confirm,
        onPress: async () => {
          await clearBarcodeCache();
          Alert.alert(zhTW.settings.clearBarcodeCacheDone);
        },
      },
    ]);
  };

  const onClearAll = async () => {
    if (confirmText.trim() !== zhTW.settings.clearAllConfirmPhrase) {
      Alert.alert(zhTW.settings.clearAllPrompt);
      return;
    }
    Alert.alert(zhTW.settings.clearAll, zhTW.settings.clearAllWarning, [
      { text: zhTW.common.cancel, style: 'cancel' },
      {
        text: zhTW.common.confirm,
        style: 'destructive',
        onPress: async () => {
          await clearAllAppTables();
          await clearApiKey();
          setConfirmText('');
          bumpRefresh();
          Alert.alert('已清除全部本機資料');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={zhTW.settings.data} />
      <Text style={styles.notice}>{zhTW.settings.backupNotice}</Text>
      <PrimaryButton label={zhTW.settings.clearBarcodeCache} onPress={onClearCache} />
      <View style={{ height: theme.space.lg }} />
      <Text style={styles.warn}>{zhTW.settings.clearAllWarning}</Text>
      <Field
        label={zhTW.settings.clearAllPrompt}
        value={confirmText}
        onChangeText={setConfirmText}
        placeholder={zhTW.settings.clearAllConfirmPhrase}
      />
      <PrimaryButton label={zhTW.settings.clearAll} danger onPress={onClearAll} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  notice: {
    color: theme.colors.textMuted,
    marginBottom: theme.space.lg,
    lineHeight: 20,
    fontSize: theme.font.small,
  },
  warn: {
    color: theme.colors.danger,
    marginBottom: theme.space.md,
    fontWeight: '600',
    lineHeight: 20,
  },
});
