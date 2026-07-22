/** Debounced background sync — registered by AuthContext when signed in. */
let runner: (() => Promise<void>) | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

export function setSyncRunner(fn: (() => Promise<void>) | null): void {
  runner = fn;
  if (!fn) {
    clearTimeout(timer);
    timer = undefined;
  }
}

export function scheduleSync(): void {
  if (!runner) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void runner?.();
  }, 1500);
}
