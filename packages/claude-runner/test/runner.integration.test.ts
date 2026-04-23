import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RunParams } from '@cac/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RunnerError } from '../src/errors';
import type { ParsedEvent, ParserOutput } from '../src/parser';
import { startRunner } from '../src/runner';

const here = path.dirname(fileURLToPath(import.meta.url));
const fakeScript = path.join(here, 'fake-claude.mjs');

let projectsRoot: string;
let projectRoot: string;

beforeAll(() => {
  projectsRoot = mkdtempSync(path.join(tmpdir(), 'cac-runner-'));
  projectRoot = path.join(projectsRoot, 'p1');
  mkdirSync(projectRoot, { recursive: true });
});

afterAll(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

const baseParams: RunParams = {
  flags: [],
  model: 'claude-sonnet-4-6',
  timeoutMs: 30_000,
};

function runFake(scenario: string, overrides: { timeoutMs?: number } = {}) {
  return startRunner({
    runId: '00000000-0000-7000-8000-000000000000',
    projectRoot,
    projectsRoot,
    prompt: 'test',
    params: { ...baseParams, timeoutMs: overrides.timeoutMs ?? baseParams.timeoutMs },
    claudeBin: process.execPath,
    argsPrefix: [fakeScript],
    envExtras: { FAKE_CLAUDE_SCENARIO: scenario },
    sigkillGraceMs: 500,
  });
}

async function drain(handle: ReturnType<typeof startRunner>): Promise<ParserOutput[]> {
  const out: ParserOutput[] = [];
  for await (const ev of handle.events) out.push(ev);
  return out;
}

describe('runner (integration with fake-claude.mjs via node)', () => {
  it('rejects a cwd outside projectsRoot', () => {
    expect(() =>
      startRunner({
        runId: '00000000-0000-7000-8000-000000000001',
        projectRoot: tmpdir(),
        projectsRoot,
        prompt: 'hi',
        params: baseParams,
        claudeBin: process.execPath,
        argsPrefix: [fakeScript],
      }),
    ).toThrow(RunnerError);
  });

  it('happy path: emits system + assistant + usage, exits 0', async () => {
    const h = runFake('happy-path');
    const events = await drain(h);
    const res = await h.result;

    expect(res.reason).toBe('completed');
    expect(res.exitCode).toBe(0);
    const evts = events.filter((e): e is ParsedEvent => e.kind === 'event');
    expect(evts.map((e) => e.type)).toEqual(
      expect.arrayContaining(['system', 'assistant_message', 'usage']),
    );
    expect(res.usage).toMatchObject({
      inputTokens: 12,
      outputTokens: 34,
      cacheReadTokens: 1,
      cacheWriteTokens: 2,
    });
  });

  it('cancel sends SIGTERM and marks reason=cancelled', async () => {
    const h = runFake('slow');
    setTimeout(() => h.cancel(), 200);
    await drain(h);
    const res = await h.result;
    expect(res.reason).toBe('cancelled');
  }, 10_000);

  it('crash: exit 42 → reason=crashed', async () => {
    const h = runFake('crash');
    await drain(h);
    const res = await h.result;
    expect(res.reason).toBe('crashed');
    expect(res.exitCode).toBe(42);
  });

  it('bad JSON line yields parse-error but run still completes', async () => {
    const h = runFake('bad-json');
    const events = await drain(h);
    const res = await h.result;
    expect(res.reason).toBe('completed');
    expect(events.some((e) => e.kind === 'parse-error')).toBe(true);
  });

  it('redacts Anthropic API keys embedded in assistant content', async () => {
    const h = runFake('with-secrets');
    const events = await drain(h);
    await h.result;
    const assistant = events.find(
      (e): e is ParsedEvent => e.kind === 'event' && e.payload.type === 'assistant_message',
    );
    expect(assistant).toBeDefined();
    if (assistant && assistant.payload.type === 'assistant_message') {
      expect(assistant.payload.content).toContain('[ANTHROPIC_KEY_REDACTED]');
      expect(assistant.payload.content).not.toContain('sk-ant-api-ABCDEFGHIJKLMNOPQRST');
    }
  });

  it('marks non-whitelisted tool_use as suspicious and keeps whitelisted ones', async () => {
    const h = runFake('tool-misuse');
    const events = await drain(h);
    await h.result;
    expect(events.some((e) => e.kind === 'suspicious')).toBe(true);
    const whitelisted = events.find(
      (e): e is ParsedEvent => e.kind === 'event' && e.payload.type === 'tool_use',
    );
    expect(whitelisted).toBeDefined();
    if (whitelisted && whitelisted.payload.type === 'tool_use') {
      expect(whitelisted.payload.tool).toBe('bash');
    }
  });

  it('slow fake + low timeout → reason=timeout', async () => {
    const h = runFake('slow', { timeoutMs: 500 });
    await drain(h);
    const res = await h.result;
    expect(res.reason).toBe('timeout');
  }, 15_000);
});
