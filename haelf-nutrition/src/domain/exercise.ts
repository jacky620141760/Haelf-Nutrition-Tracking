import type { ExerciseEntry } from './types';

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

export function totalExerciseKcal(entries: ExerciseEntry[]): number {
  return entries.reduce((total, entry) => total + entry.burnedKcal, 0);
}

export function totalExerciseMinutes(entries: ExerciseEntry[]): number {
  return entries.reduce((total, entry) => total + entry.durationMinutes, 0);
}
