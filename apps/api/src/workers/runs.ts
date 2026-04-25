import { startRunner } from '@cac/claude-runner';
import { type CacDb, newId } from '@cac/db';
import {
  type ArtifactOperation,
  RUNS_NAMESPACE,
  type RunEvent,
  type RunParams,
} from '@cac/shared';
import type { RunStatusMessage } from '@cac/shared';
import { Worker } from 'bullmq';
import type { FastifyBaseLogger } from 'fastify';
import type { Redis } from 'ioredis';
import type { Namespace, Server as SocketIOServer } from 'socket.io';
import type { Config } from '../config';
import { eventToApi } from '../lib/mappers';
import { ensureProjectClaudeSettings } from '../lib/project-setup';
import { RUNS_QUEUE_NAME, type RunJobPayload } from '../plugins/queues';

const BATCH_FLUSH_MS = 200;
const BATCH_MAX_EVENTS = 50;
const CANCEL_CHANNEL = 'cac:run:cancel';

export interface RunsWorkerOptions {
  config: Config;
  db: CacDb;
  io: SocketIOServer;
  redis: Redis;
  logger: FastifyBaseLogger;
  /** Alternate Redis used to subscribe (BullMQ forbids reusing the queue connection). */
  subscriber?: Redis;
}

export function startRunsWorker(opts: RunsWorkerOptions): Worker<RunJobPayload> {
  const runsNs = opts.io.of(RUNS_NAMESPACE);

  const cancellers = new Map<string, (reason?: string) => void>();

  const subscriber = opts.subscriber ?? opts.redis.duplicate();
  subscriber.subscribe(CANCEL_CHANNEL).catch((err) => {
    opts.logger.error({ err }, 'failed to subscribe cancel channel');
  });
  subscriber.on('message', (channel, raw) => {
    if (channel !== CANCEL_CHANNEL) return;
    try {
      const parsed = JSON.parse(raw) as { runId?: string; reason?: string };
      if (parsed.runId) {
        const cancel = cancellers.get(parsed.runId);
        if (cancel) cancel(parsed.reason ?? 'user');
      }
    } catch {
      // ignore malformed messages
    }
  });

  const worker = new Worker<RunJobPayload>(
    RUNS_QUEUE_NAME,
    async (job) => {
      const log = opts.logger.child({ runId: job.data.runId, jobId: job.id });
      await processRun({ ...opts, log, runsNs, cancellers, job });
    },
    {
      connection: { url: opts.config.REDIS_URL },
      concurrency: opts.config.MAX_CONCURRENT_RUNS,
    },
  );

  worker.on('error', (err) => opts.logger.error({ err }, 'runs worker error'));
  worker.on('failed', (job, err) => {
    opts.logger.error({ err, jobId: job?.id, runId: job?.data.runId }, 'runs job failed');
  });

  worker.on('closing', () => {
    subscriber.disconnect();
  });

  return worker;
}

interface ProcessRunDeps extends RunsWorkerOptions {
  log: FastifyBaseLogger;
  runsNs: Namespace;
  cancellers: Map<string, (reason?: string) => void>;
  job: { data: RunJobPayload };
}

