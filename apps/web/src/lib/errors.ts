import type { ErrorCode } from '@cac/shared';
import { ApiError } from './api';

const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Datos inválidos',
  NOT_FOUND: 'No encontrado',
  CONFLICT: 'Conflicto: la operación no es válida en este estado',
  RUNNER_FAILED: 'El runner falló',
  UNAUTHORIZED: 'No autorizado',
  FORBIDDEN: 'Acceso prohibido',
  RATE_LIMITED: 'Demasiadas peticiones, espera unos segundos',
  INTERNAL: 'Error interno del servidor',
};

export function humanizeError(err: unknown): string {
  if (err instanceof ApiError) {
    const base = MESSAGES[err.body.code] ?? err.body.message;
    return err.body.message && err.body.message !== err.body.code
      ? `${base}: ${err.body.message}`
      : base;
  }
  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}
