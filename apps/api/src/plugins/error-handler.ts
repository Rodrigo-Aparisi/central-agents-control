import { AppError, type ErrorCode } from '@cac/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { ZodError } from 'zod';

interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}

export const errorHandlerPlugin = fp(
  (fastify: FastifyInstance) => {
    fastify.setErrorHandler((err: FastifyError | AppError | Error, req, reply) => {
      if (err instanceof AppError) {
        req.log.warn({ err, code: err.code }, 'AppError');
        return reply.code(err.statusCode).send(err.toJSON());
      }

      if (hasZodFastifySchemaValidationErrors(err)) {
        req.log.warn({ err }, 'schema validation failed');
        const body: ErrorBody = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: err.validation,
          },
        };
        return reply.code(400).send(body);
      }

      if (err instanceof ZodError) {
        req.log.warn({ err }, 'zod validation failed');
        const body: ErrorBody = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: err.flatten(),
          },
        };
        return reply.code(400).send(body);
      }

      const fastifyErr = err as FastifyError;
      if (fastifyErr.statusCode && fastifyErr.statusCode < 500) {
        const code: ErrorCode =
          fastifyErr.statusCode === 404
            ? 'NOT_FOUND'
            : fastifyErr.statusCode === 401
              ? 'UNAUTHORIZED'
              : fastifyErr.statusCode === 403
                ? 'FORBIDDEN'
                : fastifyErr.statusCode === 429
                  ? 'RATE_LIMITED'
                  : 'VALIDATION_ERROR';
        const body: ErrorBody = {
          error: { code, message: fastifyErr.message },
        };
        return reply.code(fastifyErr.statusCode).send(body);
      }

      req.log.error({ err }, 'unhandled error');
      const body: ErrorBody = {
        error: { code: 'INTERNAL', message: 'Internal server error' },
      };
      return reply.code(500).send(body);
    });

    fastify.setNotFoundHandler((_req, reply) => {
      const body: ErrorBody = {
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      };
      return reply.code(404).send(body);
    });
  },
  { name: 'error-handler' },
);
