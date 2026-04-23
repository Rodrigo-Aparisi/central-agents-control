import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import type { Config } from '../src/config';

// We isolate the DB/Redis/Queues/SocketIO plugins so tests stay hermetic.
// The goal here is to exercise wiring, validation and error handling.
vi.mock('../src/plugins/db', async () => {
  const fp = (await import('fastify-plugin')).default;
  const projects = new Map<
    string,
    {
      id: string;
      name: string;
      rootPath: string;
      description: string | null;
      claudeConfig: null;
      metadata: null;
      createdAt: string;
      updatedAt: string;
    }
  >();
  const { newId } = await import('@cac/db');
  const plugin = fp(
    async (fastify) => {
      const repo = {
        async findById(id: string) {
          return projects.get(id) ?? null;
        },
        async list({ limit }: { limit: number }) {
          return Array.from(projects.values()).slice(0, limit);
        },
        async insert(input: { name: string; rootPath: string; description: string | null }) {
          const now = new Date().toISOString();
          const row = {
            id: newId(),
            name: input.name,
            rootPath: input.rootPath,
            description: input.description,
            claudeConfig: null,
            metadata: null,
            createdAt: now,
            updatedAt: now,
          };
          projects.set(row.id, row);
          return row;
        },
        async update(id: string, patch: Record<string, unknown>) {
          const cur = projects.get(id);
          if (!cur) return null;
          const updated = { ...cur, ...patch, updatedAt: new Date().toISOString() };
          projects.set(id, updated);
          return updated;
        },
        async delete(id: string) {
          return projects.delete(id);
        },
      };
      const runs = { list: async () => [], findById: async () => null };
      const events = { list: async () => [], insertMany: async () => [] };
      const artifacts = { listByRun: async () => [] };
      fastify.decorate('db', {
        handle: {} as never,
        db: {} as never,
        projects: repo as never,
        runs: runs as never,
        events: events as never,
        artifacts: artifacts as never,
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
        publish: async () => 1,
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
        runs: { add: async () => ({ id: 'fake' }), getJob: async () => null } as never,
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

const projectsRoot = mkdtempSync(path.join(tmpdir(), 'cac-api-'));

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
};

let app: Awaited<ReturnType<typeof buildApp>>;
const validRoot = path.join(projectsRoot, 'p1');

beforeAll(async () => {
  mkdirSync(validRoot, { recursive: true });
  app = await buildApp({ config: cfg });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(projectsRoot, { recursive: true, force: true });
});

describe('health route', () => {
  it('returns ok when db and redis respond', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(body.redis).toBe('ok');
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
    const body = res.json();
    expect(body.name).toBe('alpha');
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects a project outside PROJECTS_ROOT', async () => {
    const outside = path.resolve(tmpdir(), 'not-in-projects-root');
    mkdirSync(outside, { recursive: true });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      payload: { name: 'bad', rootPath: outside },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid body with 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      payload: { name: '', rootPath: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for a missing project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/projects/00000000-0000-7000-8000-000000000000',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('404s unknown routes with typed body', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
