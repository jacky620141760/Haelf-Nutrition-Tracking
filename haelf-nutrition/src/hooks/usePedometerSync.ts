import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useApp } from '../context/AppContext';
import { startPedometerWatch, syncPedometerToday } from '../services/pedometer';

/** iOS HealthKit batch read as a fallback when live watch events are sparse. */
const IOS_POLL_MS = 45_000;

/**
 * Keep today's step count fresh app-wide (diary, habits, stats).
 * Previously only the /steps screen subscribed to the pedometer.
 */
export function usePedometerSync() {
  const { ready, preferences, todayLocalDate, bumpRefresh } = useApp();

  useEffect(() => {
    if (!ready || preferences.stepMode !== 'pedometer') return;

    let disposed = false;
    let subscription: { remove: () => void } | null = null;

    const publish = () => bumpRefresh();

    void startPedometerWatch(todayLocalDate, publish).then((sub) => {
      if (disposed) sub?.remove();
      else subscription = sub;
    });

    const pullFromOs = () => {
      void syncPedometerToday(todayLocalDate).then((total) => {
        if (!disposed && total) publish();
      });
    };

    pullFromOs();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') pullFromOs();
    });

    const poll =
      Platform.OS === 'ios' ? setInterval(pullFromOs, IOS_POLL_MS) : undefined;

    return () => {
      disposed = true;
      subscription?.remove();
      appState.remove();
      if (poll) clearInterval(poll);
    };
  }, [ready, preferences.stepMode, todayLocalDate, bumpRefresh]);
}
