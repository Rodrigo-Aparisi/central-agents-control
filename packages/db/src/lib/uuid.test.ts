import { describe, expect, it } from 'vitest';
import { newId } from './uuid';

describe('newId (UUID v7)', () => {
  it('returns a valid UUID string', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates monotonically-ordered IDs', () => {
    const ids = Array.from({ length: 10 }, () => newId());
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });

  it('produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });
});
