import {
  AppError,
  GitBranch,
  GitCheckoutInput,
  GitCheckoutResponse,
  GitInfoResponse,
  GitPullResponse,
  UuidV7,
} from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { simpleGit } from 'simple-git';
import { z } from 'zod';

const IdParams = z.object({ id: UuidV7 });
const BranchListResponse = z.object({ branches: z.array(GitBranch) });
const OkResponse = z.object({ ok: z.literal(true) });

export const gitRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/v1/projects/:id/git',
      {
        schema: { params: IdParams, response: { 200: GitInfoResponse } },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const row = await fastify.db.projects.findById(req.params.id);
        if (!row) throw AppError.notFound(`project ${req.params.id} not found`);

        const git = simpleGit(row.rootPath);

        let isRepo: boolean;
        try {
          isRepo = await git.checkIsRepo();
        } catch {
          isRepo = false;
        }

        if (!isRepo) {
          return {
            isRepo: false,
            branch: null,
            remotes: [],
            user: { name: null, email: null },
            status: [],
            lastCommit: null,
            branches: [],
            ahead: 0,
            behind: 0,
          };
        }

        try {
          const [statusResult, remotesResult, logResult, branchResult] = await Promise.all([
            git.status(),
            git.getRemotes(true),
            git.log({ maxCount: 1 }),
            git.branch(['-a']),
          ]);

          let userName: string | null = null;
          let userEmail: string | null = null;
          try {
            userName = (await git.raw(['config', 'user.name'])).trim() || null;
          } catch {
            // no user.name configured
          }
          try {
            userEmail = (await git.raw(['config', 'user.email'])).trim() || null;
          } catch {
            // no user.email configured
          }

          const remotes = remotesResult.map((r) => ({
            name: r.name,
            url: (r.refs as { fetch?: string; push?: string }).fetch ?? (r.refs as { fetch?: string; push?: string }).push ?? '',
          }));

          const fileStatuses = statusResult.files.map((f) => ({
            path: f.path,
            index: f.index,
            working: f.working_dir,
          }));

          const lastCommit = logResult.latest
            ? {
                hash: logResult.latest.hash,
                message: logResult.latest.message,
                author: logResult.latest.author_name,
                date: logResult.latest.date,
              }
            : null;

          const branches: GitBranch[] = Object.values(branchResult.branches).map((b) => ({
            name: b.name,
            current: b.current,
            remote: b.name.startsWith('remotes/'),
            commit: b.commit,
            label: b.label,
          }));

          return {
            isRepo: true,
            branch: statusResult.current,
            remotes,
            user: { name: userName, email: userEmail },
            status: fileStatuses,
            lastCommit,
            branches,
            ahead: statusResult.ahead,
            behind: statusResult.behind,
          };
        } catch (err) {
          req.log.warn({ err, projectId: req.params.id }, 'git info failed');
          return {
            isRepo: false,
            branch: null,
            remotes: [],
            user: { name: null, email: null },
            status: [],
            lastCommit: null,
            branches: [],
            ahead: 0,
            behind: 0,
          };
        }
      },
    );

    app.get(
      '/v1/projects/:id/git/branches',
      {
        schema: { params: IdParams, response: { 200: BranchListResponse } },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const row = await fastify.db.projects.findById(req.params.id);
        if (!row) throw AppError.notFound(`project ${req.params.id} not found`);

        const git = simpleGit(row.rootPath);
        try {
          const branchResult = await git.branch(['-a']);
          const branches: GitBranch[] = Object.values(branchResult.branches).map((b) => ({
            name: b.name,
            current: b.current,
            remote: b.name.startsWith('remotes/'),
            commit: b.commit,
            label: b.label,
          }));
          return { branches };
        } catch (err) {
          req.log.warn({ err, projectId: req.params.id }, 'git branch list failed');
          return { branches: [] };
        }
      },
    );

    app.post(
      '/v1/projects/:id/git/pull',
      {
        schema: { params: IdParams, response: { 200: GitPullResponse } },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const row = await fastify.db.projects.findById(req.params.id);
        if (!row) throw AppError.notFound(`project ${req.params.id} not found`);

        const git = simpleGit(row.rootPath);
        try {
          const result = await git.pull();
          const changes = result.summary.changes;
          const summary =
            changes > 0
              ? `${changes} change(s), ${result.summary.insertions} insertion(s), ${result.summary.deletions} deletion(s)`
              : 'Already up to date';
          return { summary, filesChanged: changes };
        } catch (err) {
          req.log.error({ err, projectId: req.params.id }, 'git pull failed');
          throw AppError.internal('git pull failed');
        }
      },
    );

    app.post(
      '/v1/projects/:id/git/fetch',
      {
        schema: { params: IdParams, response: { 200: OkResponse } },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const row = await fastify.db.projects.findById(req.params.id);
        if (!row) throw AppError.notFound(`project ${req.params.id} not found`);

        const git = simpleGit(row.rootPath);
        try {
          await git.fetch();
          return { ok: true as const };
        } catch (err) {
          req.log.error({ err, projectId: req.params.id }, 'git fetch failed');
          throw AppError.internal('git fetch failed');
        }
      },
    );

    app.post(
      '/v1/projects/:id/git/checkout',
      {
        schema: {
          params: IdParams,
          body: GitCheckoutInput,
          response: { 200: GitCheckoutResponse },
        },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const row = await fastify.db.projects.findById(req.params.id);
        if (!row) throw AppError.notFound(`project ${req.params.id} not found`);

        const git = simpleGit(row.rootPath);
        try {
          await git.checkout(req.body.branch);
          return { branch: req.body.branch };
        } catch (err) {
          req.log.error({ err, projectId: req.params.id, branch: req.body.branch }, 'git checkout failed');
          throw AppError.internal('git checkout failed');
        }
      },
    );
  },
  { name: 'routes:git', dependencies: ['db', 'config'] },
);
