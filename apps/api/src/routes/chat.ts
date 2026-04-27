import {
  AppError,
  ChatMessage,
  ChatSession,
  CreateChatSessionInput,
  SendChatMessageInput,
  UuidV7,
} from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { startRunner } from '@cac/claude-runner';

const RUN_BLOCK_RE = /```run\r?\n([\s\S]+?)```/g;

const CHAT_TIMEOUT_MS = 120_000;

function toApiSession(
  row: { id: string; projectId: string; title: string; createdAt: string; updatedAt: string },
  messageCount: number,
): ChatSession {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    messageCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toApiMessage(row: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  seq: number;
  createdAt: string;
}): ChatMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    seq: row.seq,
    createdAt: row.createdAt,
  };
}

export const chatRoutes = fp(
  async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    // ── List sessions ──────────────────────────────────────────────────────────
    app.get(
      '/v1/projects/:id/chats',
      {
        schema: { params: z.object({ id: UuidV7 }) },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        const sessions = await fastify.db.chatSessions.listByProject(req.params.id);
        const counts = await Promise.all(
          sessions.map((s) => fastify.db.chatMessages.countBySession(s.id)),
        );

        return { items: sessions.map((s, i) => toApiSession(s, counts[i] ?? 0)) };
      },
    );

    // ── Create session ─────────────────────────────────────────────────────────
    app.post(
      '/v1/projects/:id/chats',
      {
        schema: {
          params: z.object({ id: UuidV7 }),
          body: CreateChatSessionInput,
        },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        const session = await fastify.db.chatSessions.insert({
          projectId: req.params.id,
          title: req.body.title ?? 'Nueva conversación',
        });

        return toApiSession(session, 0);
      },
    );

    // ── Get session messages ───────────────────────────────────────────────────
    app.get(
      '/v1/projects/:id/chats/:sessionId/messages',
      {
        schema: {
          params: z.object({ id: UuidV7, sessionId: UuidV7 }),
        },
        preHandler: [fastify.requireAuth],
      },
      async (req) => {
        const session = await fastify.db.chatSessions.findById(req.params.sessionId);
        if (!session || session.projectId !== req.params.id) {
          throw AppError.notFound(`chat session ${req.params.sessionId} not found`);
        }

        const messages = await fastify.db.chatMessages.listBySession(req.params.sessionId);
        return { items: messages.map(toApiMessage) };
      },
    );

    // ── Delete session ─────────────────────────────────────────────────────────
    app.delete(
      '/v1/projects/:id/chats/:sessionId',
      {
        schema: {
          params: z.object({ id: UuidV7, sessionId: UuidV7 }),
        },
        preHandler: [fastify.requireAuth],
      },
      async (req, reply) => {
        const session = await fastify.db.chatSessions.findById(req.params.sessionId);
        if (!session || session.projectId !== req.params.id) {
          throw AppError.notFound(`chat session ${req.params.sessionId} not found`);
        }
        await fastify.db.chatSessions.delete(req.params.sessionId);
        return reply.status(204).send();
      },
    );

    // ── Send message (SSE streaming) ───────────────────────────────────────────
    app.post(
      '/v1/projects/:id/chats/:sessionId/send',
      {
        schema: {
          params: z.object({ id: UuidV7, sessionId: UuidV7 }),
          body: SendChatMessageInput,
        },
        preHandler: [fastify.requireAuth],
      },
      async (req, reply) => {
        const project = await fastify.db.projects.findById(req.params.id);
        if (!project) throw AppError.notFound(`project ${req.params.id} not found`);

        const session = await fastify.db.chatSessions.findById(req.params.sessionId);
        if (!session || session.projectId !== req.params.id) {
          throw AppError.notFound(`chat session ${req.params.sessionId} not found`);
        }

        // Persist user message
        const history = await fastify.db.chatMessages.listBySession(req.params.sessionId);
        const nextSeq = history.length > 0 ? (history[history.length - 1]!.seq + 1) : 0;

        const userMsg = await fastify.db.chatMessages.insert({
          sessionId: req.params.sessionId,
          role: 'user',
          content: req.body.content,
          seq: nextSeq,
        });

        // Auto-title session from first user message
        if (history.length === 0 && session.title === 'Nueva conversación') {
          const autoTitle = req.body.content.slice(0, 80).replace(/\n/g, ' ');
          await fastify.db.chatSessions.updateTitle(req.params.sessionId, autoTitle);
        }

        const model =
          req.body.model ??
          (project.claudeConfig as { model?: string } | null)?.model ??
          'claude-sonnet-4-6';

        const systemPrompt = `You are a helpful assistant for the project "${project.name}" located at ${project.rootPath}.
Help the developer think through decisions, iterate on concepts, discuss topics, and execute tasks on the project.
Be concise but thorough. Format code with markdown code blocks.
IMPORTANT: Respond ONLY with plain text/markdown. Do NOT use any tools (Bash, Read, Write, etc.).

## Launching runs
When the user asks you to execute, implement, run, or create something in the project, you can launch a run directly.
Include a run block with the exact prompt for Claude Code to execute autonomously:

\`\`\`run
<detailed prompt for Claude Code to execute — be specific about what to implement, modify, or create>
\`\`\`

Rules for run blocks:
- Only use for tasks that require file changes, code execution, or autonomous work
- Write the prompt as if instructing Claude Code directly — be explicit and complete
- You can include multiple run blocks for independent tasks
- For pure questions, analysis, or brainstorming, do NOT use run blocks — just respond in prose
- After the run block, briefly explain what the run will do`;

        let prompt: string;
        if (history.length === 0) {
          prompt = `${systemPrompt}\n\nUser: ${req.body.content}`;
        } else {
          const historyText = history
            .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n\n');
          prompt = `${systemPrompt}\n\n## Conversation history\n\n${historyText}\n\n---\n\nContinue the conversation. Respond to the developer's next message.\n\nUser: ${req.body.content}`;
        }

        reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        reply.raw.setHeader('Cache-Control', 'no-cache, no-store');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');
        reply.hijack();

        const handle = startRunner({
          runId: `chat-session-${req.params.sessionId}-${Date.now()}`,
          projectRoot: project.rootPath,
          projectsRoot: fastify.config.resolvedProjectsRoot,
          prompt,
          params: { flags: [], model, timeoutMs: CHAT_TIMEOUT_MS },
          claudeBin: fastify.config.CLAUDE_BIN,
          envExtras: fastify.config.ANTHROPIC_API_KEY
            ? { ANTHROPIC_API_KEY: fastify.config.ANTHROPIC_API_KEY }
            : undefined,
        });

        req.raw.on('close', () => handle.cancel('disconnected'));

        let assistantContent = '';

        try {
          for await (const ev of handle.events) {
            if (ev.kind !== 'event') continue;
            if (ev.type === 'assistant_message' && ev.payload.type === 'assistant_message') {
              const text = ev.payload.content;
              if (text) {
                assistantContent += text;
                reply.raw.write(`data: ${JSON.stringify({ text })}\n\n`);
              }
            }
          }

          const result = await handle.result;

          if (result.reason === 'completed' && assistantContent.length > 0) {
            // Detect and launch any run blocks in the response
            let finalContent = assistantContent;
            const runMatches = [...assistantContent.matchAll(RUN_BLOCK_RE)];
            const launchedRuns: Array<{ id: string; prompt: string }> = [];

            for (const match of runMatches) {
              const runPrompt = match[1]!.trim();
              if (!runPrompt) continue;
              try {
                const run = await fastify.db.runs.insert({
                  projectId: req.params.id,
                  status: 'queued',
                  prompt: runPrompt,
                  params: { flags: [], model, timeoutMs: fastify.config.RUN_TIMEOUT_MS },
                  usage: null,
                  exitCode: null,
                  durationMs: null,
                  error: null,
                  startedAt: null,
                  finishedAt: null,
                });
                await fastify.queues.runs.add(
                  'run',
                  { runId: run.id, projectId: req.params.id },
                  { jobId: run.id },
                );
                req.log.info({ runId: run.id }, 'run launched from chat');
                const short = runPrompt.slice(0, 200);
                launchedRuns.push({ id: run.id, prompt: short });
                // Replace ```run block with ```run-launched block containing the run ID
                finalContent = finalContent.replace(
                  match[0]!,
                  `\`\`\`run-launched\n${JSON.stringify({ id: run.id, prompt: short })}\n\`\`\``,
                );
              } catch (err) {
                req.log.error({ err }, 'failed to launch run from chat');
              }
            }

            // Persist assistant response (with run-launched replacements) + token usage
            const assistantSeq = nextSeq + 1;
            await Promise.all([
              fastify.db.chatMessages.insert({
                sessionId: req.params.sessionId,
                role: 'assistant',
                content: finalContent,
                seq: assistantSeq,
              }),
              fastify.db.chatSessions.addUsage(req.params.sessionId, result.usage),
            ]);

            if (launchedRuns.length > 0) {
              reply.raw.write(`data: ${JSON.stringify({ launchedRuns })}\n\n`);
            }
            reply.raw.write('data: {"done":true}\n\n');
          } else if (result.reason !== 'completed') {
            const msg = result.error?.message ?? result.reason;
            reply.raw.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
          }
        } catch (err) {
          req.log.error({ err }, 'chat send error');
          const message = err instanceof Error ? err.message : 'error';
          reply.raw.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        } finally {
          reply.raw.end();
        }
      },
    );
  },
  { name: 'routes:chat', dependencies: ['db', 'config', 'queues'] },
);
