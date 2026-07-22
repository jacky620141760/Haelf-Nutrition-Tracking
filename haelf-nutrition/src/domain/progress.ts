import { theme } from '../theme';

export type RingSemantic = 'under' | 'onTrack' | 'approaching' | 'over' | 'none';

/** progress = goal > 0 ? consumed/goal : 0 */
export function nutrientProgress(consumed: number, goal: number | null | undefined): number {
  if (goal == null || goal <= 0) return 0;
  return consumed / goal;
}

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress) || progress < 0) return 0;
  return Math.min(progress, 1);
}

export function calorieRingSemantic(progress: number, hasGoal: boolean): RingSemantic {
  if (!hasGoal) return 'none';
  if (progress > 1) return 'over';
  if (progress >= 0.95) return 'approaching';
  if (progress >= 0.6) return 'onTrack';
  return 'under';
}

export function calorieRingColor(semantic: RingSemantic): string {
  switch (semantic) {
    case 'under':
      return theme.colors.underGoal;
    case 'onTrack':
      return theme.colors.lakeBlue;
    case 'approaching':
      return theme.colors.approaching;
    case 'over':
      return theme.colors.danger;
    default:
      return theme.colors.ringTrack;
  }
}

/** Remaining (or over-by when negative). */
export function remainingKcal(consumed: number, goal: number | null | undefined): number | null {
  if (goal == null || goal <= 0) return null;
  return goal - consumed;
}

import { addLocalDays, localDateGapDays, localDateRangeEnding } from './dates';

export type WeeklyWeightPoint = { label: string; value: number | null };

/** Rolling 7-day weekly averages, oldest → newest (default 12 weeks ≈ 3 months). */
export function rollingWeeklyWeightAverages(
  dailyKg: Map<string, number>,
  endDate: string,
  weekCount = 12
): WeeklyWeightPoint[] {
  const points: WeeklyWeightPoint[] = [];
  for (let i = 0; i < weekCount; i++) {
    const weekEnd = addLocalDays(endDate, -(weekCount - 1 - i) * 7);
    const days = localDateRangeEnding(weekEnd, 7);
    const values = days.map((d) => dailyKg.get(d)).filter((v): v is number => v != null);
    const avg = values.length ? values.reduce((sum, kg) => sum + kg, 0) / values.length : null;
    points.push({
      label: days[0].slice(5).replace('-', '/'),
      value: avg,
    });
  }
  const firstWithData = points.findIndex((p) => p.value != null);
  if (firstWithData === -1) return [];
  return points.slice(firstWithData);
}

export function splitContinuousSegments<T>(points: (T | null)[]): T[][] {
  const segments: T[][] = [];
  let current: T[] = [];
  for (const point of points) {
    if (point === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(point);
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

/** Index ranges for line segments; breaks on null values or calendar gaps > maxDayGap. */
export function splitTrendLineIndices(
  points: { label: string; value: number | null }[],
  maxDayGap = 1
): number[][] {
  const segments: number[][] = [];
  let current: number[] = [];

  for (let i = 0; i < points.length; i++) {
    if (points[i].value == null) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    if (current.length > 0) {
      const prev = points[current[current.length - 1]];
      if (localDateGapDays(prev.label, points[i].label) > maxDayGap) {
        segments.push(current);
        current = [];
      }
    }
    current.push(i);
  }
  if (current.length) segments.push(current);
  return segments;
}

/** One continuous line through all recorded points (skips null slots on the axis). */
export function recordedTrendLineIndices(points: { value: number | null }[]): number[][] {
  const indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i].value != null) indices.push(i);
  }
  if (indices.length < 2) return indices.length ? [indices] : [];
  return [indices];
}
