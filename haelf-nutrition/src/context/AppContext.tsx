import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { dayBoundaryManager, toLocalDateString } from '../domain/dates';
import type { DbInitResult } from '../domain/types';
import { initDatabase, deleteDatabaseAndReopen } from '../db/database';
import { maintainBarcodeCache } from '../db/repositories/barcode';
import { isWebPreview } from '../services/secureStore';

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
  reinitDatabase: () => Promise<void>;
  wipeAndRestart: () => Promise<void>;
  isWeb: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbInitResult | null>(null);
  const [todayLocalDate, setTodayLocalDate] = useState(toLocalDateString());
  const [selectedDate, setSelectedDate] = useState(toLocalDateString());
  const [refreshToken, setRefreshToken] = useState(0);
  const [followToday, setFollowToday] = useState(true);

  const bumpRefresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  const boot = useCallback(async () => {
    const result = await initDatabase();
    setDbStatus(result);
    if (result.status === 'ready') {
      try {
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
    dayBoundaryManager.start();
    const unsub = dayBoundaryManager.subscribe((d) => {
      setTodayLocalDate(d);
      if (followToday) {
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
  }, [followToday]);

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
    const result = await deleteDatabaseAndReopen();
    setDbStatus(result);
    if (result.status === 'ready') {
      try {
        await maintainBarcodeCache();
      } catch {
        /* ignore */
      }
    }
    setReady(true);
    bumpRefresh();
  }, [bumpRefresh]);

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
      reinitDatabase,
      wipeAndRestart,
      isWeb: isWebPreview() || Platform.OS === 'web',
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
      reinitDatabase,
      wipeAndRestart,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp 必須在 AppProvider 內使用');
  return ctx;
}
