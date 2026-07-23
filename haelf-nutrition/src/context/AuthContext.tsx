import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import {
  getSession,
  isSupabaseConfigured,
  resetPassword,
  signInAsGuest,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  supabase,
} from '../services/auth/client';
import { awaitSyncIdle, prepareAccountForSync, runFullSync } from '../services/sync/engine';
import { setSyncRunner } from '../services/sync/scheduler';
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
import { useApp } from './AppContext';

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
  signInGuest: () => Promise<{ ok: true } | { ok: false; message: string }>;
  signOutUser: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  syncNow: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { reloadFromDb } = useApp();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [needsGoalsSetup, setNeedsGoalsSetup] = useState(false);
  const [needsAiSetup, setNeedsAiSetup] = useState(false);
  const [needsStepsSetup, setNeedsStepsSetup] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const bindInFlight = useRef<Promise<void> | null>(null);
  const bindUserId = useRef<string | null>(null);
  const autoSyncReady = useRef(false);

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
    // Avoid overlapping bindAccount wipe + background sync.
    if (bindInFlight.current) {
      await bindInFlight.current;
      return;
    }
    setSyncing(true);
    setLastSyncError(null);
    const result = await runFullSync(userId);
    if (!result.ok) setLastSyncError(result.message);
    else await reloadFromDb();
    await refreshOnboardingGate();
    setSyncing(false);
  }, [session?.user?.id, refreshOnboardingGate, reloadFromDb]);

  const bindAccount = useCallback(
    async (userId: string) => {
      if (bindInFlight.current && bindUserId.current === userId) {
        return bindInFlight.current;
      }
      bindUserId.current = userId;
      const work = (async () => {
        try {
          // Finish any in-flight sync before wipe so we do not clear mid-push.
          await awaitSyncIdle();
          const { cleared } = await prepareAccountForSync(userId);
          if (cleared) {
            await clearOnboardingFlags();
            await reloadFromDb();
          }
          setSyncing(true);
          const result = await runFullSync(userId);
          if (!result.ok) setLastSyncError(result.message);
          else {
            setLastSyncError(null);
            await reloadFromDb();
          }
          await refreshOnboardingGate();
        } finally {
          setSyncing(false);
          if (bindUserId.current === userId) {
            bindInFlight.current = null;
          }
        }
      })();
      bindInFlight.current = work;
      return work;
    },
    [refreshOnboardingGate, reloadFromDb]
  );

  useEffect(() => {
    if (!session?.user) {
      setSyncRunner(null);
      autoSyncReady.current = false;
      return;
    }
    setSyncRunner(syncNow);
    return () => setSyncRunner(null);
  }, [session?.user, syncNow]);

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
      if (mounted) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        void bindAccount(next.user.id);
      } else {
        bindUserId.current = null;
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
    if (!session?.user) {
      autoSyncReady.current = false;
      return;
    }
    // Skip the first NetInfo/AppState burst right after login/signup bind.
    autoSyncReady.current = false;
    const arm = setTimeout(() => {
      autoSyncReady.current = true;
    }, 2500);

    const net = NetInfo.addEventListener((state) => {
      if (!autoSyncReady.current) return;
      if (state.isConnected) void syncNow();
    });
    const app = AppState.addEventListener('change', (state) => {
      if (!autoSyncReady.current) return;
      if (state === 'active') void syncNow();
    });
    return () => {
      clearTimeout(arm);
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
    // Wait for account bind (and any wipe) before writing onboarding flags,
    // otherwise clearAllAppTables can delete sync_state mid-write and lock SQLite.
    const userId = (await getSession())?.user?.id;
    if (userId) {
      await bindAccount(userId);
    }
    await startPostSignupOnboarding();
    setNeedsGoalsSetup(true);
    setNeedsAiSetup(true);
    setNeedsStepsSetup(true);
    return { ok: true as const };
  }, [bindAccount]);

  const signInGuest = useCallback(async () => {
    // Wipe first so guest always restarts onboarding from a blank slate.
    await awaitSyncIdle();
    await clearAllAppTables();
    await clearOnboardingFlags();

    const result = await signInAsGuest();
    if (!result.ok) return result;

    const userId = result.user.id;
    await bindAccount(userId);
    await startPostSignupOnboarding();
    setNeedsGoalsSetup(true);
    setNeedsAiSetup(true);
    setNeedsStepsSetup(true);
    return { ok: true as const };
  }, [bindAccount]);

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
      signInGuest,
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
      signInGuest,
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
