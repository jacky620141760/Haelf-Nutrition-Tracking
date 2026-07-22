export function normalizeBarcode(raw: string): string {
  return raw.replace(/\s+/g, '');
}
