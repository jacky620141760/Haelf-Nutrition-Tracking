import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';
import { SectionTitle, MfpCard } from '@/src/components/ui';
import { useApp } from '@/src/context/AppContext';

function Row({ label, onPress, hint }: { label: string; onPress: () => void; hint?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <Text style={styles.rowText}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { isWeb, preferences, updatePreferences, t } = useApp();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={t('settings.title')} />
      {isWeb ? (
        <View style={styles.warn} accessibilityRole="alert">
          <Text style={styles.warnText}>{zhTW.webPreviewBanner}</Text>
        </View>
      ) : null}
      <MfpCard>
        <Row label={t('settings.goals')} onPress={() => router.push('/goals')} />
        <Row label={t('library.myFoods')} onPress={() => router.push('/library' as never)} />
        <Row label={t('settings.weight')} onPress={() => router.push('/weight')} />
        <Row label={t('diary.ai')} onPress={() => router.push('/food/ai')} />
        <Row label={t('ai.settings')} onPress={() => router.push('/settings/ai')} />
        <Row
          label={`${t('settings.units')} · ${preferences.waterUnit}`}
          onPress={() => void updatePreferences({
            waterUnit: preferences.waterUnit === 'ml' ? 'cup' : preferences.waterUnit === 'cup' ? 'oz' : 'ml',
          })}
        />
        <Row
          label={`${t('settings.weekStart')} · ${preferences.weekStart === 1 ? 'Monday' : 'Sunday'}`}
          onPress={() => void updatePreferences({ weekStart: preferences.weekStart === 1 ? 0 : 1 })}
        />
        <Row
          label={`${t('settings.language')} · ${preferences.locale}`}
          onPress={() => void updatePreferences({ locale: preferences.locale === 'zh-TW' ? 'en' : 'zh-TW' })}
        />
        <Row label={t('settings.pedometer')} onPress={() => router.push('/steps' as never)} />
        <Row label={t('settings.data')} onPress={() => router.push('/settings/data')} />
        <Row
          label={t('settings.privacy')}
          onPress={() => Alert.alert('Haelf Nutrition', 'Local-first nutrition tracking. No account or cloud sync.')}
        />
      </MfpCard>
      <Text style={styles.notice}>{t('settings.backupNotice')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.space.md },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowPressed: { backgroundColor: theme.colors.surface },
  rowText: { fontSize: theme.font.body, color: theme.colors.text, fontWeight: '500' },
  chevron: { fontSize: 22, color: theme.colors.textMute },
  notice: {
    marginTop: theme.space.md,
    color: theme.colors.textMuted,
    fontSize: theme.font.bodySmall,
    lineHeight: 20,
  },
  warn: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.space.md,
    borderRadius: theme.radius,
    marginBottom: theme.space.md,
  },
  warnText: { color: theme.colors.warning, fontWeight: '600' },
});
