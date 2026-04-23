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
