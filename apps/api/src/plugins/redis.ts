import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import type { Config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export const redisPlugin = fp(
  async (fastify: FastifyInstance, opts: { config: Config }) => {
    const redis = new Redis(opts.config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redis.on('error', (err) => {
      fastify.log.error({ err }, 'redis error');
    });

    fastify.decorate('redis', redis);

    fastify.addHook('onClose', async () => {
      redis.disconnect();
    });
  },
  { name: 'redis' },
);
