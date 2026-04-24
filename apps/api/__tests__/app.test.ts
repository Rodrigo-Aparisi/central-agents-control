import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import type { Config } from '../src/config';

interface FakeProject {
  id: string;
  name: string;
  rootPath: string;
  description: string | null;
  claudeConfig: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface FakeRun {
  id: string;
  projectId: string;
  parentRunId: string | null;
  status: string;
  prompt: string;
  params: Record<string, unknown> | null;
  usage: Record<string, unknown> | null;
  exitCode: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface FakeEvent {
  id: string;
  runId: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

interface FakeArtifact {
  id: string;
  runId: string;
  filePath: string;
  operation: 'created' | 'modified' | 'deleted';
  diff: string | null;
  contentAfter: string | null;
  createdAt: string;
}

interface FakeJob {
  id: string;
  waiting: boolean;
  removed: boolean;
}

interface FakeState {
  projects: Map<string, FakeProject>;
  runs: Map<string, FakeRun>;
  events: FakeEvent[];
  artifacts: FakeArtifact[];
  jobs: Map<string, FakeJob>;
  publishes: Array<{ channel: string; message: string }>;
}

// Shared state that the mocks read/write. Each test can reset it.
const state: FakeState = {
  projects: new Map(),
  runs: new Map(),
  events: [],
  artifacts: [],
  jobs: new Map(),
  publishes: [],
};

function resetState(): void {
  state.projects.clear();
  state.runs.clear();
  state.events.length = 0;
  state.artifacts.length = 0;
  state.jobs.clear();
  state.publishes.length = 0;
}

vi.mock('../src/plugins/db', async () => {
  const fp = (await import('fastify-plugin')).default;
  const { newId } = await import('@cac/db');

  const plugin = fp(
    async (fastify) => {
      fastify.decorate('db', {
        handle: {} as never,
        db: {} as never,
        projects: {
          findById: async (id: string) => state.projects.get(id) ?? null,
          list: async ({ limit }: { limit: number }) =>
            Array.from(state.projects.values()).slice(0, limit),
          insert: async (input: Partial<FakeProject>) => {
            const now = new Date().toISOString();
            const row: FakeProject = {
              id: newId(),
              name: input.name ?? '',
              rootPath: input.rootPath ?? '',
              description: input.description ?? null,
              claudeConfig: input.claudeConfig ?? null,
              metadata: input.metadata ?? null,
              createdAt: now,
              updatedAt: now,
            };
            state.projects.set(row.id, row);
            return row;
          },
          update: async (id: string, patch: Partial<FakeProject>) => {
            const cur = state.projects.get(id);
            if (!cur) return null;
            const updated = { ...cur, ...patch, updatedAt: new Date().toISOString() };
            state.projects.set(id, updated);
            return updated;
          },
          delete: async (id: string) => state.projects.delete(id),
        } as never,
        runs: {
          findById: async (id: string) => state.runs.get(id) ?? null,
          list: async ({ projectId, limit }: { projectId?: string; limit: number }) => {
            let rows = Array.from(state.runs.values());
            if (projectId) rows = rows.filter((r) => r.projectId === projectId);
            return rows.slice(0, limit);
          },
          insert: async (input: Partial<FakeRun>) => {
            const now = new Date().toISOString();
            const row: FakeRun = {
              id: input.id ?? newId(),
              projectId: input.projectId ?? '',
              parentRunId: input.parentRunId ?? null,
              status: input.status ?? 'queued',
              prompt: input.prompt ?? '',
              params: input.params ?? null,
              usage: input.usage ?? null,
              exitCode: input.exitCode ?? null,
              durationMs: input.durationMs ?? null,
              error: input.error ?? null,
              createdAt: now,
              startedAt: input.startedAt ?? null,
              finishedAt: input.finishedAt ?? null,
            };
            state.runs.set(row.id, row);
            return row;
          },
          update: async (id: string, patch: Partial<FakeRun>) => {
            const cur = state.runs.get(id);
            if (!cur) return null;
            const updated = { ...cur, ...patch };
            state.runs.set(id, updated);
            return updated;
          },
          markStarted: async () => null,
          markFinished: async () => null,
          dailyStats: async () => [],
          totals: async () => ({
            runs: 0,
            completed: 0,
            failed: 0,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0,
          }),
          topProjects: async () => [],
          graphByProject: async (projectId: string) =>
            Array.from(state.runs.values())
              .filter((r) => r.projectId === projectId)
              .map((r) => ({
                id: r.id,
                parentRunId: r.parentRunId,
                status: r.status,
                createdAt: r.createdAt,
                prompt: r.prompt,
              })),
        } as never,
        events: {
          list: async ({
            runId,
            fromSeq = 0,
            limit,
          }: { runId: string; fromSeq?: number; limit?: number }) => {
            const rows = state.events
              .filter((e) => e.runId === runId && e.seq >= fromSeq)
              .sort((a, b) => a.seq - b.seq);
            return typeof limit === 'number' ? rows.slice(0, limit) : rows;
          },
          insertMany: async () => [],
        } as never,
        artifacts: {
          listByRun: async (runId: string) => state.artifacts.filter((a) => a.runId === runId),
          insertMany: async () => [],
        } as never,
        users: {} as never,
        refreshTokens: {} as never,
        auditEvents: {} as never,
        transaction: (async () => undefined) as never,
        ping: async () => true,
        close: async () => {},
      });
    },
    { name: 'db' },
  );

  return { dbPlugin: plugin };
});

vi.mock('../src/plugins/redis', async () => {
  const fp = (await import('fastify-plugin')).default;
  const plugin = fp(
    async (fastify) => {
      fastify.decorate('redis', {
        ping: async () => 'PONG',
        publish: async (channel: string, message: string) => {
          state.publishes.push({ channel, message });
          return 1;
        },
        disconnect: () => undefined,
        duplicate: () => ({
          subscribe: async () => undefined,
          on: () => undefined,
          disconnect: () => undefined,
        }),
        on: () => undefined,
      } as never);
    },
    { name: 'redis' },
  );
  return { redisPlugin: plugin };
});

vi.mock('../src/plugins/queues', async () => {
  const fp = (await import('fastify-plugin')).default;
  const plugin = fp(
    async (fastify) => {
      fastify.decorate('queues', {
        runs: {
          add: async (_name: string, _data: unknown, opts?: { jobId?: string }) => {
            const id = opts?.jobId ?? `job_${Math.random()}`;
            state.jobs.set(id, { id, waiting: true, removed: false });
            return { id };
          },
          getJob: async (id: string) => {
            const job = state.jobs.get(id);
            if (!job) return null;
            return {
              id: job.id,
              isWaiting: async () => job.waiting,
              remove: async () => {
                job.removed = true;
                state.jobs.delete(id);
              },
            };
          },
        } as never,
        runsEvents: {} as never,
        close: async () => {},
      });
    },
    { name: 'queues' },
  );
  return { queuesPlugin: plugin, RUNS_QUEUE_NAME: 'runs' };
});

vi.mock('../src/plugins/socketio', async () => {
  const fp = (await import('fastify-plugin')).default;
  const plugin = fp(
    async (fastify) => {
      const noopNs = { to: () => ({ emit: () => undefined }), on: () => undefined };
      fastify.decorate('io', { of: () => noopNs, close: async () => {} } as never);
      fastify.decorate('runsNs', noopNs as never);
    },
    { name: 'socketio' },
  );
  return { socketIoPlugin: plugin };
});

// Auth, cors and rate-limit plugins are no-ops in tests (AUTH_ENABLED=false).
vi.mock('../src/plugins/auth', async () => {
  const fp = (await import('fastify-plugin')).default;
  const noop = async () => {};
  const plugin = fp(
    async (fastify) => {
      fastify.decorate('requireAuth', noop as never);
      fastify.decorate('requireRole', () => noop as never);
    },
    { name: 'auth' },
  );
  return { authPlugin: plugin };
});

vi.mock('../src/plugins/cors', async () => {
  const fp = (await import('fastify-plugin')).default;
  const plugin = fp(async () => {}, { name: 'cors' });
  return { corsPlugin: plugin };
});

vi.mock('../src/plugins/rate-limit', async () => {
  const fp = (await import('fastify-plugin')).default;
  const plugin = fp(async () => {}, { name: 'rate-limit' });
  return { rateLimitPlugin: plugin };
});

// @fastify/cookie must be a no-op too (not decorated, just registered).
vi.mock('@fastify/cookie', async () => {
  const fp = (await import('fastify-plugin')).default;
  return { default: fp(async () => {}, { name: 'cookie' }) };
});

const projectsRoot = mkdtempSync(path.join(tmpdir(), 'cac-api-'));
const validRoot = path.join(projectsRoot, 'p1');

const cfg: Config = {
  NODE_ENV: 'test',
  API_HOST: '127.0.0.1',
  API_PORT: 0,
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://cac:cac@localhost:5432/cac',
  REDIS_URL: 'redis://localhost:6379',
  CLAUDE_BIN: 'claude',
  PROJECTS_ROOT: projectsRoot,
  RUN_TIMEOUT_MS: 30_000,
  MAX_CONCURRENT_RUNS: 1,
  ENABLE_WORKERS: false,
  resolvedProjectsRoot: projectsRoot,
  // Auth / security
  JWT_SECRET: 'test-secret-at-least-32-chars-long!!',
  JWT_EXPIRES_IN: 900,
  REFRESH_TOKEN_EXPIRES_DAYS: 30,
  ALLOWED_ORIGINS: '',
  RATE_LIMIT_ENABLED: false,
  AUTH_ENABLED: false, // skip JWT verification in unit tests
};

let app: Awaited<ReturnType<typeof buildApp>>;

async function seedProject(overrides: Partial<FakeProject> = {}): Promise<FakeProject> {
  const { newId } = await import('@cac/db');
  const now = new Date().toISOString();
  const project: FakeProject = {
    id: overrides.id ?? newId(),
    name: overrides.name ?? 'seed',
    rootPath: overrides.rootPath ?? validRoot,
    description: overrides.description ?? null,
    claudeConfig: overrides.claudeConfig ?? null,
    metadata: overrides.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  };
  state.projects.set(project.id, project);
  return project;
}

async function seedRun(projectId: string, overrides: Partial<FakeRun> = {}): Promise<FakeRun> {
  const { newId } = await import('@cac/db');
  const now = new Date().toISOString();
  const run: FakeRun = {
    id: overrides.id ?? newId(),
    projectId,
    parentRunId: overrides.parentRunId ?? null,
    status: overrides.status ?? 'running',
    prompt: overrides.prompt ?? 'seed prompt',
    params: overrides.params ?? { flags: [], model: 'claude-sonnet-4-6', timeoutMs: 30_000 },
    usage: overrides.usage ?? null,
    exitCode: overrides.exitCode ?? null,
    durationMs: overrides.durationMs ?? null,
    error: overrides.error ?? null,
    createdAt: now,
    startedAt: overrides.startedAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
  };
  state.runs.set(run.id, run);
  return run;
}

beforeAll(async () => {
  mkdirSync(validRoot, { recursive: true });
  app = await buildApp({ config: cfg });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(projectsRoot, { recursive: true, force: true });
});

beforeEach(() => {
  resetState();
});

describe('health', () => {
  it('returns ok when db and redis respond', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: 'ok', redis: 'ok' });
  });
});

