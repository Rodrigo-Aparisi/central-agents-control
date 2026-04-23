import { HealthResponse } from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

export const healthRoutes = fp(
  async (fastify: FastifyInstance) => {
    fastify
      .withTypeProvider<ZodTypeProvider>()
      .get(
        '/v1/health',
        { schema: { response: { 200: HealthResponse, 503: HealthResponse } } },
        async (_req, reply) => {
          const db = await pingDb(fastify);
          const redis = await pingRedis(fastify);
          const healthy = db === 'ok' && redis === 'ok';
          const body = {
            status: healthy ? ('ok' as const) : ('degraded' as const),
            db,
            redis,
            timestamp: new Date().toISOString(),
          };
          return reply.code(healthy ? 200 : 503).send(body);
        },
      );
  },
  { name: 'routes:health', dependencies: ['db', 'redis'] },
);

async function pingDb(fastify: FastifyInstance): Promise<'ok' | 'error'> {
  try {
    await fastify.db.ping();
    return 'ok';
  } catch (err) {
    fastify.log.warn({ err }, 'db healthcheck failed');
    return 'error';
  }
}

async function pingRedis(fastify: FastifyInstance): Promise<'ok' | 'error'> {
  try {
    const pong = await fastify.redis.ping();
    return pong === 'PONG' ? 'ok' : 'error';
  } catch (err) {
    fastify.log.warn({ err }, 'redis healthcheck failed');
    return 'error';
  }
}
