import { AppError, GlobalStatsResponse, ProjectStatsResponse, UuidV7 } from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { dailyStatsToApi } from '../lib/mappers';

const Params = z.object({ id: UuidV7 });
const Query = z.object({
  days: z.coerce.number().int().positive().max(365).default(30),
});

export const statsRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/v1/stats/global',
      { schema: { querystring: Query, response: { 200: GlobalStatsResponse } } },
      async (req) => {
        const since = daysAgo(req.query.days);
        const [days, totals, topRaw] = await Promise.all([
          fastify.db.runs.dailyStats(since),
          fastify.db.runs.totals(),
          fastify.db.runs.topProjects(5),
        ]);
        const projects = await Promise.all(
          topRaw.map((t) => fastify.db.projects.findById(t.projectId)),
        );
        const topProjects = topRaw.map((t, i) => ({
          projectId: t.projectId,
          name: projects[i]?.name ?? '(unknown)',
          runs: t.runs,
          inputTokens: t.inputTokens,
          outputTokens: t.outputTokens,
        }));
        return {
          days: days.map(dailyStatsToApi),
          totals,
          topProjects,
        };
      },
    );

    app.get(
      '/v1/stats/projects/:id',
      {
        schema: {
          params: Params,
          querystring: Query,
          response: { 200: ProjectStatsResponse },
        },
      },
      async (req) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);
        const since = daysAgo(req.query.days);
        const [days, totals] = await Promise.all([
          fastify.db.runs.dailyStats(since, project.id),
          fastify.db.runs.totals(project.id),
        ]);
        return {
          projectId: project.id,
          days: days.map(dailyStatsToApi),
          totals,
        };
      },
    );
  },
  { name: 'routes:stats', dependencies: ['db'] },
);

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
