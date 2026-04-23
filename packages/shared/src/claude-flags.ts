import { z } from 'zod';

export const ALLOWED_CLAUDE_FLAGS = new Set<string>([
  '--model',
  '--max-turns',
  '--output-format',
  '--verbose',
  '--no-cache',
]);

export const ALLOWED_OUTPUT_FORMATS = new Set<string>(['stream-json']);

export const ClaudeFlagsInput = z
  .array(z.string())
  .refine((flags) => flags.every((f) => !f.startsWith('-') || ALLOWED_CLAUDE_FLAGS.has(f)), {
    message: 'flag not in whitelist',
  });

export function isAllowedFlag(flag: string): boolean {
  return ALLOWED_CLAUDE_FLAGS.has(flag);
}
