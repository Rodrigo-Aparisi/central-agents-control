import type { RunArtifactRow, RunEventRow, RunRow } from '@cac/db';
import type { ProjectRow } from '@cac/db';
import type { Artifact, Project, Run, RunEvent, RunParams, RunUsage } from '@cac/shared';

const DEFAULT_PARAMS: RunParams = {
  flags: [],
  model: 'claude-sonnet-4-6',
  timeoutMs: 1_800_000,
};

export function projectToApi(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    rootPath: row.rootPath,
    description: row.description,
    claudeConfig: (row.claudeConfig ?? null) as Project['claudeConfig'],
    metadata: (row.metadata ?? null) as Project['metadata'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function runToApi(row: RunRow): Run {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    prompt: row.prompt,
    params: (row.params ?? DEFAULT_PARAMS) as RunParams,
    usage: (row.usage ?? null) as RunUsage | null,
    exitCode: row.exitCode,
    durationMs: row.durationMs,
    error: row.error,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

export function eventToApi(row: RunEventRow): RunEvent {
  return {
    id: row.id,
    runId: row.runId,
    seq: row.seq,
    type: row.type,
    payload: row.payload,
    timestamp: row.timestamp,
  };
}

export function artifactToApi(row: RunArtifactRow): Artifact {
  return {
    id: row.id,
    runId: row.runId,
    filePath: row.filePath,
    operation: row.operation,
    diff: row.diff,
    contentAfter: row.contentAfter,
    createdAt: row.createdAt,
  };
}
