import { Tabs } from 'expo-router';
import { theme } from '@/src/theme';
import { HaelfTabBar } from '@/src/components/navigation/HaelfTabBar';
import { useApp } from '@/src/context/AppContext';

export default function TabLayout() {
  const { t } = useApp();
  return (
    <Tabs
      tabBar={(props) => <HaelfTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: theme.colors.lakeBlue,
        tabBarInactiveTintColor: theme.colors.textMute,
        tabBarStyle: {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.border,
          minHeight: 56,
          paddingTop: 4,
        },
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        tabBarLabelStyle: {
          fontSize: theme.font.tab,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarAccessibilityLabel: t('tabs.today'),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('tabs.progress'),
          tabBarAccessibilityLabel: t('tabs.progress'),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tabs.library'),
          tabBarAccessibilityLabel: t('tabs.library'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.more'),
          tabBarAccessibilityLabel: t('tabs.more'),
        }}
      />
    </Tabs>
  );
}
