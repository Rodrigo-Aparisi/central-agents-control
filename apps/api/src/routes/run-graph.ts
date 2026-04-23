import { AppError, RunGraphResponse, UuidV7 } from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const Params = z.object({ id: UuidV7 });

export const runGraphRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/v1/projects/:id/run-graph',
      { schema: { params: Params, response: { 200: RunGraphResponse } } },
      async (req) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        const rows = await fastify.db.runs.graphByProject(project.id);
        const nodes = rows.map((r) => ({
          id: r.id,
          parentRunId: r.parentRunId,
          status: r.status,
          createdAt: r.createdAt,
          prompt: r.prompt.slice(0, 200),
        }));
        const known = new Set(nodes.map((n) => n.id));
        const edges = nodes
          .filter((n) => n.parentRunId && known.has(n.parentRunId))
          .map((n) => ({ from: n.parentRunId as string, to: n.id }));
        return { nodes, edges };
      },
    );
  },
  { name: 'routes:run-graph', dependencies: ['db'] },
);
