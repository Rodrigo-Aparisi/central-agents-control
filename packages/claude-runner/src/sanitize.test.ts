import { describe, expect, it } from 'vitest';
import { RunnerError } from './errors';
import {
  MAX_PROMPT_BYTES,
  sanitizeIdentifier,
  sanitizePrompt,
  stripControlChars,
} from './sanitize';

const ESC = String.fromCharCode(0x1b);
const DEL = String.fromCharCode(0x7f);
const CR = String.fromCharCode(0x0d);

describe('stripControlChars', () => {
  it('removes C0 controls but keeps tab and newline', () => {
    const input = `a${ESC}bc\td\ne${ESC}f${DEL}g`;
    expect(stripControlChars(input)).toBe('abc\td\nefg');
  });

  it('removes carriage return (we normalize to LF-only)', () => {
    expect(stripControlChars(`line1${CR}\nline2`)).toBe('line1\nline2');
  });
});

describe('sanitizePrompt', () => {
  it('returns a cleaned string', () => {
    expect(sanitizePrompt('hello world')).toBe('hello world');
  });

  it('rejects non-strings', () => {
    expect(() => sanitizePrompt(123)).toThrow(RunnerError);
  });

  it('rejects strings longer than the 50KB cap', () => {
    const huge = 'x'.repeat(MAX_PROMPT_BYTES + 1);
    expect(() => sanitizePrompt(huge)).toThrow(RunnerError);
  });
});

describe('sanitizeIdentifier', () => {
  it('accepts safe identifiers', () => {
    expect(sanitizeIdentifier('proj-abc_123', 'projectId')).toBe('proj-abc_123');
  });

  it('rejects identifiers with spaces or shell metacharacters', () => {
    expect(() => sanitizeIdentifier('proj with space', 'projectId')).toThrow(RunnerError);
    expect(() => sanitizeIdentifier('proj;rm -rf', 'projectId')).toThrow(RunnerError);
    expect(() => sanitizeIdentifier('', 'projectId')).toThrow(RunnerError);
  });
});