describe('projects CRUD', () => {
  it('creates a project inside PROJECTS_ROOT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      payload: { name: 'alpha', rootPath: validRoot },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('alpha');
  });

  it('rejects a project outside PROJECTS_ROOT', async () => {
    const outside = path.resolve(tmpdir(), 'outside-root');
    mkdirSync(outside, { recursive: true });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      payload: { name: 'bad', rootPath: outside },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid body with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      payload: { name: '', rootPath: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('lists projects with cursor pagination shape', async () => {
    await seedProject({ name: 'one' });
    await seedProject({ name: 'two' });
    const res = await app.inject({ method: 'GET', url: '/v1/projects?limit=10' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.map((p: { name: string }) => p.name).sort()).toEqual(['one', 'two']);
    expect(body.nextCursor).toBeNull();
  });

  it('updates a project', async () => {
    const p = await seedProject({ name: 'old' });
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/projects/${p.id}`,
      payload: { name: 'new', description: 'updated' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('new');
  });

  it('deletes a project (204)', async () => {
    const p = await seedProject();
    const res = await app.inject({ method: 'DELETE', url: `/v1/projects/${p.id}` });
    expect(res.statusCode).toBe(204);
    expect(state.projects.has(p.id)).toBe(false);
  });

  it('404 on delete of missing project', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/projects/00000000-0000-7000-8000-000000000000',
    });
    expect(res.statusCode).toBe(404);
  });

  it('404 on get of missing project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/projects/00000000-0000-7000-8000-000000000000',
    });
    expect(res.statusCode).toBe(404);
  });

  it('400 for non-UUID id', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/projects/not-a-uuid' });
    expect(res.statusCode).toBe(400);
  });

  it('404s unknown routes with typed body', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('runs launch + cancel', () => {
  it('launches a run and returns 202 with runId', async () => {
    const p = await seedProject();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${p.id}/launch`,
      payload: { prompt: 'hello' },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json() as { runId: string };
    expect(body.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(state.runs.get(body.runId)?.status).toBe('queued');
    expect(state.jobs.size).toBe(1);
  });

  it('404 when launching on a missing project', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects/00000000-0000-7000-8000-000000000000/launch',
      payload: { prompt: 'hi' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('400 when the prompt is empty', async () => {
    const p = await seedProject();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${p.id}/launch`,
      payload: { prompt: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 when params.flags contains a non-whitelisted flag', async () => {
    const p = await seedProject();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${p.id}/launch`,
      payload: { prompt: 'x', params: { flags: ['--dangerous'] } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('cancel on a waiting run removes the job and marks cancelled', async () => {
    const p = await seedProject();
    const run = await seedRun(p.id, { status: 'queued' });
    state.jobs.set(run.id, { id: run.id, waiting: true, removed: false });

    const res = await app.inject({ method: 'POST', url: `/v1/runs/${run.id}/cancel` });
    expect(res.statusCode).toBe(202);
    expect(state.runs.get(run.id)?.status).toBe('cancelled');
    expect(state.jobs.has(run.id)).toBe(false);
    expect(state.publishes).toHaveLength(1);
    expect(state.publishes[0]?.channel).toBe('cac:run:cancel');
  });

  it('cancel on an active run publishes on the cancel channel', async () => {
    const p = await seedProject();
    const run = await seedRun(p.id, { status: 'running' });
    state.jobs.set(run.id, { id: run.id, waiting: false, removed: false });

    const res = await app.inject({ method: 'POST', url: `/v1/runs/${run.id}/cancel` });
    expect(res.statusCode).toBe(202);
    expect(state.publishes).toHaveLength(1);
    // status stays as 'running' — the worker is the one that flips it when the runner finishes
    expect(state.runs.get(run.id)?.status).toBe('running');
  });

  it('409 when cancelling an already-completed run', async () => {
    const p = await seedProject();
    const run = await seedRun(p.id, { status: 'completed' });
    const res = await app.inject({ method: 'POST', url: `/v1/runs/${run.id}/cancel` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('404 when cancelling a missing run', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/runs/00000000-0000-7000-8000-000000000000/cancel',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('runs + events + artifacts reads', () => {
  it('GET /v1/runs/:id returns the run', async () => {
    const p = await seedProject();
    const run = await seedRun(p.id);
    const res = await app.inject({ method: 'GET', url: `/v1/runs/${run.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(run.id);
  });

  it('GET /v1/runs lists runs (filterable by projectId)', async () => {
    const a = await seedProject();
    const b = await seedProject();
    await seedRun(a.id);
    await seedRun(b.id);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/runs?projectId=${a.id}&limit=10`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Array<{ projectId: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.projectId).toBe(a.id);
  });

  it('GET /v1/projects/:id/runs scopes by project', async () => {
    const p = await seedProject();
    await seedRun(p.id);
    const res = await app.inject({ method: 'GET', url: `/v1/projects/${p.id}/runs` });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
  });

  it('GET /v1/runs/:id/events returns ordered events', async () => {
    const { newId } = await import('@cac/db');
    const p = await seedProject();
    const run = await seedRun(p.id);
    state.events.push(
      {
        id: newId(),
        runId: run.id,
        seq: 1,
        type: 'system',
        payload: { type: 'system', content: 'boot' },
        timestamp: new Date().toISOString(),
      },
      {
        id: newId(),
        runId: run.id,
        seq: 0,
        type: 'assistant_message',
        payload: { type: 'assistant_message', content: 'hi' },
        timestamp: new Date().toISOString(),
      },
    );
    const res = await app.inject({
      method: 'GET',
      url: `/v1/runs/${run.id}/events?limit=50`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Array<{ seq: number }>; nextFromSeq: number | null };
    expect(body.items.map((e) => e.seq)).toEqual([0, 1]);
    expect(body.nextFromSeq).toBeNull();
  });

  it('GET /v1/runs/:id/events 404 for unknown run', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/runs/00000000-0000-7000-8000-000000000000/events',
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /v1/runs/:id/artifacts returns listByRun', async () => {
    const { newId } = await import('@cac/db');
    const p = await seedProject();
    const run = await seedRun(p.id);
    state.artifacts.push({
      id: newId(),
      runId: run.id,
      filePath: 'src/x.ts',
      operation: 'modified',
      diff: 'diff content',
      contentAfter: null,
      createdAt: new Date().toISOString(),
    });
    const res = await app.inject({ method: 'GET', url: `/v1/runs/${run.id}/artifacts` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Array<{ filePath: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.filePath).toBe('src/x.ts');
  });
});

describe('rerun (F-10)', () => {
  it('clones prompt + params and sets parentRunId', async () => {
    const p = await seedProject();
    const original = await seedRun(p.id, {
      status: 'completed',
      prompt: 'do the thing',
      params: { flags: ['--verbose'], model: 'custom', timeoutMs: 60_000 },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/runs/${original.id}/rerun`,
      payload: {},
    });
    expect(res.statusCode).toBe(202);
    const { runId } = res.json() as { runId: string };
    const cloned = state.runs.get(runId);
    expect(cloned?.prompt).toBe('do the thing');
    expect(cloned?.parentRunId).toBe(original.id);
    expect(cloned?.status).toBe('queued');
  });

  it('accepts an edited prompt in the body', async () => {
    const p = await seedProject();
    const original = await seedRun(p.id, { status: 'completed', prompt: 'v1' });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/runs/${original.id}/rerun`,
      payload: { prompt: 'v2 updated' },
    });
    expect(res.statusCode).toBe(202);
    const { runId } = res.json() as { runId: string };
    expect(state.runs.get(runId)?.prompt).toBe('v2 updated');
  });

  it('404 for missing run', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/runs/00000000-0000-7000-8000-000000000000/rerun',
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('run-graph (F-08 API)', () => {
  it('returns nodes with parent edges for a project', async () => {
    const p = await seedProject();
    const a = await seedRun(p.id, { status: 'completed' });
    const b = await seedRun(p.id, { status: 'completed', parentRunId: a.id });
    const res = await app.inject({ method: 'GET', url: `/v1/projects/${p.id}/run-graph` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      nodes: Array<{ id: string }>;
      edges: Array<{ from: string; to: string }>;
    };
    expect(body.nodes.map((n) => n.id).sort()).toEqual([a.id, b.id].sort());
    expect(body.edges).toEqual([{ from: a.id, to: b.id }]);
  });
});

describe('stats (F-07 API)', () => {
  it('returns global stats with defaults', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/stats/global' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      totals: { runs: number };
      days: unknown[];
      topProjects: unknown[];
    };
    expect(body.totals.runs).toBe(0);
    expect(Array.isArray(body.days)).toBe(true);
  });

  it('returns project stats', async () => {
    const p = await seedProject();
    const res = await app.inject({ method: 'GET', url: `/v1/stats/projects/${p.id}?days=7` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { projectId: string };
    expect(body.projectId).toBe(p.id);
  });

  it('404 for missing project in stats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/stats/projects/00000000-0000-7000-8000-000000000000',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('export (F-15)', () => {
  it('returns a JSON download for a run', async () => {
    const p = await seedProject();
    const run = await seedRun(p.id, { status: 'completed' });
    const res = await app.inject({ method: 'GET', url: `/v1/runs/${run.id}/export?format=json` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toMatch(/attachment.*\.json/);
    const body = JSON.parse(res.payload) as { run: { id: string }; events: unknown[] };
    expect(body.run.id).toBe(run.id);
    expect(Array.isArray(body.events)).toBe(true);
  });

  it('returns a markdown download when format=markdown', async () => {
    const p = await seedProject();
    const run = await seedRun(p.id, { status: 'completed', prompt: 'hello' });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/runs/${run.id}/export?format=markdown`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/markdown/);
    expect(res.payload).toContain('# Run ');
    expect(res.payload).toContain('hello');
  });

  it('rejects an unknown format with 400', async () => {
    const p = await seedProject();
    const run = await seedRun(p.id);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/runs/${run.id}/export?format=xml`,
    });
    expect(res.statusCode).toBe(400);
  });
});
