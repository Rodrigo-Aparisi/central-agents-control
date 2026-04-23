import { describe, expect, it } from 'vitest';
import { redactString, redactUnknown } from './redact';

describe('redactString', () => {
  it('redacts Anthropic API keys', () => {
    const out = redactString('key=sk-ant-api-1234567890abcdefABCDEF please');
    expect(out).toBe('key=[ANTHROPIC_KEY_REDACTED] please');
  });

  it('redacts GitHub PATs', () => {
    const token = `ghp_${'A'.repeat(36)}`;
    const out = redactString(`token: ${token} end`);
    expect(out).toBe('token: [GITHUB_PAT_REDACTED] end');
  });

  it('redacts GitHub OAuth tokens', () => {
    const token = `gho_${'B'.repeat(36)}`;
    expect(redactString(token)).toBe('[GITHUB_OAUTH_REDACTED]');
  });

  it('redacts credentials embedded in URLs', () => {
    const out = redactString('clone https://user:p%40ss@github.com/x.git now');
    expect(out).toBe('clone https://[CREDENTIALS_REDACTED]@github.com/x.git now');
  });

  it('redacts ANTHROPIC_API_KEY= env assignments', () => {
    const out = redactString('ANTHROPIC_API_KEY=sk-ant-12345 something');
    expect(out).toContain('ANTHROPIC_API_KEY=[REDACTED]');
    expect(out).not.toContain('sk-ant-12345');
  });

  it('preserves strings without secrets', () => {
    expect(redactString('hello world')).toBe('hello world');
  });
});

describe('redactUnknown', () => {
  it('redacts strings inside nested objects', () => {
    const out = redactUnknown({
      a: 'plain',
      b: { token: `ghp_${'C'.repeat(36)}` },
      c: ['sk-ant-api-XXXXXXXXXXXXXXXXXXXX'],
    });
    expect(out).toEqual({
      a: 'plain',
      b: { token: '[GITHUB_PAT_REDACTED]' },
      c: ['[ANTHROPIC_KEY_REDACTED]'],
    });
  });

  it('bails on deep recursion without throwing', () => {
    const cycle: { x?: unknown } = {};
    cycle.x = cycle;
    expect(() => redactUnknown(cycle)).not.toThrow();
  });

  it('passes through primitives unchanged', () => {
    expect(redactUnknown(42)).toBe(42);
    expect(redactUnknown(null)).toBe(null);
    expect(redactUnknown(undefined)).toBe(undefined);
    expect(redactUnknown(true)).toBe(true);
  });
});
