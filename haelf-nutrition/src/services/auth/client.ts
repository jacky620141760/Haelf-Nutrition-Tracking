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

/** Fixed shared guest account — avoids signUp email rate limits. Local wipe still resets onboarding. */
const GUEST_EMAIL = 'haelf.guest@example.com';
const GUEST_PASSWORD = 'HaelfGuestTest1!';

/** Temporary test helper. Prefers anonymous; else fixed guest password login (no new emails). */
export async function signInAsGuest(): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ANON_KEY.' };
  }

  await supabase.auth.signOut();

  const anonymous = await supabase.auth.signInAnonymously();
  if (!anonymous.error && anonymous.data.user) {
    return { ok: true, user: anonymous.data.user, session: anonymous.data.session };
  }

  const existing = await supabase.auth.signInWithPassword({
    email: GUEST_EMAIL,
    password: GUEST_PASSWORD,
  });
  if (!existing.error && existing.data.user) {
    return { ok: true, user: existing.data.user, session: existing.data.session };
  }

  // First-time only: create the shared guest user (one signup, not per tap).
  const created = await supabase.auth.signUp({
    email: GUEST_EMAIL,
    password: GUEST_PASSWORD,
  });
  if (!created.error && created.data.user) {
    // If email confirm is on and session is null, try password sign-in anyway.
    if (created.data.session) {
      return { ok: true, user: created.data.user, session: created.data.session };
    }
    const afterCreate = await supabase.auth.signInWithPassword({
      email: GUEST_EMAIL,
      password: GUEST_PASSWORD,
    });
    if (!afterCreate.error && afterCreate.data.user) {
      return { ok: true, user: afterCreate.data.user, session: afterCreate.data.session };
    }
  }

  const parts = [
    existing.error?.message,
    created.error?.message,
    anonymous.error?.message ? `anonymous: ${anonymous.error.message}` : null,
    'Tip: enable Anonymous sign-ins in Supabase Auth, or wait out email rate limit then tap guest once to create haelf.guest@example.com',
  ].filter(Boolean);
  return { ok: false, message: parts.join(' | ') };
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
