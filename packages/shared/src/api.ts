import { z } from 'zod';
import { ArtifactOperation, RunParams, RunStatus, RunUsage } from './run';

export const UuidV7 = z.string().uuid();
export type UuidV7 = z.infer<typeof UuidV7>;

export const CursorPagination = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type CursorPagination = z.infer<typeof CursorPagination>;

export const CreateProjectInput = z.object({
  name: z.string().trim().min(1).max(120),
  rootPath: z.string().trim().min(1).max(4096),
  description: z.string().max(2000).optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = CreateProjectInput.partial();
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;

export const Project = z.object({
  id: UuidV7,
  name: z.string(),
  rootPath: z.string(),
  description: z.string().nullable(),
  claudeConfig: z.record(z.unknown()).nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type Project = z.infer<typeof Project>;

export const LaunchRunInput = z.object({
  prompt: z.string().min(1).max(50_000),
  params: RunParams.partial().optional(),
});
export type LaunchRunInput = z.infer<typeof LaunchRunInput>;

export const LaunchRunResponse = z.object({
  runId: UuidV7,
});
export type LaunchRunResponse = z.infer<typeof LaunchRunResponse>;

export const Run = z.object({
  id: UuidV7,
  projectId: UuidV7,
  parentRunId: UuidV7.nullable(),
  status: RunStatus,
  prompt: z.string(),
  params: RunParams,
  usage: RunUsage.nullable(),
  exitCode: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  startedAt: z.string().datetime({ offset: true }).nullable(),
  finishedAt: z.string().datetime({ offset: true }).nullable(),
});
export type Run = z.infer<typeof Run>;

export const Artifact = z.object({
  id: UuidV7,
  runId: UuidV7,
  filePath: z.string(),
  operation: ArtifactOperation,
  diff: z.string().nullable(),
  contentAfter: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export type Artifact = z.infer<typeof Artifact>;

export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  db: z.enum(['ok', 'error']),
  redis: z.enum(['ok', 'error']),
  timestamp: z.string().datetime({ offset: true }),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const StatsDailyPoint = z.object({
  date: z.string(),
  runs: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
});
export type StatsDailyPoint = z.infer<typeof StatsDailyPoint>;

export const ProjectStatsResponse = z.object({
  projectId: UuidV7,
  days: z.array(StatsDailyPoint),
  totals: z.object({
    runs: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
  }),
});
export type ProjectStatsResponse = z.infer<typeof ProjectStatsResponse>;

export const GlobalStatsResponse = z.object({
  days: z.array(StatsDailyPoint),
  totals: z.object({
    runs: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
  }),
  topProjects: z.array(
    z.object({
      projectId: UuidV7,
      name: z.string(),
      runs: z.number().int().nonnegative(),
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    }),
  ),
});
export type GlobalStatsResponse = z.infer<typeof GlobalStatsResponse>;

export const RunGraphNode = z.object({
  id: UuidV7,
  parentRunId: UuidV7.nullable(),
  status: RunStatus,
  createdAt: z.string().datetime({ offset: true }),
  prompt: z.string(),
});
export type RunGraphNode = z.infer<typeof RunGraphNode>;

export const RunGraphResponse = z.object({
  nodes: z.array(RunGraphNode),
  edges: z.array(z.object({ from: UuidV7, to: UuidV7 })),
});
export type RunGraphResponse = z.infer<typeof RunGraphResponse>;

export const FileEntry = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number().int().nonnegative().optional(),
});
export type FileEntry = z.infer<typeof FileEntry>;

export const ListFilesResponse = z.object({
  path: z.string(),
  entries: z.array(FileEntry),
});
export type ListFilesResponse = z.infer<typeof ListFilesResponse>;

export const FileContentResponse = z.object({
  path: z.string(),
  size: z.number().int().nonnegative(),
  content: z.string(),
  truncated: z.boolean(),
});
export type FileContentResponse = z.infer<typeof FileContentResponse>;

export const ExportFormat = z.enum(['json', 'markdown']);
export type ExportFormat = z.infer<typeof ExportFormat>;
