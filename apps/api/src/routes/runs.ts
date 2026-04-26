import {
  ALLOWED_CLAUDE_FLAGS,
  AppError,
  CursorPagination,
  LaunchRunInput,
  LaunchRunResponse,
  Run,
  RunWithProject,
  type RunParams,
  RunStatus,
  UuidV7,
} from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { runToApi, runWithProjectToApi } from '../lib/mappers';

const RunList = z.object({
  items: z.array(Run),
  nextCursor: z.string().nullable(),
});

const RunWithProjectList = z.object({
  items: z.array(RunWithProject),
  nextCursor: z.string().nullable(),
});

const ListQuery = CursorPagination.extend({
  projectId: UuidV7.optional(),
  status: RunStatus.optional(),
});

const ProjectIdParams = z.object({ id: UuidV7 });
const RunIdParams = z.object({ id: UuidV7 });

export const runRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/v1/runs',
      {
        schema: { querystring: ListQuery, response: { 200: RunWithProjectList } },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const { cursor, limit, projectId, status } = req.query;
        if (projectId) {
          // Project-scoped — projectName is implicit; use plain list for efficiency
          const rows = await fastify.db.runs.list({ cursor, limit, projectId, status });
          const items = rows.map((r) => runWithProjectToApi(r, ''));
          const nextCursor = rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null;
          return { items, nextCursor };
        }
        const rows = await fastify.db.runs.listWithProjectName({ cursor, limit, status });
        const items = rows.map((r) => runWithProjectToApi(r, r.projectName));
        const nextCursor = rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null;
        return { items, nextCursor };
      },
    );

    app.get(
      '/v1/projects/:id/runs',
      {
        schema: {
          params: ProjectIdParams,
          querystring: CursorPagination,
          response: { 200: RunList },
        },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const { cursor, limit } = req.query;
        const rows = await fastify.db.runs.list({
          cursor,
          limit,
          projectId: req.params.id,
        });
        const items = rows.map(runToApi);
        const nextCursor = rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null;
        return { items, nextCursor };
      },
    );

    app.get(
      '/v1/runs/:id',
      {
        schema: { params: RunIdParams, response: { 200: Run } },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const row = await fastify.db.runs.findById(req.params.id);
        if (!row) throw AppError.notFound(`run ${req.params.id} not found`);
        return runToApi(row);
      },
    );

    app.post(
      '/v1/projects/:id/launch',
      {
        schema: {
          params: ProjectIdParams,
          body: LaunchRunInput,
          response: { 202: LaunchRunResponse },
        },
        preHandler: [fastify.requireRole('admin')],
      },
      async (req, reply) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        const params = mergeParams(fastify.config.RUN_TIMEOUT_MS, req.body.params);

        const run = await fastify.db.runs.insert({
          projectId: project.id,
          status: 'queued',
          prompt: req.body.prompt,
          params,
          usage: null,
          exitCode: null,
          durationMs: null,
          error: null,
          startedAt: null,
          finishedAt: null,
        });

        await fastify.queues.runs.add(
          'run',
          { runId: run.id, projectId: project.id },
          { jobId: run.id },
        );

        req.log.info({ runId: run.id, projectId: project.id }, 'run queued');
        return reply.code(202).send({ runId: run.id });
      },
    );

    app.post(
      '/v1/runs/:id/cancel',
      {
        schema: { params: RunIdParams, response: { 202: Run } },
        preHandler: [fastify.requireRole('admin')],
      },
      async (req, reply) => {
        const run = await fastify.db.runs.findById(req.params.id);
        if (!run) throw AppError.notFound(`run ${req.params.id} not found`);

        if (run.status !== 'queued' && run.status !== 'running') {
          throw AppError.conflict(`run is ${run.status}, cannot cancel`);
        }

        await fastify.redis.publish(
          'cac:run:cancel',
          JSON.stringify({ runId: run.id, reason: 'user' }),
        );

        const job = await fastify.queues.runs.getJob(run.id);
        if (job && (await job.isWaiting())) {
          await job.remove();
          const updated = await fastify.db.runs.update(run.id, {
            status: 'cancelled',
            finishedAt: new Date().toISOString(),
          });
          return reply.code(202).send(runToApi(updated ?? run));
        }

        return reply.code(202).send(runToApi(run));
      },
    );

    app.post(
      '/v1/runs/:id/rerun',
      {
        schema: {
          params: RunIdParams,
          body: z.object({ prompt: z.string().min(1).max(50_000).optional() }).optional(),
          response: { 202: LaunchRunResponse },
        },
        preHandler: [fastify.requireRole('admin')],
      },
      async (req, reply) => {
        const source = await fastify.db.runs.findById(req.params.id);
        if (!source) throw AppError.notFound(`run ${req.params.id} not found`);

        const prompt = req.body?.prompt ?? source.prompt;
        const params = (source.params ?? {
          flags: [],
          model: 'claude-sonnet-4-6',
          timeoutMs: fastify.config.RUN_TIMEOUT_MS,
        }) as RunParams;

        const run = await fastify.db.runs.insert({
          projectId: source.projectId,
          parentRunId: null,
          status: 'queued',
          prompt,
          params,
          usage: null,
          exitCode: null,
          durationMs: null,
          error: null,
          startedAt: null,
          finishedAt: null,
        });

        await fastify.queues.runs.add(
          'run',
          { runId: run.id, projectId: source.projectId },
          { jobId: run.id },
        );

        req.log.info(
          { runId: run.id, parentRunId: source.id, projectId: source.projectId },
          'run re-launched',
        );
        return reply.code(202).send({ runId: run.id });
      },
    );
  },
  { name: 'routes:runs', dependencies: ['db', 'queues', 'config', 'redis'] },
);

function mergeParams(defaultTimeoutMs: number, override?: Partial<RunParams>): RunParams {
  const base: RunParams = {
    flags: [],
    model: 'claude-sonnet-4-6',
    timeoutMs: defaultTimeoutMs,
  };
  if (!override) return base;
  const flags = override.flags ?? base.flags;
  for (const f of flags) {
    if (f.startsWith('-') && !ALLOWED_CLAUDE_FLAGS.has(f)) {
      throw AppError.validation(`flag not in whitelist: ${f}`);
    }
  }
  return {
    flags,
    model: override.model ?? base.model,
    timeoutMs: override.timeoutMs ?? base.timeoutMs,
  };
}
