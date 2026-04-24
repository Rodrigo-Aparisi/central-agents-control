import fjwt from '@fastify/jwt';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: preHandlerAsyncHookHandler;
    requireRole: (role: 'admin' | 'viewer') => preHandlerAsyncHookHandler;
  }
  interface FastifyRequest {
    jwtUser?: { sub: string; role: 'admin' | 'viewer' };
  }
}

export const authPlugin = fp(
  async (fastify: FastifyInstance) => {
    const { config } = fastify;

    await fastify.register(fjwt, { secret: config.JWT_SECRET });

    async function verifyAuth(req: Parameters<preHandlerAsyncHookHandler>[0]): Promise<void> {
      if (!config.AUTH_ENABLED) return;
      try {
        await req.jwtVerify();
        req.jwtUser = req.user as { sub: string; role: 'admin' | 'viewer' };
      } catch {
        throw fastify.httpErrors.unauthorized('Invalid or missing token');
      }
    }

    const requireAuth: preHandlerAsyncHookHandler = async (req, _reply) => {
      await verifyAuth(req);
    };

    const requireRole =
      (role: 'admin' | 'viewer'): preHandlerAsyncHookHandler =>
      async (req, _reply) => {
        await verifyAuth(req);
        if (role === 'admin' && req.jwtUser?.role !== 'admin') {
          throw fastify.httpErrors.forbidden('Admin role required');
        }
      };

    fastify.decorate('requireAuth', requireAuth);
    fastify.decorate('requireRole', requireRole);
  },
  { name: 'auth', dependencies: ['config'] },
);
