import { Stack, Redirect, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AppProvider, useApp } from '@/src/context/AppContext';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
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

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, session, needsGoalsSetup, needsAiSetup, needsStepsSetup } = useAuth();
  const segments = useSegments();
  const inAuth = segments[0] === '(auth)';
  const screen = segments[1];
  const onboardingScreens = new Set(['setup-goals', 'setup-ai', 'setup-steps']);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.lakeBlue} />
      </View>
    );
  }

  if (!session && !inAuth) {
    return <Redirect href="/(auth)/login" />;
  }

  if (session && needsGoalsSetup && !(inAuth && screen === 'setup-goals')) {
    return <Redirect href="/(auth)/setup-goals" />;
  }

  if (
    session &&
    !needsGoalsSetup &&
    needsAiSetup &&
    !(inAuth && screen === 'setup-ai')
  ) {
    return <Redirect href="/(auth)/setup-ai" />;
  }

  if (
    session &&
    !needsGoalsSetup &&
    !needsAiSetup &&
    needsStepsSetup &&
    !(inAuth && screen === 'setup-steps')
  ) {
    return <Redirect href="/(auth)/setup-steps" />;
  }

  if (
    session &&
    !needsGoalsSetup &&
    !needsAiSetup &&
    !needsStepsSetup &&
    inAuth &&
    (screen === 'login' || screen === 'register')
  ) {
    return <Redirect href="/(tabs)" />;
  }

  // Keep users inside onboarding screens while flags are active; allow auth screens when logged out.
  if (session && inAuth && screen && !onboardingScreens.has(String(screen)) && screen !== 'forgot-password') {
    if (needsGoalsSetup || needsAiSetup || needsStepsSetup) {
      // already redirected above
    }
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
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
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
          <AuthProvider>
            <AuthGate>
              <AppStack />
            </AuthGate>
          </AuthProvider>
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
