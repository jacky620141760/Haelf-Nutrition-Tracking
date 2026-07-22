import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import { theme } from '@/src/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function QuickLogSheet({ visible, onClose }: Props) {
  const router = useRouter();
  const { t } = useApp();
  const actions = [
    { key: 'food', label: t('quickLog.food'), glyph: 'F', route: '/food/log' as const },
    { key: 'barcode', label: t('quickLog.barcode'), glyph: '▥', route: '/food/scan' as const },
    { key: 'ai', label: t('quickLog.ai'), glyph: 'AI', route: '/food/ai' as const },
    { key: 'water', label: t('quickLog.water'), glyph: 'W', route: '/water' as const },
    { key: 'exercise', label: t('quickLog.exercise'), glyph: 'E', route: '/exercise' as const },
    { key: 'weight', label: t('quickLog.weight'), glyph: 'kg', route: '/weight' as const },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">{t('quickLog.title')}</Text>
        <View style={styles.grid}>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => {
                onClose();
                setTimeout(() => router.push(action.route as never), 0);
              }}
            >
              <View style={styles.glyphWrap}>
                <Text style={styles.glyph}>{action.glyph}</Text>
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.close} onPress={onClose} accessibilityRole="button">
          <Text style={styles.closeText}>{t('common.close')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)' },
  sheet: {
    backgroundColor: theme.colors.bg,
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.xl,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: theme.space.md,
  },
  title: {
    fontSize: theme.font.section,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.space.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  action: {
    width: '31%',
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
  },
  actionPressed: { backgroundColor: theme.colors.skyBlue },
  glyphWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.skyBlue,
  },
  glyph: { color: theme.colors.lakeBlue, fontWeight: '800' },
  actionLabel: {
    color: theme.colors.text,
    fontSize: theme.font.bodySmall,
    fontWeight: '600',
    textAlign: 'center',
  },
  close: { minHeight: theme.minTouch, alignItems: 'center', justifyContent: 'center', marginTop: theme.space.md },
  closeText: { color: theme.colors.lakeBlue, fontWeight: '700' },
});
