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
        <ActivityIndicator size="large" color={theme.colors.lakeBlue} />
      </View>
    );
  }

  if (dbStatus && dbStatus.status !== 'ready') {
    return <RecoveryScreen status={dbStatus} />;
  }

  return <>{children}</>;
}

function AppStack() {
  const { t } = useApp();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="food/log" options={{ title: t('foodHub.title') }} />
      <Stack.Screen name="food/add" options={{ title: t('foodHub.createFood') }} />
      <Stack.Screen name="food/edit/[id]" options={{ title: t('common.edit') }} />
      <Stack.Screen name="food/scan" options={{ title: t('barcode.title') }} />
      <Stack.Screen name="food/ai" options={{ title: t('ai.title') }} />
      <Stack.Screen name="water/index" options={{ title: t('habits.water') }} />
      <Stack.Screen name="exercise/index" options={{ title: t('habits.exercise') }} />
      <Stack.Screen name="steps/index" options={{ title: t('habits.steps') }} />
      <Stack.Screen name="weight/index" options={{ title: t('weight.title') }} />
      <Stack.Screen name="goals" options={{ title: t('goals.title') }} />
      <Stack.Screen name="settings/ai" options={{ title: t('ai.settings') }} />
      <Stack.Screen name="settings/data" options={{ title: t('settings.data') }} />
      <Stack.Screen name="library/meal/new" options={{ title: t('library.createMeal') }} />
      <Stack.Screen name="library/meal/[id]" options={{ title: t('library.meals') }} />
      <Stack.Screen name="library/recipe/new" options={{ title: t('library.createRecipe') }} />
      <Stack.Screen name="library/recipe/[id]" options={{ title: t('library.recipes') }} />
      <Stack.Screen name="diary/copy" options={{ title: t('copy.title') }} />
      <Stack.Screen name="progress/calories" options={{ title: t('progressDetail.calories') }} />
      <Stack.Screen name="progress/macros" options={{ title: t('progressDetail.macros') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <WebPreviewBanner />
        <Gate>
          <AppStack />
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
