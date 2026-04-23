import { z } from 'zod';

export const ErrorCode = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'RUNNER_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError('VALIDATION_ERROR', message, 400, details);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError('NOT_FOUND', message, 404);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError('CONFLICT', message, 409, details);
  }

  static runnerFailed(message: string, details?: unknown): AppError {
    return new AppError('RUNNER_FAILED', message, 500, details);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError('INTERNAL', message, 500);
  }
}
