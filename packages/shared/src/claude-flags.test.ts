import { describe, expect, it } from 'vitest';
import { ALLOWED_CLAUDE_FLAGS, ClaudeFlagsInput, isAllowedFlag } from './claude-flags';

describe('ALLOWED_CLAUDE_FLAGS', () => {
  it('whitelists only the expected flags', () => {
    expect([...ALLOWED_CLAUDE_FLAGS].sort()).toEqual(
      ['--max-turns', '--model', '--no-cache', '--output-format', '--verbose'].sort(),
    );
  });

  it('accepts a valid flag combination', () => {
    const result = ClaudeFlagsInput.safeParse(['--model', 'claude-sonnet-4-6']);
    expect(result.success).toBe(true);
  });

  it('rejects unknown flags', () => {
    const result = ClaudeFlagsInput.safeParse(['--allow-everything']);
    expect(result.success).toBe(false);
  });

  it('isAllowedFlag returns false for unknown', () => {
    expect(isAllowedFlag('--dangerous')).toBe(false);
    expect(isAllowedFlag('--model')).toBe(true);
  });
});
