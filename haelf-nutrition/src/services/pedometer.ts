import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import type { DailyStepTotal } from '../domain/types';
import { getDailyStepTotal, upsertDailyStepTotal } from '../db/repositories/steps';

export type PedometerStatus =
  | { available: false; granted: false; reason: 'unavailable' }
  | { available: true; granted: false; reason: 'permission' }
  | { available: true; granted: true };

export async function getPedometerStatus(
  requestPermission = false
): Promise<PedometerStatus> {
  const available = await Pedometer.isAvailableAsync();
  if (!available) return { available: false, granted: false, reason: 'unavailable' };
  const permission = requestPermission
    ? await Pedometer.requestPermissionsAsync()
    : await Pedometer.getPermissionsAsync();
  if (!permission.granted) {
    return { available: true, granted: false, reason: 'permission' };
  }
  return { available: true, granted: true };
}

function startOfLocalDay(localDate: string): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

async function savePedometerSteps(
  localDate: string,
  steps: number
): Promise<DailyStepTotal> {
  const current = await getDailyStepTotal(localDate);
  if (current?.source === 'manual') return current;
  await upsertDailyStepTotal({ localDate, steps: Math.max(0, Math.round(steps)), source: 'pedometer' });
  return (await getDailyStepTotal(localDate))!;
}

export async function syncPedometerToday(
  localDate: string,
  requestPermission = false
): Promise<DailyStepTotal | null> {
  const status = await getPedometerStatus(requestPermission);
  if (!status.granted || Platform.OS !== 'ios') return getDailyStepTotal(localDate);
  const result = await Pedometer.getStepCountAsync(startOfLocalDay(localDate), new Date());
  return savePedometerSteps(localDate, result.steps);
}

export async function startPedometerWatch(
  localDate: string,
  onUpdate: (total: DailyStepTotal) => void
): Promise<ReturnType<typeof Pedometer.watchStepCount> | null> {
  const status = await getPedometerStatus(false);
  if (!status.granted) return null;
  const initial = await syncPedometerToday(localDate);
  const baseline = initial?.source === 'pedometer' ? initial.steps : 0;
  return Pedometer.watchStepCount((result) => {
    void savePedometerSteps(localDate, baseline + result.steps).then(onUpdate);
  });
}
