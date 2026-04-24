/**
 * Postgres with mode:'string' returns "YYYY-MM-DD HH:mm:ss.ssssss+HH" — a space
 * separator and no colon in the tz offset.  Node.js/V8 Date parsing requires the
 * T separator and +HH:MM format, otherwise new Date() returns Invalid Date and
 * .toISOString() throws RangeError.  Normalize before converting.
 */
function normalizePgTs(ts: string): string {
  return ts
    .replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00');
}

export function isoTs(ts: string): string {
  return new Date(normalizePgTs(ts)).toISOString();
}

export function isoTsNullable(ts: string | null | undefined): string | null {
  return ts == null ? null : isoTs(ts);
}
