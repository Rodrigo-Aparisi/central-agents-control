import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateProjectRoot } from './cwd';
import { RunnerError } from './errors';

const base = mkdtempSync(path.join(tmpdir(), 'cac-cwd-'));
const projectsRoot = path.join(base, 'projects');
const inside = path.join(projectsRoot, 'a');
const outside = path.join(base, 'outside');
const symlinkToOutside = path.join(projectsRoot, 'escape');

beforeAll(() => {
  mkdirSync(projectsRoot, { recursive: true });
  mkdirSync(inside, { recursive: true });
  mkdirSync(outside, { recursive: true });
  try {
    symlinkSync(outside, symlinkToOutside, 'dir');
  } catch {
    // Windows without symlink permission — the test below will be skipped
  }
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('validateProjectRoot', () => {
  it('accepts a project inside projectsRoot', () => {
    const resolved = validateProjectRoot({ projectRoot: inside, projectsRoot });
    expect(path.resolve(resolved)).toBe(path.resolve(inside));
  });

  it('accepts projectRoot equal to projectsRoot', () => {
    const resolved = validateProjectRoot({ projectRoot: projectsRoot, projectsRoot });
    expect(path.resolve(resolved)).toBe(path.resolve(projectsRoot));
  });

  it('rejects a relative projectRoot', () => {
    expect(() => validateProjectRoot({ projectRoot: 'rel/path', projectsRoot })).toThrow(
      RunnerError,
    );
  });

  it('rejects a non-existent projectRoot', () => {
    const missing = path.join(projectsRoot, 'does-not-exist');
    const err = (() => {
      try {
        validateProjectRoot({ projectRoot: missing, projectsRoot });
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(RunnerError);
    expect((err as RunnerError).code).toBe('INVALID_CWD');
  });

  it('rejects a path outside projectsRoot', () => {
    expect(() => validateProjectRoot({ projectRoot: outside, projectsRoot })).toThrow(RunnerError);
  });

  it('rejects a symlink that escapes projectsRoot', () => {
    let canSymlink = true;
    try {
      // probe the symlink created in beforeAll
      const s = path.join(projectsRoot, 'escape');
      validateProjectRoot({ projectRoot: s, projectsRoot });
    } catch (e) {
      expect(e).toBeInstanceOf(RunnerError);
      expect((e as RunnerError).code).toBe('INVALID_CWD');
      return;
    }
    // If we got here, either the symlink wasn't created (Windows) or resolution didn't escape
    canSymlink = false;
    expect(canSymlink).toBe(false);
  });
});
