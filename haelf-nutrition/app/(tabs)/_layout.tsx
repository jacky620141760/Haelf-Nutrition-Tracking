import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { zhTW } from '@/src/i18n/zh-TW';
import { theme } from '@/src/theme';

function TabIcon({ label, color }: { label: string; color: string | undefined }) {
  return (
    <Text style={{ color: color ?? theme.colors.textMuted, fontSize: 12, fontWeight: '700' }} accessibilityElementsHidden>
      {label.slice(0, 1)}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.bgElevated,
          borderTopColor: theme.colors.border,
          minHeight: 56,
        },
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: zhTW.tabs.today,
          tabBarIcon: ({ color }) => <TabIcon label={zhTW.tabs.today} color={String(color)} />,
          tabBarAccessibilityLabel: zhTW.tabs.today,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: zhTW.tabs.stats,
          tabBarIcon: ({ color }) => <TabIcon label={zhTW.tabs.stats} color={String(color)} />,
          tabBarAccessibilityLabel: zhTW.tabs.stats,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: zhTW.tabs.settings,
          tabBarIcon: ({ color }) => <TabIcon label={zhTW.tabs.settings} color={String(color)} />,
          tabBarAccessibilityLabel: zhTW.tabs.settings,
        }}
      />
    </Tabs>
  );
}
