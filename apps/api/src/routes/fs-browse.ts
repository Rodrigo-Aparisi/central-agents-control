import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError, FsBrowseResponse, FsMkdirInput, FsMkdirResponse } from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const BrowseQuery = z.object({
  path: z.string().optional(),
});

export const fsBrowseRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();
    const root = fastify.config.resolvedProjectsRoot;

    app.get(
      '/v1/fs/browse',
      {
        schema: {
          querystring: BrowseQuery,
          response: { 200: FsBrowseResponse },
        },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const rawPath = req.query.path ?? root;

        if (rawPath.includes('\x00')) throw AppError.validation('path contains null byte');

        const resolved = path.resolve(rawPath);

        let real: string;
        try {
          real = await fs.realpath(resolved);
        } catch {
          throw AppError.notFound(`path not found: ${rawPath}`);
        }

        ensureWithinRoot(real, root);

        const stat = await fs.stat(real).catch(() => null);
        if (!stat?.isDirectory()) throw AppError.validation('path is not a directory');

        const names = await listSubdirs(real);
        const parent = real === root ? null : path.dirname(real);

        return {
          path: real,
          parent,
          entries: names.map((name) => ({
            name,
            path: path.join(real, name),
            type: 'directory' as const,
          })),
        };
      },
    );

    app.post(
      '/v1/fs/mkdir',
      {
        schema: {
          body: FsMkdirInput,
          response: { 201: FsMkdirResponse },
        },
        preHandler: [fastify.requireAuth],
      },
      async (req, reply) => {
        const { parentPath, name } = req.body;

        if (parentPath.includes('\x00')) throw AppError.validation('path contains null byte');

        const resolved = path.resolve(parentPath);
        let realParent: string;
        try {
          realParent = await fs.realpath(resolved);
        } catch {
          throw AppError.notFound(`parent path not found: ${parentPath}`);
        }

        ensureWithinRoot(realParent, root);

        const stat = await fs.stat(realParent).catch(() => null);
        if (!stat?.isDirectory()) throw AppError.validation('parent path is not a directory');

        const newDir = path.join(realParent, name);
        if (!newDir.startsWith(realParent + path.sep) && newDir !== realParent) {
          throw AppError.validation('invalid folder name');
        }

        try {
          await fs.mkdir(newDir, { recursive: false });
        } catch (err: unknown) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code === 'EEXIST') throw AppError.conflict(`"${name}" ya existe`);
          fastify.log.error({ err, newDir }, 'mkdir failed');
          throw AppError.internal('No se pudo crear la carpeta');
        }

        return reply.code(201).send({ path: newDir });
      },
    );
  },
  { name: 'routes:fs-browse', dependencies: ['config'] },
);

function ensureWithinRoot(absPath: string, root: string): void {
  const normalRoot = root.endsWith(path.sep) ? root : root + path.sep;
  if (absPath !== root && !absPath.startsWith(normalRoot)) {
    throw AppError.validation(`path must be within PROJECTS_ROOT`);
  }
}

async function listSubdirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}
