export function createLogGroupId(now = new Date()): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${now.getTime().toString(36)}-${random}`;
}
