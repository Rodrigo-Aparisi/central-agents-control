import { AppError, RunEvent, UuidV7 } from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eventToApi } from '../lib/mappers';

const Params = z.object({ id: UuidV7 });
const Query = z.object({
  fromSeq: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});
const ListResponse = z.object({
  items: z.array(RunEvent),
  nextFromSeq: z.number().int().nullable(),
});

export const eventRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/v1/runs/:id/events',
      {
        schema: { params: Params, querystring: Query, response: { 200: ListResponse } },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const run = await fastify.db.runs.findById(req.params.id);
        if (!run) throw AppError.notFound(`run ${req.params.id} not found`);

        const { fromSeq, limit } = req.query;
        const rows = await fastify.db.events.list({
          runId: req.params.id,
          fromSeq: fromSeq ?? 0,
          limit,
        });
        const items = rows.map(eventToApi);
        const lastSeq = rows[rows.length - 1]?.seq;
        const nextFromSeq =
          typeof limit === 'number' && rows.length === limit && typeof lastSeq === 'number'
            ? lastSeq + 1
            : null;
        return { items, nextFromSeq };
      },
    );
  },
  { name: 'routes:events', dependencies: ['db'] },
);
