import { type CacDb, createDb } from '@cac/db';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { Config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    db: CacDb;
  }
}

export const dbPlugin = fp(
  async (fastify: FastifyInstance, opts: { config: Config }) => {
    const cac = createDb({ url: opts.config.DATABASE_URL });
    fastify.decorate('db', cac);

    fastify.addHook('onClose', async () => {
      await cac.close();
    });
  },
  { name: 'db', dependencies: [] },
);
