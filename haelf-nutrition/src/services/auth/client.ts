import { createClient, type Session, type User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const memoryStore = new Map<string, string>();

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') return memoryStore.get(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      memoryStore.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      memoryStore.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && !url.includes('YOUR_PROJECT'));
}

export function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  if (!isSupabaseConfigured()) return null;
  return { url, anonKey };
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type AuthResult = { ok: true; user: User; session: Session | null } | { ok: false; message: string };

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ANON_KEY.' };
  }
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { ok: false, message: error.message };
  if (!data.user) return { ok: false, message: 'Sign up failed' };
  return { ok: true, user: data.user, session: data.session };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ANON_KEY.' };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, message: error.message };
  if (!data.user) return { ok: false, message: 'Sign in failed' };
  return { ok: true, user: data.user, session: data.session };
}

/** Temporary test helper: new identity each call so onboarding can restart from scratch. */
export async function signInAsGuest(): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ANON_KEY.' };
  }

  await supabase.auth.signOut();

  const anonymous = await supabase.auth.signInAnonymously();
  if (!anonymous.error && anonymous.data.user) {
    return { ok: true, user: anonymous.data.user, session: anonymous.data.session };
  }

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const email = `guest-${stamp}@haelf.guest`;
  const password = `Guest-${stamp}-Aa1`;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const anonHint = anonymous.error?.message ? ` (anonymous: ${anonymous.error.message})` : '';
    return { ok: false, message: `${error.message}${anonHint}` };
  }
  if (!data.user) return { ok: false, message: 'Guest sign-in failed' };
  return { ok: true, user: data.user, session: data.session };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function resetPassword(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Supabase is not configured.' };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
