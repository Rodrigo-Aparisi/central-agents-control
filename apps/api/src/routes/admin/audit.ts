import { AuditEventRow, UuidV7 } from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const AuditListQuery = z.object({
  userId: UuidV7.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  cursor: z.string().optional(),
});

const AuditListResponse = z.object({
  items: z.array(AuditEventRow),
  nextCursor: z.string().nullable(),
});

export const adminAuditRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    // GET /v1/admin/audit
    app.get(
      '/v1/admin/audit',
      {
        schema: { querystring: AuditListQuery, response: { 200: AuditListResponse } },
        preHandler: [fastify.requireRole('admin')],
      },
      async (req) => {
        const { userId, limit, cursor } = req.query;
        const { items, nextCursor } = await fastify.db.auditEvents.list({
          userId,
          limit,
          cursor,
        });
        return { items, nextCursor };
      },
    );
  },
  { name: 'routes:admin:audit', dependencies: ['db', 'auth'] },
);
