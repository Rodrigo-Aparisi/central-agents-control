import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export const rateLimitPlugin = fp(
  async (fastify: FastifyInstance) => {
    if (!fastify.config.RATE_LIMIT_ENABLED) return;
    await fastify.register(rateLimit, {
      max: 60,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip,
      errorResponseBuilder: (_req, context) => ({
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Retry after ${context.after}`,
          retryAfterMs: context.ttl,
        },
      }),
    });
  },
  { name: 'rate-limit', dependencies: ['config'] },
);
