import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuickLogSheet } from '@/src/components/sheets/QuickLogSheet';
import { useApp } from '@/src/context/AppContext';
import { theme } from '@/src/theme';

const GLYPHS: Record<string, string> = {
  index: '◉',
  stats: '↗',
  library: '▦',
  settings: '•••',
};

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
>[0];

export function HaelfTabBar({
  state,
  descriptors,
  navigation,
}: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useApp();
  const [quickLogOpen, setQuickLogOpen] = useState(false);

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key].options;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const tab = (
            <Pressable
              key={route.key}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              <Text style={[styles.icon, focused && styles.active]}>{GLYPHS[route.name] ?? '•'}</Text>
              <Text style={[styles.label, focused && styles.active]}>{label}</Text>
            </Pressable>
          );
          if (index !== 2) return tab;
          return (
            <View key={`with-add-${route.key}`} style={styles.middleGroup}>
              <Pressable
                style={styles.add}
                onPress={() => setQuickLogOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('quickLog.title')}
              >
                <Text style={styles.addText}>＋</Text>
              </Pressable>
              {tab}
            </View>
          );
        })}
      </View>
      <QuickLogSheet visible={quickLogOpen} onClose={() => setQuickLogOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 5,
  },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  icon: { color: theme.colors.textMute, fontWeight: '800', fontSize: 17 },
  label: { color: theme.colors.textMute, fontSize: theme.font.tab, fontWeight: '600' },
  active: { color: theme.colors.lakeBlue },
  middleGroup: { flex: 2, flexDirection: 'row', alignItems: 'flex-end' },
  add: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: -19,
    backgroundColor: theme.colors.lakeBlue,
    borderWidth: 3,
    borderColor: theme.colors.bg,
  },
  addText: { color: '#FFFFFF', fontSize: 30, lineHeight: 34, fontWeight: '500' },
});
