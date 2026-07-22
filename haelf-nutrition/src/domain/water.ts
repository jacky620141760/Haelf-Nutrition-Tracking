import type { WaterGoalVersion, WaterUnit } from './types';

export const ML_PER_CUP = 236.588;
export const ML_PER_OUNCE = 29.5735;

export function waterToMl(value: number, unit: WaterUnit): number {
  if (!Number.isFinite(value)) return value;
  if (unit === 'cup') return value * ML_PER_CUP;
  if (unit === 'oz') return value * ML_PER_OUNCE;
  return value;
}

export function mlToWater(value: number, unit: WaterUnit): number {
  if (!Number.isFinite(value)) return value;
  if (unit === 'cup') return value / ML_PER_CUP;
  if (unit === 'oz') return value / ML_PER_OUNCE;
  return value;
}

export function isValidWaterMl(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 20_000;
}

export function resolveWaterGoalForDate(
  versions: WaterGoalVersion[],
  localDate: string
): WaterGoalVersion | null {
  return (
    versions
      .filter((version) => version.effectiveDate <= localDate)
      .sort((a, b) =>
        a.effectiveDate === b.effectiveDate
          ? b.id - a.id
          : a.effectiveDate < b.effectiveDate
            ? 1
            : -1
      )[0] ?? null
  );
}
