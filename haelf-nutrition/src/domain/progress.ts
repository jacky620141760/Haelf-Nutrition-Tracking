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
