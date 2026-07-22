import { Stack } from 'expo-router';
import { theme } from '@/src/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign in' }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="setup-goals" options={{ title: 'Daily goals', headerBackVisible: false }} />
      <Stack.Screen name="setup-ai" options={{ title: 'AI setup', headerBackVisible: false }} />
      <Stack.Screen name="setup-steps" options={{ title: 'Steps', headerBackVisible: false }} />
    </Stack>
  );
}
