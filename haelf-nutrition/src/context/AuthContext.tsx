import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import {
  getSession,
  isSupabaseConfigured,
  resetPassword,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  supabase,
} from '../services/auth/client';
import { clearBoundUser, getBoundUserId, runFullSync } from '../services/sync/engine';
import { hasOngoingGoals } from '../db/repositories/goals';
import { clearAllAppTables } from '../db/database';
import {
  clearOnboardingFlags,
  completeAiOnboarding,
  completeStepsOnboarding,
  isAiOnboardingPending,
  isStepsOnboardingPending,
  startPostSignupOnboarding,
} from '../services/onboarding';

type AuthContextValue = {
  loading: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  needsGoalsSetup: boolean;
  needsAiSetup: boolean;
  needsStepsSetup: boolean;
  syncing: boolean;
  lastSyncError: string | null;
  refreshOnboardingGate: () => Promise<void>;
  finishAiOnboarding: () => Promise<void>;
  finishStepsOnboarding: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signUp: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOutUser: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  syncNow: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [needsGoalsSetup, setNeedsGoalsSetup] = useState(false);
  const [needsAiSetup, setNeedsAiSetup] = useState(false);
  const [needsStepsSetup, setNeedsStepsSetup] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const refreshOnboardingGate = useCallback(async () => {
    try {
      const noGoals = !(await hasOngoingGoals());
      setNeedsGoalsSetup(noGoals);
      if (noGoals) {
        setNeedsAiSetup(false);
        setNeedsStepsSetup(false);
        return;
      }
      setNeedsAiSetup(await isAiOnboardingPending());
      setNeedsStepsSetup(await isStepsOnboardingPending());
    } catch {
      setNeedsGoalsSetup(true);
      setNeedsAiSetup(false);
      setNeedsStepsSetup(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId || !isSupabaseConfigured()) return;
    setSyncing(true);
    setLastSyncError(null);
    const result = await runFullSync(userId);
    if (!result.ok) setLastSyncError(result.message);
    await refreshOnboardingGate();
    setSyncing(false);
  }, [session?.user?.id, refreshOnboardingGate]);

  const bindAccount = useCallback(
    async (userId: string) => {
      const bound = await getBoundUserId();
      if (bound && bound !== userId && bound !== '') {
        await clearAllAppTables();
        await clearBoundUser();
        await clearOnboardingFlags();
      }
      setSyncing(true);
      const result = await runFullSync(userId);
      if (!result.ok) setLastSyncError(result.message);
      else setLastSyncError(null);
      await refreshOnboardingGate();
      setSyncing(false);
    },
    [refreshOnboardingGate]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const current = await getSession();
      if (!mounted) return;
      setSession(current);
      if (current?.user) {
        await bindAccount(current.user.id);
      } else {
        setNeedsGoalsSetup(false);
        setNeedsAiSetup(false);
        setNeedsStepsSetup(false);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        void bindAccount(next.user.id);
      } else {
        setNeedsGoalsSetup(false);
        setNeedsAiSetup(false);
        setNeedsStepsSetup(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [bindAccount]);

  useEffect(() => {
    if (!session?.user) return;
    const net = NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncNow();
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });
    return () => {
      net();
      app.remove();
    };
  }, [session?.user, syncNow]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInWithEmail(email, password);
    if (!result.ok) return result;
    return { ok: true as const };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await signUpWithEmail(email, password);
    if (!result.ok) return result;
    await startPostSignupOnboarding();
    setNeedsGoalsSetup(true);
    setNeedsAiSetup(true);
    setNeedsStepsSetup(true);
    return { ok: true as const };
  }, []);

  const finishAiOnboarding = useCallback(async () => {
    await completeAiOnboarding();
    setNeedsAiSetup(false);
  }, []);

  const finishStepsOnboarding = useCallback(async () => {
    await completeStepsOnboarding();
    setNeedsStepsSetup(false);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut();
    setSession(null);
    setNeedsGoalsSetup(false);
    setNeedsAiSetup(false);
    setNeedsStepsSetup(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      configured: isSupabaseConfigured(),
      session,
      user: session?.user ?? null,
      needsGoalsSetup,
      needsAiSetup,
      needsStepsSetup,
      syncing,
      lastSyncError,
      refreshOnboardingGate,
      finishAiOnboarding,
      finishStepsOnboarding,
      signIn,
      signUp,
      signOutUser,
      sendPasswordReset: resetPassword,
      syncNow,
    }),
    [
      loading,
      session,
      needsGoalsSetup,
      needsAiSetup,
      needsStepsSetup,
      syncing,
      lastSyncError,
      refreshOnboardingGate,
      finishAiOnboarding,
      finishStepsOnboarding,
      signIn,
      signUp,
      signOutUser,
      syncNow,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
