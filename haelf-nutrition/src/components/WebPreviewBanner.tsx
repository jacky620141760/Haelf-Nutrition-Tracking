import { Platform, StyleSheet, Text, View } from 'react-native';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

export function WebPreviewBanner() {
  if (Platform.OS !== 'web') return null;
  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLabel={zhTW.webPreviewBanner}
    >
      <Text style={styles.text}>{zhTW.webPreviewBanner}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.colors.webBannerBg,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  text: {
    color: theme.colors.webBanner,
    fontSize: theme.font.small,
    textAlign: 'center',
    fontWeight: '600',
  },
});
