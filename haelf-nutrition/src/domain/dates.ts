import type { TimeZoneMetadata } from './types';

export function getTimeZoneMetadata(date = new Date()): TimeZoneMetadata {
  const iana = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const utcOffsetMinutes = -date.getTimezoneOffset();
  return { iana, utcOffsetMinutes };
}

export function toLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function utcNowIso(date = new Date()): string {
  return date.toISOString();
}

export function addLocalDays(localDate: string, delta: number): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return toLocalDateString(dt);
}

export function localDateRangeEnding(endDate: string, days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    result.push(addLocalDays(endDate, -i));
  }
  return result;
}

export function parseLocalDateToDate(localDate: string): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function compareLocalDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export type DayBoundaryListener = (localDate: string) => void;

/**
 * Day_Boundary_Manager: updates current Local_Date within 60s of midnight or foreground.
 */
export class DayBoundaryManager {
  private currentLocalDate: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<DayBoundaryListener>();

  constructor() {
    this.currentLocalDate = toLocalDateString();
  }

  getCurrentLocalDate(): string {
    return this.currentLocalDate;
  }

  subscribe(listener: DayBoundaryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l(this.currentLocalDate);
  }

  checkAndUpdate(): boolean {
    const next = toLocalDateString();
    if (next !== this.currentLocalDate) {
      this.currentLocalDate = next;
      this.emit();
      return true;
    }
    return false;
  }

  start(): void {
    this.checkAndUpdate();
    if (this.timer) return;
    // Poll every 30s so midnight updates within 60s (Req 5.4)
    this.timer = setInterval(() => this.checkAndUpdate(), 30_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Recompute Local_Date + TZ for an edited wall-clock time using device TZ now. */
  metadataForEditedTime(date: Date): {
    utcTimestamp: string;
    localDate: string;
    tz: TimeZoneMetadata;
  } {
    const tz = getTimeZoneMetadata(date);
    return {
      utcTimestamp: utcNowIso(date),
      localDate: toLocalDateString(date),
      tz,
    };
  }
}

export const dayBoundaryManager = new DayBoundaryManager();
