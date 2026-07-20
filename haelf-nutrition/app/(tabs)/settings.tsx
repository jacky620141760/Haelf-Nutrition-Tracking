import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';
import { SectionTitle } from '@/src/components/ui';
import { useApp } from '@/src/context/AppContext';

function Row({ label, onPress, hint }: { label: string; onPress: () => void; hint?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <Text style={styles.rowText}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { isWeb } = useApp();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionTitle title={zhTW.settings.title} />
      {isWeb ? (
        <View style={styles.warn} accessibilityRole="alert">
          <Text style={styles.warnText}>{zhTW.webPreviewBanner}</Text>
        </View>
      ) : null}
      <Row label={zhTW.settings.goals} onPress={() => router.push('/goals')} />
      <Row label={zhTW.settings.weight} onPress={() => router.push('/weight')} />
      <Row label={zhTW.ai.settings} onPress={() => router.push('/settings/ai')} />
      <Row label={zhTW.settings.data} onPress={() => router.push('/settings/data')} />
      <Text style={styles.notice}>{zhTW.settings.backupNotice}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space.md },
  row: {
    minHeight: theme.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowText: { fontSize: theme.font.body, color: theme.colors.text, fontWeight: '500' },
  chevron: { fontSize: 22, color: theme.colors.textMuted },
  notice: {
    marginTop: theme.space.lg,
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
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
