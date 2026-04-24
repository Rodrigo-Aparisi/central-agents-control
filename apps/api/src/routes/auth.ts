import { createHash, randomBytes } from 'node:crypto';
import { newId } from '@cac/db';
import { AuthTokensResponse, LoginInput } from '@cac/shared';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { logAudit } from '../lib/audit';

/** SHA-256 hex of a raw token string — used for fast DB lookup without bcrypt. */
function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export const authRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    // POST /v1/auth/login
    app.post(
      '/v1/auth/login',
      {
        schema: { body: LoginInput, response: { 200: AuthTokensResponse } },
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      },
      async (req, reply) => {
        const { email, password } = req.body;
        const db = fastify.db;

        const user = await db.users.findByEmail(email);
        // Constant-time path: always run bcrypt.compare even on "user not found"
        // to prevent timing-based user enumeration.
        const dummyHash = '$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        // When user is not found, still run bcrypt to avoid timing attacks.
        let valid = false;
        if (user) {
          valid = await bcrypt.compare(password, user.passwordHash);
        } else {
          await bcrypt.compare(password, dummyHash);
        }

        if (!user || !valid) {
          throw fastify.httpErrors.unauthorized('Invalid credentials');
        }

        await db.users.update(user.id, { lastLoginAt: new Date().toISOString() });

        const expiresIn = fastify.config.JWT_EXPIRES_IN;
        const accessToken = fastify.jwt.sign({ sub: user.id, role: user.role }, { expiresIn });

        // Opaque refresh token — store SHA-256 for fast lookup.
        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = sha256(rawToken);
        const expiresAt = new Date(
          Date.now() + fastify.config.REFRESH_TOKEN_EXPIRES_DAYS * 86_400_000,
        ).toISOString();
        await db.refreshTokens.insert({
          id: newId(),
          userId: user.id,
          tokenHash,
          expiresAt,
        });

        reply.setCookie('cac_refresh', rawToken, {
          httpOnly: true,
          secure: fastify.config.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/v1/auth',
          maxAge: fastify.config.REFRESH_TOKEN_EXPIRES_DAYS * 86_400,
        });

        await logAudit(db, req, 'login', 'user', user.id);
        req.log.info({ userId: user.id }, 'user logged in');

        return reply.send({ accessToken, userId: user.id, role: user.role, expiresIn });
      },
    );

    // POST /v1/auth/refresh
    app.post(
      '/v1/auth/refresh',
      { schema: { response: { 200: AuthTokensResponse } } },
      async (req, reply) => {
        // In dev mode (AUTH_ENABLED=false) always return a synthetic admin token so the
        // frontend guard passes without requiring a real user in the DB.
        if (!fastify.config.AUTH_ENABLED) {
          const expiresIn = 86_400; // 24h synthetic
          const accessToken = fastify.jwt.sign({ sub: 'dev', role: 'admin' }, { expiresIn });
          return reply.send({ accessToken, userId: 'dev', role: 'admin', expiresIn });
        }

        const rawToken = req.cookies.cac_refresh;
        if (!rawToken) throw fastify.httpErrors.unauthorized('Missing refresh token');

        const hash = sha256(rawToken);
        const stored = await fastify.db.refreshTokens.findByHash(hash);
        if (!stored) throw fastify.httpErrors.unauthorized('Invalid refresh token');

        // Check expiry
        if (new Date(stored.expiresAt) < new Date()) {
          await fastify.db.refreshTokens.deleteByHash(hash);
          throw fastify.httpErrors.unauthorized('Refresh token expired');
        }

        const user = await fastify.db.users.findById(stored.userId);
        if (!user) {
          await fastify.db.refreshTokens.deleteByHash(hash);
          throw fastify.httpErrors.unauthorized('User not found');
        }

        const expiresIn = fastify.config.JWT_EXPIRES_IN;
        const accessToken = fastify.jwt.sign({ sub: user.id, role: user.role }, { expiresIn });

        req.log.info({ userId: user.id }, 'access token refreshed');
        return reply.send({ accessToken, userId: user.id, role: user.role, expiresIn });
      },
    );

    // POST /v1/auth/logout
    app.post('/v1/auth/logout', { schema: { response: { 204: z.null() } } }, async (req, reply) => {
      const rawToken = req.cookies.cac_refresh;
      if (rawToken) {
        const hash = sha256(rawToken);
        await fastify.db.refreshTokens.deleteByHash(hash).catch((err) => {
          req.log.warn({ err }, 'failed to delete refresh token on logout');
        });
      }

      reply.clearCookie('cac_refresh', { path: '/v1/auth' });
      req.log.info({ userId: req.jwtUser?.sub }, 'user logged out');
      return reply.code(204).send(null);
    });
  },
  { name: 'routes:auth', dependencies: ['db', 'config', 'auth'] },
);
