import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/src/context/AppContext';
import { clearBarcodeCache } from '@/src/db/repositories/barcode';
import { clearAllAppTables } from '@/src/db/database';
import { clearApiKey } from '@/src/services/secureStore';
import { Field, PrimaryButton, SectionTitle } from '@/src/components/ui';
import { theme } from '@/src/theme';
import { confirmDialog, notify } from '@/src/services/dialog';

export default function DataSettingsScreen() {
  const { bumpRefresh, updatePreferences, t } = useApp();
  const [confirmText, setConfirmText] = useState('');

  const onClearCache = async () => {
    const confirmed = await confirmDialog(
      t('settings.clearBarcodeCache'),
      t('settings.clearBarcodeCache'),
      { cancel: t('common.cancel'), confirm: t('common.confirm') }
    );
    if (!confirmed) return;
    try {
      await clearBarcodeCache();
      notify(t('settings.clearBarcodeCacheDone'));
    } catch (error) {
      notify('清除失敗', error instanceof Error ? error.message : '無法清除條碼快取');
    }
  };

  const onClearAll = async () => {
    if (confirmText.trim() !== t('settings.clearAllConfirmPhrase')) {
      notify(t('settings.clearAllPrompt'));
      return;
    }
    const confirmed = await confirmDialog(
      t('settings.clearAll'),
      t('settings.clearAllWarning'),
      { cancel: t('common.cancel'), confirm: t('common.confirm') }
    );
    if (!confirmed) return;
    const failures: string[] = [];
    try {
      await clearAllAppTables();
    } catch (error) {
      failures.push(`SQLite：${error instanceof Error ? error.message : '清除失敗'}`);
    }
    try {
      await clearApiKey();
    } catch (error) {
      failures.push(`Secure Store：${error instanceof Error ? error.message : '清除失敗'}`);
    }
    if (failures.length) {
      notify('部分資料未能清除', failures.join('\n'));
      return;
    }
    await updatePreferences({
      locale: 'zh-TW',
      waterUnit: 'ml',
      weekStart: 1,
      stepMode: 'pedometer',
      exerciseCaloriesEnabled: true,
    });
    setConfirmText('');
    bumpRefresh();
    notify('已清除全部本機資料');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={t('settings.data')} />
      <Text style={styles.notice}>{t('settings.backupNotice')}</Text>
      <PrimaryButton label={t('settings.clearBarcodeCache')} onPress={() => void onClearCache()} />
      <View style={{ height: theme.space.lg }} />
      <Text style={styles.warn}>{t('settings.clearAllWarning')}</Text>
      <Field
        label={t('settings.clearAllPrompt')}
        value={confirmText}
        onChangeText={setConfirmText}
        placeholder={t('settings.clearAllConfirmPhrase')}
      />
      <PrimaryButton label={t('settings.clearAll')} danger onPress={onClearAll} />
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
