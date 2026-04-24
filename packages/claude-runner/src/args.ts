import { ALLOWED_CLAUDE_FLAGS, type RunParams } from '@cac/shared';
import { RunnerError } from './errors';

export interface BuildArgsOptions {
  prompt: string;
  params: RunParams;
}

export function buildClaudeArgs({ prompt, params }: BuildArgsOptions): string[] {
  const extra: string[] = [];
  for (let i = 0; i < params.flags.length; i++) {
    const flag = params.flags[i];
    if (typeof flag !== 'string') {
      throw new RunnerError('INVALID_INPUT', `flag at index ${i} is not a string`);
    }
    if (flag.startsWith('-') && !ALLOWED_CLAUDE_FLAGS.has(flag)) {
      throw new RunnerError('INVALID_INPUT', `flag not in whitelist: ${flag}`);
    }
    extra.push(flag);
  }

  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
  ];
  if (params.model && !extra.includes('--model')) {
    args.push('--model', params.model);
  }
  for (const f of extra) args.push(f);
  return args;
}
