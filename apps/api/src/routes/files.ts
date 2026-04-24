import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { AppError, FileContentResponse, ListFilesResponse, UuidV7 } from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { resolveWithinRoot } from '../lib/safe-path';

const Params = z.object({ id: UuidV7 });
const ListQuery = z.object({
  path: z.string().max(4096).optional(),
});
const ContentQuery = z.object({
  path: z.string().min(1).max(4096),
});

const MAX_FILE_BYTES = 500 * 1024;

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.vite',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '.cache',
]);

export const fileRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/v1/projects/:id/files',
      {
        schema: {
          params: Params,
          querystring: ListQuery,
          response: { 200: ListFilesResponse },
        },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        const relative = normaliseRelative(req.query.path);
        const absolute = resolveWithinRoot(project.rootPath, relative);

        const info = await stat(absolute);
        if (!info.isDirectory()) {
          throw AppError.validation('path is not a directory');
        }

        const dirents = await readdir(absolute, { withFileTypes: true });
        const entries = dirents
          .filter((d) => {
            if (d.isDirectory()) return !IGNORED_DIRS.has(d.name);
            return !d.name.startsWith('.env');
          })
          .map((d) => ({
            name: d.name,
            path: path.posix.join(relative, d.name),
            type: d.isDirectory() ? ('directory' as const) : ('file' as const),
          }))
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });

        return { path: relative, entries };
      },
    );

    app.get(
      '/v1/projects/:id/files/content',
      {
        schema: {
          params: Params,
          querystring: ContentQuery,
          response: { 200: FileContentResponse },
        },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        const relative = normaliseRelative(req.query.path);
        const absolute = resolveWithinRoot(project.rootPath, relative);

        const info = await stat(absolute);
        if (info.isDirectory()) throw AppError.validation('path is a directory');
        if (info.size > MAX_FILE_BYTES) {
          const head = await readFile(absolute, { encoding: 'utf8', flag: 'r' });
          return {
            path: relative,
            size: info.size,
            content: head.slice(0, MAX_FILE_BYTES),
            truncated: true,
          };
        }
        const content = await readFile(absolute, 'utf8');
        return {
          path: relative,
          size: info.size,
          content,
          truncated: false,
        };
      },
    );
  },
  { name: 'routes:files', dependencies: ['db'] },
);

function normaliseRelative(raw: string | undefined): string {
  if (!raw || raw === '/' || raw === '.') return '';
  const trimmed = raw.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
  return trimmed
    .split(/[\\/]/)
    .filter((part) => part !== '..')
    .join('/');
}
