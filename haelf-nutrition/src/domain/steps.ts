import type { DailyStepTotal } from './types';

export function normalizeSteps(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
  return Math.round(value);
}

export function preferManualSteps(
  current: DailyStepTotal | null,
  incoming: DailyStepTotal
): DailyStepTotal {
  if (current?.source === 'manual' && incoming.source === 'pedometer') return current;
  return incoming;
}
