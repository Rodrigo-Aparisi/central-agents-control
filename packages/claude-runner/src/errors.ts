export const RUNNER_ERROR_CODES = [
  'INVALID_CWD',
  'SPAWN_FAILED',
  'PARSE_ERROR',
  'TIMEOUT',
  'CANCELLED',
  'CRASHED',
  'INVALID_INPUT',
] as const;

export type RunnerErrorCode = (typeof RUNNER_ERROR_CODES)[number];

export class RunnerError extends Error {
  readonly code: RunnerErrorCode;
  readonly details?: unknown;

  constructor(code: RunnerErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = 'RunnerError';
    this.code = code;
    this.details = details;
  }
}

export function isRunnerError(value: unknown): value is RunnerError {
  return value instanceof RunnerError;
}
