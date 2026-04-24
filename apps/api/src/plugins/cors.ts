import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export const corsPlugin = fp(
  async (fastify: FastifyInstance) => {
    const origins =
      fastify.config.ALLOWED_ORIGINS.trim().length > 0
        ? fastify.config.ALLOWED_ORIGINS.split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : ['http://localhost:5173', 'http://127.0.0.1:5173'];

    await fastify.register(cors, {
      origin: origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-eval'"], // Monaco requires unsafe-eval
          styleSrc: ["'self'", "'unsafe-inline'"],
          workerSrc: ["'self'", 'blob:'],
        },
      },
    });
  },
  { name: 'cors', dependencies: ['config'] },
);
