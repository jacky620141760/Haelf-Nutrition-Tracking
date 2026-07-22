import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/src/theme';

export function ScanFab({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
    >
      <Text style={styles.icon}>▣</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.lakeBlue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#005DAA',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: theme.colors.lakeBluePressed,
  },
  icon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
});

/** Spacer so FAB doesn't cover last meal section. */
export function FabSpacer() {
  return <View style={{ height: 72 }} />;
}
