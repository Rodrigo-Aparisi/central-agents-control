import fs from 'node:fs/promises';
import path from 'node:path';
import { startRunner } from '@cac/claude-runner';
import { AppError, UuidV7 } from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const AGENT_GUIDELINES = `You are an expert at creating Claude Code sub-agent definition files. Help the developer design a specialized sub-agent for their project.

## Agent file format

Agent files are Markdown saved to \`.claude/agents/<filename>.md\` with YAML frontmatter:

\`\`\`
---
name: Display Name
description: When Claude Code should invoke this agent
---

System prompt body here...
\`\`\`

## Guidelines

- **name**: Human-readable display name (shown in Claude Code's UI)
- **description**: Critical for routing — Claude Code uses this to decide when to delegate. Make it specific and action-oriented (e.g. "Use when implementing React components")
- **body**: A thorough system prompt with the agent's role, responsibilities, constraints, output format, and domain knowledge
- **filename**: Lowercase with hyphens, derived from name (e.g. "React Developer" → "react-developer")

## When to output the final definition

Once you have iterated with the developer and the definition is complete, output it in this exact fenced block — the CAC app will detect it and offer a save button:

\`\`\`agent-definition
---
name: Agent Display Name
description: Specific description of when to invoke this agent
filename: agent-filename
---

Full system prompt body here...
\`\`\`

Until then, ask clarifying questions and iterate. Do NOT rush to produce the final definition.

IMPORTANT: Respond ONLY with plain text. Do NOT use any tools (Bash, Read, Write, etc.). Your response appears in a chat UI.`;

const CHAT_TIMEOUT_MS = 120_000;

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(50_000),
});

const ChatBody = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
});

export const agentChatRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.post(
      '/v1/projects/:id/agent-chat',
      {
        schema: {
          params: z.object({ id: UuidV7 }),
          body: ChatBody,
        },
        preHandler: [fastify.requireAuth],
      },
      async (req, reply) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        // Build project context
        const ctxLines: string[] = [`- Project: ${project.name} (${project.rootPath})`];

        try {
          const agentsDir = path.join(project.rootPath, '.claude', 'agents');
          const files = await fs.readdir(agentsDir);
          const names = files.filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
          if (names.length > 0) ctxLines.push(`- Existing agents: ${names.join(', ')}`);
        } catch {
          /* no agents dir — omit */
        }

        try {
          const raw = await fs.readFile(path.join(project.rootPath, 'CLAUDE.md'), 'utf8');
          const excerpt = raw.slice(0, 600);
          ctxLines.push(`- CLAUDE.md excerpt:\n${excerpt}${raw.length > 600 ? '…' : ''}`);
        } catch {
          /* no CLAUDE.md — omit */
        }

        // Build single prompt that embeds the full conversation history
        const { messages } = req.body;
        const history = messages.slice(0, -1);
        const latest = messages[messages.length - 1]!;

        let prompt = `${AGENT_GUIDELINES}\n\n## Project context\n${ctxLines.join('\n')}`;

        if (history.length > 0) {
          const historyText = history
            .map((m) => `${m.role === 'user' ? 'Developer' : 'You'}: ${m.content}`)
            .join('\n\n');
          prompt +=
            `\n\n## Conversation so far\n\n${historyText}` +
            `\n\n---\n\nContinue the conversation by responding to the developer's next message. ` +
            `Do NOT repeat any of the above content, just provide your next response.\n\n`;
        }

        prompt += `Developer: ${latest.content}`;

        reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        reply.raw.setHeader('Cache-Control', 'no-cache, no-store');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');
        reply.hijack();

        const handle = startRunner({
          runId: `chat-${Date.now()}`,
          projectRoot: project.rootPath,
          projectsRoot: fastify.config.resolvedProjectsRoot,
          prompt,
          params: { flags: [], model: 'claude-sonnet-4-6', timeoutMs: CHAT_TIMEOUT_MS },
          claudeBin: fastify.config.CLAUDE_BIN,
          envExtras: fastify.config.ANTHROPIC_API_KEY
            ? { ANTHROPIC_API_KEY: fastify.config.ANTHROPIC_API_KEY }
            : undefined,
        });

        req.raw.on('close', () => handle.cancel('disconnected'));

        try {
          for await (const ev of handle.events) {
            if (ev.kind !== 'event') continue;
            if (ev.type === 'assistant_message' && ev.payload.type === 'assistant_message') {
              const text = ev.payload.content;
              if (text) reply.raw.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }

          const result = await handle.result;
          if (result.reason === 'completed') {
            reply.raw.write('data: {"done":true}\n\n');
          } else {
            const msg = result.error?.message ?? result.reason;
            reply.raw.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
          }
        } catch (err) {
          req.log.error({ err }, 'agent-chat error');
          const message = err instanceof Error ? err.message : 'error';
          reply.raw.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        } finally {
          reply.raw.end();
        }
      },
    );
  },
  { name: 'routes:agent-chat', dependencies: ['db', 'config'] },
);
