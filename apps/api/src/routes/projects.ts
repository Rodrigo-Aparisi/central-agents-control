import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  AppError,
  CreateProjectInput,
  CursorPagination,
  Project,
  UpdateProjectInput,
  UuidV7,
} from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { projectToApi } from '../lib/mappers';
import { ensureWithinProjectsRoot } from '../lib/project-path';
import { ensureProjectClaudeSettings } from '../lib/project-setup';

const execFileAsync = promisify(execFile);

const ProjectList = z.object({
  items: z.array(Project),
  nextCursor: z.string().nullable(),
});

const IdParams = z.object({ id: UuidV7 });

export const projectRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/v1/projects',
      {
        schema: { querystring: CursorPagination, response: { 200: ProjectList } },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const { cursor, limit } = req.query;
        const rows = await fastify.db.projects.list({ cursor, limit });
        const items = rows.map(projectToApi);
        const nextCursor = rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null;
        return { items, nextCursor };
      },
    );

    app.post(
      '/v1/projects',
      {
        schema: { body: CreateProjectInput, response: { 201: Project } },
        preHandler: [fastify.requireRole('admin')],
      },
      async (req, reply) => {
        const { name, rootPath, description } = req.body;
        const realRoot = ensureWithinProjectsRoot(rootPath, fastify.config.resolvedProjectsRoot);
        const row = await fastify.db.projects.insert({
          name,
          rootPath: realRoot,
          description: description ?? null,
        });
        await ensureProjectClaudeSettings(realRoot).catch((err) =>
          fastify.log.warn({ err, rootPath: realRoot }, 'could not create .claude/settings.json'),
        );
        return reply.code(201).send(projectToApi(row));
      },
    );

    app.get(
      '/v1/projects/:id',
      {
        schema: { params: IdParams, response: { 200: Project } },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const row = await fastify.db.projects.findById(req.params.id);
        if (!row) throw AppError.notFound(`project ${req.params.id} not found`);
        return projectToApi(row);
      },
    );

    app.put(
      '/v1/projects/:id',
      {
        schema: { params: IdParams, body: UpdateProjectInput, response: { 200: Project } },
        preHandler: [fastify.requireRole('admin')],
      },
      async (req) => {
        const patch: Record<string, unknown> = { ...req.body };
        if (typeof req.body.rootPath === 'string') {
          patch.rootPath = ensureWithinProjectsRoot(
            req.body.rootPath,
            fastify.config.resolvedProjectsRoot,
          );
        }
        const row = await fastify.db.projects.update(req.params.id, patch);
        if (!row) throw AppError.notFound(`project ${req.params.id} not found`);
        return projectToApi(row);
      },
    );

    app.delete(
      '/v1/projects/:id',
      {
        schema: { params: IdParams, response: { 204: z.null() } },
        preHandler: [fastify.requireRole('admin')],
      },
      async (req, reply) => {
        const deleted = await fastify.db.projects.delete(req.params.id);
        if (!deleted) throw AppError.notFound(`project ${req.params.id} not found`);
        return reply.code(204).send(null);
      },
    );

    app.post(
      '/v1/projects/:id/open-folder',
      {
        schema: { params: IdParams, response: { 204: z.null() } },
        preHandler: [fastify.requireAuth],
      },
      async (req, reply) => {
        const row = await fastify.db.projects.findById(req.params.id);
        if (!row) throw AppError.notFound(`project ${req.params.id} not found`);
        ensureWithinProjectsRoot(row.rootPath, fastify.config.resolvedProjectsRoot);
        await openInExplorer(row.rootPath).catch((err) =>
          fastify.log.warn({ err, rootPath: row.rootPath }, 'open-folder failed'),
        );
        return reply.code(204).send(null);
      },
    );
  },
  { name: 'routes:projects', dependencies: ['db', 'config'] },
);

async function openInExplorer(folderPath: string): Promise<void> {
  if (process.platform === 'win32') {
    await execFileAsync('explorer.exe', [folderPath]).catch(() => {
      // explorer.exe returns exit code 1 even on success — ignore
    });
  } else if (process.platform === 'darwin') {
    await execFileAsync('open', [folderPath]);
  } else {
    await execFileAsync('xdg-open', [folderPath]);
  }
}
