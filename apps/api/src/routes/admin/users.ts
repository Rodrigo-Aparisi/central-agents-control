import { newId } from '@cac/db';
import { CreateUserInput, UpdateUserInput, UserRow, UuidV7 } from '@cac/shared';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { logAudit } from '../../lib/audit';

const UserListResponse = z.object({ items: z.array(UserRow) });
const IdParams = z.object({ id: UuidV7 });

export const adminUserRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    // GET /v1/admin/users
    app.get(
      '/v1/admin/users',
      {
        schema: { response: { 200: UserListResponse } },
        preHandler: [fastify.requireRole('admin')],
      },
      async () => {
        const rows = await fastify.db.users.list();
        // Strip passwordHash — UserRow schema does not include it, so serialization is safe.
        const items = rows.map((r) => ({
          id: r.id,
          email: r.email,
          role: r.role,
          createdAt: r.createdAt,
          lastLoginAt: r.lastLoginAt,
        }));
        return { items };
      },
    );

    // POST /v1/admin/users
    app.post(
      '/v1/admin/users',
      {
        schema: { body: CreateUserInput, response: { 201: UserRow } },
        preHandler: [fastify.requireRole('admin')],
      },
      async (req, reply) => {
        const { email, password, role } = req.body;

        const existing = await fastify.db.users.findByEmail(email);
        if (existing) {
          throw fastify.httpErrors.conflict(`email already in use: ${email}`);
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const row = await fastify.db.users.insert({
          id: newId(),
          email,
          passwordHash,
          role,
        });

        await logAudit(
          fastify.db,
          req,
          'create_user',
          'user',
          row.id,
          `email=${email} role=${role}`,
        );
        req.log.info({ userId: row.id, email, role }, 'user created by admin');

        return reply.code(201).send({
          id: row.id,
          email: row.email,
          role: row.role,
          createdAt: row.createdAt,
          lastLoginAt: row.lastLoginAt,
        });
      },
    );

    // PUT /v1/admin/users/:id
    app.put(
      '/v1/admin/users/:id',
      {
        schema: { params: IdParams, body: UpdateUserInput, response: { 200: UserRow } },
        preHandler: [fastify.requireRole('admin')],
      },
      async (req) => {
        const { role } = req.body;
        const updated = await fastify.db.users.update(req.params.id, { role });
        if (!updated) throw fastify.httpErrors.notFound('User not found');

        await logAudit(fastify.db, req, 'update_user', 'user', req.params.id, `role=${role}`);
        req.log.info({ targetUserId: req.params.id, role }, 'user role updated by admin');

        return {
          id: updated.id,
          email: updated.email,
          role: updated.role,
          createdAt: updated.createdAt,
          lastLoginAt: updated.lastLoginAt,
        };
      },
    );

    // DELETE /v1/admin/users/:id
    app.delete(
      '/v1/admin/users/:id',
      {
        schema: { params: IdParams, response: { 204: z.null() } },
        preHandler: [fastify.requireRole('admin')],
      },
      async (req, reply) => {
        const user = await fastify.db.users.findById(req.params.id);
        if (!user) throw fastify.httpErrors.notFound('User not found');

        // Revoke all refresh tokens for this user first.
        await fastify.db.refreshTokens.deleteByUserId(req.params.id);
        await fastify.db.users.delete(req.params.id);

        await logAudit(
          fastify.db,
          req,
          'delete_user',
          'user',
          req.params.id,
          `email=${user.email}`,
        );
        req.log.info({ targetUserId: req.params.id }, 'user deleted by admin');

        return reply.code(204).send(null);
      },
    );
  },
  { name: 'routes:admin:users', dependencies: ['db', 'auth'] },
);
