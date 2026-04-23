import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config';

let projectsRoot: string;

beforeAll(() => {
  projectsRoot = mkdtempSync(path.join(tmpdir(), 'cac-cfg-'));
});

afterAll(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('parses a valid env', () => {
    const cfg = loadConfig({
      DATABASE_URL: 'postgres://cac:cac@localhost:5432/cac',
      REDIS_URL: 'redis://localhost:6379',
      PROJECTS_ROOT: projectsRoot,
    });
    expect(cfg.NODE_ENV).toBe('development');
    expect(cfg.API_PORT).toBe(8787);
    expect(cfg.resolvedProjectsRoot).toBeTruthy();
  });

  it('rejects a missing required var', () => {
    expect(() =>
      loadConfig({
        REDIS_URL: 'redis://localhost:6379',
        PROJECTS_ROOT: projectsRoot,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-existent PROJECTS_ROOT', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgres://cac:cac@localhost:5432/cac',
        REDIS_URL: 'redis://localhost:6379',
        PROJECTS_ROOT: path.join(projectsRoot, 'missing-dir-xyz'),
      }),
    ).toThrow(/does not exist/);
  });

  it('coerces ENABLE_WORKERS string "false" to boolean', () => {
    const cfg = loadConfig({
      DATABASE_URL: 'postgres://cac:cac@localhost:5432/cac',
      REDIS_URL: 'redis://localhost:6379',
      PROJECTS_ROOT: projectsRoot,
      ENABLE_WORKERS: 'false',
    });
    expect(cfg.ENABLE_WORKERS).toBe(false);
  });
});
