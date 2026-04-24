import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AppError,
  ClaudeConfigResponse,
  UpsertAgentInput,
  UuidV7,
  WriteFileInput,
} from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const Params = z.object({ id: UuidV7 });
const AgentParams = z.object({
  id: UuidV7,
  filename: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'invalid agent filename'),
});

export const claudeConfigRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/v1/projects/:id/claude-config',
      {
        schema: {
          params: Params,
          response: { 200: ClaudeConfigResponse },
        },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        const rootPath = project.rootPath;

        // CLAUDE.md
        let claudeMd = { exists: false, content: '' };
        try {
          const content = await fs.readFile(path.join(rootPath, 'CLAUDE.md'), 'utf8');
          claudeMd = { exists: true, content };
        } catch {
          /* doesn't exist */
        }

        // Agents (.claude/agents/*.md)
        const agentsDir = path.join(rootPath, '.claude', 'agents');
        const agents: Array<{
          filename: string;
          name: string;
          description: string | null;
          body: string;
        }> = [];
        try {
          const files = await fs.readdir(agentsDir);
          for (const file of files.filter((f) => f.endsWith('.md')).sort()) {
            try {
              const raw = await fs.readFile(path.join(agentsDir, file), 'utf8');
              const parsed = parseFrontmatter(raw);
              agents.push({
                filename: file.slice(0, -3),
                name: parsed.name ?? file.slice(0, -3),
                description: parsed.description ?? null,
                body: parsed.body,
              });
            } catch {
              /* skip unreadable */
            }
          }
        } catch {
          /* dir doesn't exist */
        }

        // .claude/settings.json
        let settingsJson: { exists: boolean; content: Record<string, unknown> | null } = {
          exists: false,
          content: null,
        };
        try {
          const raw = await fs.readFile(path.join(rootPath, '.claude', 'settings.json'), 'utf8');
          settingsJson = { exists: true, content: JSON.parse(raw) as Record<string, unknown> };
        } catch {
          /* doesn't exist or invalid JSON */
        }

        return { claudeMd, agents, settingsJson };
      },
    );

    app.put(
      '/v1/projects/:id/claude-config/claudemd',
      {
        schema: {
          params: Params,
          body: WriteFileInput,
          response: { 200: z.object({ ok: z.literal(true) }) },
        },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        try {
          await fs.writeFile(path.join(project.rootPath, 'CLAUDE.md'), req.body.content, 'utf8');
        } catch (err) {
          fastify.log.error({ err }, 'writeFile CLAUDE.md failed');
          throw AppError.internal('No se pudo guardar CLAUDE.md');
        }
        return { ok: true as const };
      },
    );

    app.put(
      '/v1/projects/:id/claude-config/agents/:filename',
      {
        schema: {
          params: AgentParams,
          body: UpsertAgentInput,
          response: { 200: z.object({ ok: z.literal(true) }) },
        },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        const agentsDir = path.join(project.rootPath, '.claude', 'agents');
        await fs.mkdir(agentsDir, { recursive: true });

        const { name, description, body } = req.body;
        const descLine = description ? `description: ${description}\n` : '';
        const fileContent = `---\nname: ${name}\n${descLine}---\n\n${body}`;

        try {
          await fs.writeFile(
            path.join(agentsDir, `${req.params.filename}.md`),
            fileContent,
            'utf8',
          );
        } catch (err) {
          fastify.log.error({ err }, 'writeFile agent failed');
          throw AppError.internal('No se pudo guardar el agente');
        }
        return { ok: true as const };
      },
    );

    app.delete(
      '/v1/projects/:id/claude-config/agents/:filename',
      {
        schema: {
          params: AgentParams,
          response: { 200: z.object({ ok: z.literal(true) }) },
        },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        const agentPath = path.join(
          project.rootPath,
          '.claude',
          'agents',
          `${req.params.filename}.md`,
        );
        try {
          await fs.unlink(agentPath);
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code === 'ENOENT') throw AppError.notFound('agent not found');
          fastify.log.error({ err }, 'unlink agent failed');
          throw AppError.internal('No se pudo eliminar el agente');
        }
        return { ok: true as const };
      },
    );
  },
  { name: 'routes:claude-config', dependencies: ['db'] },
);

function parseFrontmatter(raw: string): { name?: string; description?: string; body: string } {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) return { body: raw };
  const after = trimmed.slice(3);
  const endIdx = after.indexOf('\n---');
  if (endIdx === -1) return { body: raw };
  const fm = after.slice(0, endIdx);
  const body = after.slice(endIdx + 4).replace(/^\n/, '');
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return { name, description, body };
}
