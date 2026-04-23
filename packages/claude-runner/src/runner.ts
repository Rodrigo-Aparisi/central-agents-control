import { setTimeout as delay } from 'node:timers/promises';
import type { EventPayload, RunParams, RunUsage } from '@cac/shared';
import { execa } from 'execa';
import { buildClaudeArgs } from './args';
import { validateProjectRoot } from './cwd';
import { buildSanitizedEnv } from './env';
import { RunnerError } from './errors';
import { type ParserOutput, parseStream } from './parser';
import { redactString, redactUnknown } from './redact';

export type RunnerExitReason = 'completed' | 'cancelled' | 'timeout' | 'crashed';

export interface RunnerConfig {
  runId: string;
  projectRoot: string;
  prompt: string;
  params: RunParams;
  claudeBin: string;
  projectsRoot: string;
  signal?: AbortSignal;
  parentEnv?: NodeJS.ProcessEnv;
  /** Extra env vars merged on top of the whitelist (e.g. project-scoped secrets). */
  envExtras?: Record<string, string>;
  sigkillGraceMs?: number;
  now?: () => number;
  /** Test hook: args prepended before the standard -p/--output-format sequence. */
  argsPrefix?: string[];
}

export interface ExitResult {
  exitCode: number;
  durationMs: number;
  usage: RunUsage;
  reason: RunnerExitReason;
  error?: RunnerError;
}

export interface RunnerHandle {
  runId: string;
  events: AsyncIterable<ParserOutput>;
  result: Promise<ExitResult>;
  cancel: (reason?: string) => void;
}

const DEFAULT_SIGKILL_GRACE_MS = 5_000;

export function startRunner(config: RunnerConfig): RunnerHandle {
  const resolvedRoot = validateProjectRoot({
    projectRoot: config.projectRoot,
    projectsRoot: config.projectsRoot,
  });

  const env = buildSanitizedEnv({ parent: config.parentEnv, extra: config.envExtras });
  const builtArgs = buildClaudeArgs({ prompt: config.prompt, params: config.params });
  const args = config.argsPrefix ? [...config.argsPrefix, ...builtArgs] : builtArgs;
  const now = config.now ?? Date.now;
  const graceMs = config.sigkillGraceMs ?? DEFAULT_SIGKILL_GRACE_MS;
  const startedAt = now();

  const subprocess = execa(config.claudeBin, args, {
    cwd: resolvedRoot,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    reject: false,
    cleanup: true,
    timeout: config.params.timeoutMs,
  });

  let cancelReason: 'cancelled' | 'timeout' | undefined;
  let cancelled = false;

  const cancel = (reason?: string): void => {
    if (cancelled) return;
    cancelled = true;
    cancelReason = reason === 'timeout' ? 'timeout' : 'cancelled';
    try {
      subprocess.kill('SIGTERM');
    } catch {
      // already dead
    }
    void delay(graceMs).then(() => {
      if (subprocess.killed) return;
      try {
        subprocess.kill('SIGKILL');
      } catch {
        // already dead
      }
    });
  };

  if (config.signal) {
    if (config.signal.aborted) {
      cancel('aborted');
    } else {
      config.signal.addEventListener('abort', () => cancel('aborted'), { once: true });
    }
  }

  const usage: RunUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    estimatedCostUsd: 0,
  };

  async function* events(): AsyncGenerator<ParserOutput, void, void> {
    const { stdout } = subprocess;
    if (!stdout) return;
    for await (const ev of parseStream(stdout)) {
      if (ev.kind === 'event' && ev.payload.type === 'usage') {
        usage.inputTokens = ev.payload.inputTokens;
        usage.outputTokens = ev.payload.outputTokens;
        usage.cacheReadTokens = ev.payload.cacheReadTokens;
        usage.cacheWriteTokens = ev.payload.cacheWriteTokens;
      }
      yield redactEvent(ev);
    }
  }

  const result: Promise<ExitResult> = (async () => {
    const child = await subprocess;
    const durationMs = now() - startedAt;

    let reason: RunnerExitReason;
    let error: RunnerError | undefined;

    if (cancelled) {
      reason = cancelReason ?? 'cancelled';
    } else if (child.timedOut) {
      reason = 'timeout';
      error = new RunnerError('TIMEOUT', `run exceeded ${config.params.timeoutMs}ms`);
    } else if (child.failed && child.signal) {
      reason = 'crashed';
      error = new RunnerError('CRASHED', `killed by signal ${child.signal}`);
    } else if (child.exitCode === 0) {
      reason = 'completed';
    } else {
      reason = 'crashed';
      error = new RunnerError('CRASHED', `claude exited with code ${child.exitCode ?? 'null'}`, {
        stderr: redactString(String(child.stderr ?? '')).slice(0, 2048),
      });
    }

    return {
      exitCode: child.exitCode ?? -1,
      durationMs,
      usage,
      reason,
      ...(error ? { error } : {}),
    };
  })();

  return {
    runId: config.runId,
    events: events(),
    result,
    cancel,
  };
}

function redactEvent(ev: ParserOutput): ParserOutput {
  if (ev.kind === 'event') {
    const redacted = redactUnknown(ev.payload) as EventPayload;
    return { ...ev, payload: redacted };
  }
  if (ev.kind === 'parse-error') {
    return { ...ev, raw: redactString(ev.raw) };
  }
  return ev;
}
