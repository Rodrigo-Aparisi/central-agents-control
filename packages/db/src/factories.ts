import type { EventPayload, RunParams, RunStatus, RunUsage } from '@cac/shared';
import { newId } from './lib/uuid';
import type { ProjectInsert } from './schema/projects';
import type { RunArtifactInsert } from './schema/run-artifacts';
import type { RunEventInsert } from './schema/run-events';
import type { RunInsert } from './schema/runs';

export function makeProject(overrides: Partial<ProjectInsert> = {}): ProjectInsert {
  return {
    id: newId(),
    name: 'Test Project',
    rootPath: '/tmp/projects/test',
    description: null,
    claudeConfig: null,
    metadata: null,
    ...overrides,
  };
}

const defaultParams: RunParams = {
  flags: [],
  model: 'claude-sonnet-4-6',
  timeoutMs: 1_800_000,
};

export function makeRun(projectId: string, overrides: Partial<RunInsert> = {}): RunInsert {
  return {
    id: newId(),
    projectId,
    status: 'queued' as RunStatus,
    prompt: 'hello world',
    params: defaultParams,
    usage: null,
    exitCode: null,
    durationMs: null,
    error: null,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

export function makeRunEvent(
  runId: string,
  seq: number,
  payload: EventPayload,
  overrides: Partial<RunEventInsert> = {},
): RunEventInsert {
  return {
    id: newId(),
    runId,
    seq,
    type: payload.type,
    payload,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function makeRunArtifact(
  runId: string,
  filePath: string,
  overrides: Partial<RunArtifactInsert> = {},
): RunArtifactInsert {
  return {
    id: newId(),
    runId,
    filePath,
    operation: 'modified',
    diff: null,
    contentAfter: null,
    ...overrides,
  };
}

export function emptyUsage(): RunUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    estimatedCostUsd: 0,
  };
}
