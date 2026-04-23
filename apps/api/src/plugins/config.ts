import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { Config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}

export const configPlugin = fp(
  (fastify: FastifyInstance, opts: { config: Config }) => {
    fastify.decorate('config', opts.config);
  },
  { name: 'config' },
);
