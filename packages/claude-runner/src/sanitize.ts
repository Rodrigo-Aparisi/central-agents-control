import { z } from 'zod';
import { RunnerError } from './errors';

export const MAX_PROMPT_BYTES = 50 * 1024;

const CONTROL_CHARS_RE = buildControlCharsRegex();

function buildControlCharsRegex(): RegExp {
  // Strip C0 control chars (U+0000..U+001F) except TAB (0x09) and LF (0x0A),
  // plus DEL (U+007F). CR, VT, FF, BEL etc. are removed.
  const points: string[] = [];
  for (let cp = 0; cp < 0x20; cp++) {
    if (cp === 0x09 || cp === 0x0a) continue;
    points.push(`\\u${cp.toString(16).padStart(4, '0')}`);
  }
  points.push('\\u007f');
  return new RegExp(`[${points.join('')}]`, 'g');
}

export function stripControlChars(s: string): string {
  return s.replace(CONTROL_CHARS_RE, '');
}

export const SanitizedString = z.string().max(MAX_PROMPT_BYTES).transform(stripControlChars);

export function sanitizePrompt(raw: unknown): string {
  const parsed = SanitizedString.safeParse(raw);
  if (!parsed.success) {
    throw new RunnerError('INVALID_INPUT', 'prompt failed sanitization', parsed.error.flatten());
  }
  return parsed.data;
}

export function sanitizeIdentifier(raw: unknown, label: string): string {
  const schema = z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9_.\-/:]+$/, `${label} contains disallowed characters`);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new RunnerError('INVALID_INPUT', `invalid ${label}`, parsed.error.flatten());
  }
  return parsed.data;
}
