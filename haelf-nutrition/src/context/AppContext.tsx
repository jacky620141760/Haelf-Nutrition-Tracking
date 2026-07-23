import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { dayBoundaryManager, toLocalDateString } from '../domain/dates';
import type { AppPreferences, DbInitResult } from '../domain/types';
import { initDatabase, deleteDatabaseAndReopen } from '../db/database';
import { maintainBarcodeCache } from '../db/repositories/barcode';
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  updatePreferences as persistPreferences,
} from '../db/repositories/preferences';
import { isWebPreview } from '../services/secureStore';
import { translate } from '../i18n';
import { usePedometerSync } from '../hooks/usePedometerSync';

function PedometerSyncBridge() {
  usePedometerSync();
  return null;
}

type AppContextValue = {
  ready: boolean;
  dbStatus: DbInitResult | null;
  todayLocalDate: string;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  goToToday: () => void;
  viewingHistory: boolean;
  refreshToken: number;
  bumpRefresh: () => void;
  reloadFromDb: () => Promise<void>;
  reinitDatabase: () => Promise<void>;
  wipeAndRestart: () => Promise<void>;
  isWeb: boolean;
  preferences: AppPreferences;
  updatePreferences: (
    patch: Partial<Omit<AppPreferences, 'updatedAt'>>
  ) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbInitResult | null>(null);
  const [todayLocalDate, setTodayLocalDate] = useState(toLocalDateString());
  const [selectedDate, setSelectedDate] = useState(toLocalDateString());
  const [refreshToken, setRefreshToken] = useState(0);
  const [followToday, setFollowToday] = useState(true);
  const [preferences, setPreferences] =
    useState<AppPreferences>(DEFAULT_PREFERENCES);
  const followTodayRef = useRef(true);

  const bumpRefresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  const reloadFromDb = useCallback(async () => {
    try {
      setPreferences(await getPreferences());
    } catch {
      /* ignore */
    }
    bumpRefresh();
  }, [bumpRefresh]);

  const boot = useCallback(async () => {
    const result = await initDatabase();
    setDbStatus(result);
    if (result.status === 'ready') {
      try {
        setPreferences(await getPreferences());
        await maintainBarcodeCache();
      } catch {
        /* ignore maintenance errors */
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    followTodayRef.current = followToday;
  }, [followToday]);

  useEffect(() => {
    dayBoundaryManager.start();
    const unsub = dayBoundaryManager.subscribe((d) => {
      setTodayLocalDate(d);
      if (followTodayRef.current) {
        setSelectedDate(d);
      }
    });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        dayBoundaryManager.checkAndUpdate();
      }
    });
    return () => {
      unsub();
      dayBoundaryManager.stop();
      sub.remove();
    };
  }, []);

  const onSelectDate = useCallback(
    (d: string) => {
      setSelectedDate(d);
      setFollowToday(d === todayLocalDate);
    },
    [todayLocalDate]
  );

  const goToToday = useCallback(() => {
    const d = toLocalDateString();
    setTodayLocalDate(d);
    setSelectedDate(d);
    setFollowToday(true);
  }, []);

  const reinitDatabase = useCallback(async () => {
    setReady(false);
    await boot();
  }, [boot]);

  const wipeAndRestart = useCallback(async () => {
    setReady(false);
    try {
      const result = await deleteDatabaseAndReopen();
      setDbStatus(result);
      if (result.status === 'ready') {
        try {
          setPreferences(await getPreferences());
          await maintainBarcodeCache();
        } catch {
          /* ignore */
        }
      }
      bumpRefresh();
    } catch (error) {
      setDbStatus({
        status: 'unsupported',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setReady(true);
    }
  }, [bumpRefresh]);

  const updatePreferences = useCallback(
    async (patch: Partial<Omit<AppPreferences, 'updatedAt'>>) => {
      setPreferences(await persistPreferences(patch));
      bumpRefresh();
    },
    [bumpRefresh]
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(preferences.locale, key, params),
    [preferences.locale]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      dbStatus,
      todayLocalDate,
      selectedDate,
      setSelectedDate: onSelectDate,
      goToToday,
      viewingHistory: selectedDate !== todayLocalDate,
      refreshToken,
      bumpRefresh,
      reloadFromDb,
      reinitDatabase,
      wipeAndRestart,
      isWeb: isWebPreview() || Platform.OS === 'web',
      preferences,
      updatePreferences,
      t,
    }),
    [
      ready,
      dbStatus,
      todayLocalDate,
      selectedDate,
      onSelectDate,
      goToToday,
      refreshToken,
      bumpRefresh,
      reloadFromDb,
      reinitDatabase,
      wipeAndRestart,
      preferences,
      updatePreferences,
      t,
    ]
  );

  return (
    <AppContext.Provider value={value}>
      <PedometerSyncBridge />
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp 必須在 AppProvider 內使用');
  return ctx;
}