async function processRun(deps: ProcessRunDeps): Promise<void> {
  const { db, config, log, runsNs, cancellers, job } = deps;
  const { runId, projectId } = job.data;

  const project = await db.projects.findById(projectId);
  const run = await db.runs.findById(runId);
  if (!project || !run) {
    log.error('run or project missing at worker pickup');
    await db.runs.update(runId, {
      status: 'failed',
      error: 'project or run missing',
      finishedAt: new Date().toISOString(),
    });
    emitStatus(runsNs, { type: 'run:status', runId, status: 'failed' });
    return;
  }

  await ensureProjectClaudeSettings(project.rootPath).catch((err) => {
    log.warn({ err, rootPath: project.rootPath }, 'could not ensure .claude/settings.json');
  });

  await db.runs.markStarted(runId);
  emitStatus(runsNs, { type: 'run:status', runId, status: 'running' });

  const params: RunParams = (run.params ?? {
    flags: [],
    model: 'claude-sonnet-4-6',
    timeoutMs: config.RUN_TIMEOUT_MS,
  }) as RunParams;

  let handle: ReturnType<typeof startRunner>;
  try {
    handle = startRunner({
      runId,
      projectRoot: project.rootPath,
      projectsRoot: config.resolvedProjectsRoot,
      prompt: run.prompt,
      params,
      claudeBin: config.CLAUDE_BIN,
      envExtras: config.ANTHROPIC_API_KEY
        ? { ANTHROPIC_API_KEY: config.ANTHROPIC_API_KEY }
        : undefined,
    });
  } catch (err) {
    log.error({ err }, 'spawn failed');
    await db.runs.markFinished(runId, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    });
    emitStatus(runsNs, { type: 'run:status', runId, status: 'failed' });
    return;
  }

  cancellers.set(runId, handle.cancel);

  const buffer: RunEvent[] = [];
  let seq = 0;
  let flushTimer: NodeJS.Timeout | null = null;

  // Track file operations to populate run_artifacts after the run
  const artifactOps = new Map<string, ArtifactOperation>();
  const artifactContents = new Map<string, string | null>();

  // Track Task tool_use invocations to create synthetic child run records
  const taskDescriptions: Array<{ description: string }> = [];

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return;
    const batch = buffer.splice(0);
    try {
      await db.events.insertMany(
        batch.map((e) => ({
          id: e.id,
          runId: e.runId,
          seq: e.seq,
          type: e.type,
          payload: e.payload,
          timestamp: e.timestamp,
        })),
      );
    } catch (err) {
      log.error({ err, count: batch.length }, 'failed to persist events batch');
    }
    runsNs.to(runId).emit('run:log', { type: 'run:log', runId, events: batch });
  };

  const scheduleFlush = (): void => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, BATCH_FLUSH_MS);
  };

  try {
    for await (const ev of handle.events) {
      if (ev.kind === 'parse-error') {
        log.warn({ raw: ev.raw, reason: ev.reason }, 'parse-error');
        continue;
      }
      if (ev.kind === 'suspicious') {
        log.warn({ tool: ev.tool, suspicious: true }, 'suspicious tool_use blocked');
        continue;
      }
      const runEvent: RunEvent = {
        id: newId(),
        runId,
        seq: seq++,
        type: ev.type,
        payload: ev.payload,
        timestamp: ev.timestamp,
      };
      buffer.push(runEvent);

      if (ev.payload.type === 'tool_use') {
        const { tool, input } = ev.payload;
        const toolLower = tool.toLowerCase();

        if (toolLower === 'task') {
          const raw =
            input['description'] ??
            input['prompt'] ??
            'sub-agent';
          const description = String(raw).slice(0, 200);
          taskDescriptions.push({ description });
        }

        const filePath =
          typeof input.path === 'string'
            ? input.path
            : typeof input.file_path === 'string'
              ? input.file_path
              : null;
        if (filePath) {
          if (toolLower === 'write') {
            const content = typeof input.content === 'string' ? input.content : null;
            if (!artifactOps.has(filePath)) artifactOps.set(filePath, 'created');
            artifactContents.set(filePath, content);
          } else if (toolLower === 'edit') {
            const newStr = typeof input.new_string === 'string' ? input.new_string : null;
            if (!artifactOps.has(filePath)) artifactOps.set(filePath, 'modified');
            artifactContents.set(filePath, newStr);
          } else if (toolLower === 'multiedit') {
            if (!artifactOps.has(filePath)) artifactOps.set(filePath, 'modified');
          }
        }
      }

      runsNs.to(runId).emit(
        'run:event',
        eventToApi({
          id: runEvent.id,
          runId: runEvent.runId,
          seq: runEvent.seq,
          type: runEvent.type,
          payload: runEvent.payload,
          timestamp: runEvent.timestamp,
        }),
      );
      if (buffer.length >= BATCH_MAX_EVENTS) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        await flush();
      } else {
        scheduleFlush();
      }
    }
  } catch (err) {
    log.error({ err }, 'error iterating runner events');
  } finally {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await flush();
    cancellers.delete(runId);

    if (artifactOps.size > 0) {
      await db.artifacts
        .insertMany(
          Array.from(artifactOps.entries()).map(([filePath, operation]) => ({
            runId,
            filePath,
            operation,
            contentAfter: artifactContents.get(filePath) ?? null,
            diff: null,
          })),
        )
        .catch((err) => log.error({ err }, 'failed to persist artifacts'));
    }
  }

  const result = await handle.result;
  const status =
    result.reason === 'completed'
      ? 'completed'
      : result.reason === 'cancelled'
        ? 'cancelled'
        : result.reason === 'timeout'
          ? 'timeout'
          : 'failed';

  if (taskDescriptions.length > 0) {
    await Promise.all(
      taskDescriptions.map(({ description }) =>
        db.runs
          .insert({ projectId, parentRunId: runId, prompt: description, status, params })
          .catch((err) => log.warn({ err }, 'failed to create task sub-run')),
      ),
    );
  }

  await db.runs.markFinished(runId, {
    status,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    usage: result.usage,
    error: result.error?.message ?? null,
  });

  emitStatus(runsNs, {
    type: 'run:status',
    runId,
    status,
    exitCode: result.exitCode,
    reason: result.reason,
  });
  log.info({ status, durationMs: result.durationMs }, 'run finished');
}

function emitStatus(runsNs: Namespace, msg: RunStatusMessage): void {
  runsNs.to(msg.runId).emit('run:status', msg);
}
