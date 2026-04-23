import { AppError, ExportFormat, UuidV7 } from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { artifactToApi, eventToApi, runToApi } from '../lib/mappers';

const Params = z.object({ id: UuidV7 });
const Query = z.object({ format: ExportFormat.default('json') });

export const exportRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/v1/runs/:id/export',
      { schema: { params: Params, querystring: Query } },
      async (req, reply) => {
        const run = await fastify.db.runs.findById(req.params.id);
        if (!run) throw AppError.notFound(`run ${req.params.id} not found`);

        const [events, artifacts, project] = await Promise.all([
          fastify.db.events.list({ runId: run.id }),
          fastify.db.artifacts.listByRun(run.id),
          fastify.db.projects.findById(run.projectId),
        ]);

        const runApi = runToApi(run);
        const eventsApi = events.map(eventToApi);
        const artifactsApi = artifacts.map(artifactToApi);

        if (req.query.format === 'json') {
          const payload = {
            project: project ? { id: project.id, name: project.name } : null,
            run: runApi,
            events: eventsApi,
            artifacts: artifactsApi,
          };
          return reply
            .header('content-type', 'application/json; charset=utf-8')
            .header('content-disposition', `attachment; filename="run-${run.id}.json"`)
            .send(JSON.stringify(payload, null, 2));
        }

        const md = renderMarkdown({
          projectName: project?.name ?? '(unknown)',
          run: runApi,
          events: eventsApi,
          artifacts: artifactsApi,
        });
        return reply
          .header('content-type', 'text/markdown; charset=utf-8')
          .header('content-disposition', `attachment; filename="run-${run.id}.md"`)
          .send(md);
      },
    );
  },
  { name: 'routes:export', dependencies: ['db'] },
);

interface MarkdownInput {
  projectName: string;
  run: ReturnType<typeof runToApi>;
  events: ReturnType<typeof eventToApi>[];
  artifacts: ReturnType<typeof artifactToApi>[];
}

function renderMarkdown({ projectName, run, events, artifacts }: MarkdownInput): string {
  const lines: string[] = [];
  lines.push(`# Run ${run.id}`);
  lines.push('');
  lines.push(`- **Project**: ${projectName}`);
  lines.push(`- **Status**: ${run.status}`);
  lines.push(`- **Created**: ${run.createdAt}`);
  if (run.startedAt) lines.push(`- **Started**: ${run.startedAt}`);
  if (run.finishedAt) lines.push(`- **Finished**: ${run.finishedAt}`);
  if (run.durationMs !== null) lines.push(`- **Duration**: ${(run.durationMs / 1000).toFixed(1)}s`);
  if (run.usage) {
    lines.push(
      `- **Tokens**: in ${run.usage.inputTokens} / out ${run.usage.outputTokens} / cache r ${run.usage.cacheReadTokens} w ${run.usage.cacheWriteTokens}`,
    );
    lines.push(`- **Cost**: $${run.usage.estimatedCostUsd.toFixed(4)}`);
  }
  lines.push('');
  lines.push('## Prompt');
  lines.push('```');
  lines.push(run.prompt);
  lines.push('```');
  lines.push('');

  if (events.length > 0) {
    lines.push('## Events');
    for (const ev of events) {
      lines.push(`### #${ev.seq} · ${ev.type}`);
      lines.push('```json');
      lines.push(JSON.stringify(ev.payload, null, 2));
      lines.push('```');
    }
    lines.push('');
  }

  if (artifacts.length > 0) {
    lines.push('## Changed files');
    for (const a of artifacts) {
      lines.push(`### ${a.filePath} — ${a.operation}`);
      if (a.diff) {
        lines.push('```diff');
        lines.push(a.diff);
        lines.push('```');
      }
    }
  }

  return `${lines.join('\n')}\n`;
}
