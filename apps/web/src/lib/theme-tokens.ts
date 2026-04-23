/**
 * Reads a CSS custom property from the document root. Recharts needs raw
 * colour strings, so we resolve them at mount/theme-change time.
 */
export function readToken(name: string, fallback = ''): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}
