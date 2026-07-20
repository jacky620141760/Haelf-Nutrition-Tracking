import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AppProvider, useApp } from '@/src/context/AppContext';
import { WebPreviewBanner } from '@/src/components/WebPreviewBanner';
import { theme } from '@/src/theme';
import { RecoveryScreen } from '@/src/components/RecoveryScreen';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, dbStatus } = useApp();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (dbStatus && dbStatus.status !== 'ready') {
    return <RecoveryScreen status={dbStatus} />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <WebPreviewBanner />
        <Gate>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.colors.bg },
              headerTintColor: theme.colors.text,
              contentStyle: { backgroundColor: theme.colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="food/add" options={{ title: '新增食物' }} />
            <Stack.Screen name="food/edit/[id]" options={{ title: '編輯食物' }} />
            <Stack.Screen name="food/scan" options={{ title: '掃描條碼' }} />
            <Stack.Screen name="food/ai" options={{ title: 'AI 分析' }} />
            <Stack.Screen name="weight/index" options={{ title: '體重紀錄' }} />
            <Stack.Screen name="goals" options={{ title: '每日目標' }} />
            <Stack.Screen name="settings/ai" options={{ title: 'AI 設定' }} />
            <Stack.Screen name="settings/data" options={{ title: '資料管理' }} />
          </Stack>
        </Gate>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
  },
});
