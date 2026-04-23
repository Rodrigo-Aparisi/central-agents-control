import { AppError, Artifact, UuidV7 } from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { artifactToApi } from '../lib/mappers';

const Params = z.object({ id: UuidV7 });
const ListResponse = z.object({ items: z.array(Artifact) });

export const artifactRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/v1/runs/:id/artifacts',
      { schema: { params: Params, response: { 200: ListResponse } } },
      async (req) => {
        const run = await fastify.db.runs.findById(req.params.id);
        if (!run) throw AppError.notFound(`run ${req.params.id} not found`);
        const rows = await fastify.db.artifacts.listByRun(req.params.id);
        return { items: rows.map(artifactToApi) };
      },
    );
  },
  { name: 'routes:artifacts', dependencies: ['db'] },
);
