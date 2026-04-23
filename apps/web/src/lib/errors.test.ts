import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { humanizeError } from './errors';

describe('humanizeError', () => {
  it('maps known error codes to Spanish messages', () => {
    const err = new ApiError(404, { code: 'NOT_FOUND', message: 'project 123 not found' });
    const msg = humanizeError(err);
    expect(msg).toContain('No encontrado');
    expect(msg).toContain('project 123 not found');
  });

  it('handles unknown errors gracefully', () => {
    expect(humanizeError(new Error('boom'))).toBe('boom');
    expect(humanizeError('weird')).toBe('Error desconocido');
  });

  it('falls back to code when message equals code', () => {
    const err = new ApiError(500, { code: 'INTERNAL', message: 'INTERNAL' });
    expect(humanizeError(err)).toBe('Error interno del servidor');
  });
});
