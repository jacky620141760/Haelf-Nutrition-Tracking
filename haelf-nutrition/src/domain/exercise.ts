import type { ExerciseEntry } from './types';

export type ExerciseKind = 'cardio' | 'strength';

/** Rough estimates (not medical-grade). */
export const CARDIO_KCAL_PER_MIN = 8;
/** Average burn per working set, including short rests between sets. */
export const STRENGTH_KCAL_PER_SET = 8;
/** Nominal minutes stored per set so duration_minutes stays > 0 for stats. */
export const STRENGTH_MIN_PER_SET = 2.5;

export const CARDIO_DURATION_PRESETS = [15, 30, 45, 60, 90] as const;
export const STRENGTH_SET_PRESETS = [6, 8, 10, 12, 15, 20, 24] as const;

export function estimateCardioKcal(durationMinutes: number): number {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  return Math.round(CARDIO_KCAL_PER_MIN * durationMinutes);
}

export function estimateStrengthKcal(sets: number): number {
  if (!Number.isFinite(sets) || sets <= 0) return 0;
  return Math.round(STRENGTH_KCAL_PER_SET * sets);
}

export function strengthDurationMinutes(sets: number): number {
  return Math.max(1, Math.round(sets * STRENGTH_MIN_PER_SET * 10) / 10);
}

export function formatStrengthName(label: string, sets: number): string {
  return `${label} · ${sets}`;
}

/** Parse "重訓 · 12" / "Strength · 12" style names. */
export function parseStrengthSets(name: string): number | null {
  const match = name.trim().match(/·\s*(\d+)\s*$/);
  if (!match) return null;
  const sets = Number(match[1]);
  return Number.isFinite(sets) && sets > 0 ? sets : null;
}

export function isValidExercise(input: {
  name: string;
  durationMinutes: number;
  burnedKcal: number;
}): boolean {
  return (
    input.name.trim().length > 0 &&
    Number.isFinite(input.durationMinutes) &&
    input.durationMinutes > 0 &&
    input.durationMinutes <= 1_440 &&
    Number.isFinite(input.burnedKcal) &&
    input.burnedKcal >= 0 &&
    input.burnedKcal <= 20_000
  );
}

export function isValidStrengthSets(sets: number): boolean {
  return Number.isFinite(sets) && sets > 0 && sets <= 200 && Number.isInteger(sets);
}

export function totalExerciseKcal(entries: ExerciseEntry[]): number {
  return entries.reduce((total, entry) => total + entry.burnedKcal, 0);
}

export function totalExerciseMinutes(entries: ExerciseEntry[]): number {
  return entries.reduce((total, entry) => total + entry.durationMinutes, 0);
}

export function inferExerciseKind(
  name: string,
  cardioLabel: string,
  strengthLabel: string
): ExerciseKind {
  const n = name.trim().toLowerCase();
  if (
    n.startsWith(strengthLabel.toLowerCase()) ||
    n.includes('strength') ||
    n.includes('重訓') ||
    n.includes('重量')
  ) {
    return 'strength';
  }
  if (n === cardioLabel.toLowerCase() || n.includes('cardio') || n.includes('有氧')) {
    return 'cardio';
  }
  return parseStrengthSets(name) != null ? 'strength' : 'cardio';
}
