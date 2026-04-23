import { z } from 'zod';

export const RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'cancelled',
  'failed',
  'timeout',
] as const;
export const RunStatus = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatus>;

export const RunExitReason = z.enum(['completed', 'cancelled', 'timeout', 'crashed']);
export type RunExitReason = z.infer<typeof RunExitReason>;

export const RunParams = z.object({
  flags: z.array(z.string()).default([]),
  model: z.string().min(1).default('claude-sonnet-4-6'),
  timeoutMs: z.number().int().positive().default(1_800_000),
});
export type RunParams = z.infer<typeof RunParams>;

export const RunUsage = z.object({
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  cacheReadTokens: z.number().int().nonnegative().default(0),
  cacheWriteTokens: z.number().int().nonnegative().default(0),
  estimatedCostUsd: z.number().nonnegative().default(0),
});
export type RunUsage = z.infer<typeof RunUsage>;

export const ProjectClaudeConfig = z.object({
  timeoutMs: z.number().int().positive().optional(),
  allowedFlags: z.array(z.string()).optional(),
  model: z.string().optional(),
});
export type ProjectClaudeConfig = z.infer<typeof ProjectClaudeConfig>;

export const ArtifactOperation = z.enum(['created', 'modified', 'deleted']);
export type ArtifactOperation = z.infer<typeof ArtifactOperation>;
