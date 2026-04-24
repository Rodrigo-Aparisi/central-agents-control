import { z } from 'zod';
import { ArtifactOperation, ProjectClaudeConfig, RunParams, RunStatus, RunUsage } from './run';

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
  gitUrl: z.string().url().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = CreateProjectInput.partial().extend({
  claudeConfig: ProjectClaudeConfig.nullable().optional(),
});
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

// Git
export const GitUserConfig = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
});
export type GitUserConfig = z.infer<typeof GitUserConfig>;

export const GitRemote = z.object({
  name: z.string(),
  url: z.string(),
});
export type GitRemote = z.infer<typeof GitRemote>;

export const GitFileStatus = z.object({
  path: z.string(),
  index: z.string(),
  working: z.string(),
});
export type GitFileStatus = z.infer<typeof GitFileStatus>;

export const GitBranch = z.object({
  name: z.string(),
  current: z.boolean(),
  remote: z.boolean(),
  commit: z.string(),
  label: z.string(),
});
export type GitBranch = z.infer<typeof GitBranch>;

export const GitLastCommit = z.object({
  hash: z.string(),
  message: z.string(),
  author: z.string(),
  date: z.string(),
});
export type GitLastCommit = z.infer<typeof GitLastCommit>;

export const GitInfoResponse = z.object({
  isRepo: z.boolean(),
  branch: z.string().nullable(),
  remotes: z.array(GitRemote),
  user: GitUserConfig,
  status: z.array(GitFileStatus),
  lastCommit: GitLastCommit.nullable(),
  branches: z.array(GitBranch),
  ahead: z.number().int(),
  behind: z.number().int(),
});
export type GitInfoResponse = z.infer<typeof GitInfoResponse>;

export const GitPullResponse = z.object({
  summary: z.string(),
  filesChanged: z.number().int(),
});
export type GitPullResponse = z.infer<typeof GitPullResponse>;

export const GitCheckoutInput = z.object({
  branch: z.string().trim().min(1).max(255),
});
export type GitCheckoutInput = z.infer<typeof GitCheckoutInput>;

export const GitCheckoutResponse = z.object({
  branch: z.string(),
});
export type GitCheckoutResponse = z.infer<typeof GitCheckoutResponse>;

// Filesystem browse
export const DirEntry = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['directory', 'drive']),
});
export type DirEntry = z.infer<typeof DirEntry>;

export const FsBrowseResponse = z.object({
  path: z.string(),
  parent: z.string().nullable(),
  entries: z.array(DirEntry),
});
export type FsBrowseResponse = z.infer<typeof FsBrowseResponse>;

export const FsMkdirInput = z.object({
  parentPath: z.string().min(1).max(4096),
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[^<>:"/\\|?*\x00-\x1f]+$/, 'Nombre de carpeta no válido'),
});
export type FsMkdirInput = z.infer<typeof FsMkdirInput>;

export const FsMkdirResponse = z.object({
  path: z.string(),
});
export type FsMkdirResponse = z.infer<typeof FsMkdirResponse>;

// Auth
export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(1024),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const AuthTokensResponse = z.object({
  accessToken: z.string(),
  userId: UuidV7,
  role: z.enum(['admin', 'viewer']),
  expiresIn: z.number().int(), // seconds
});
export type AuthTokensResponse = z.infer<typeof AuthTokensResponse>;

export const UserRow = z.object({
  id: UuidV7,
  email: z.string().email(),
  role: z.enum(['admin', 'viewer']),
  createdAt: z.string().datetime({ offset: true }),
  lastLoginAt: z.string().datetime({ offset: true }).nullable(),
});
export type UserRow = z.infer<typeof UserRow>;

export const CreateUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(1024),
  role: z.enum(['admin', 'viewer']).default('viewer'),
});
export type CreateUserInput = z.infer<typeof CreateUserInput>;

export const UpdateUserInput = z.object({
  role: z.enum(['admin', 'viewer']),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;

export const AuditEventRow = z.object({
  id: UuidV7,
  userId: UuidV7.nullable(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().nullable(),
  detail: z.string().nullable(),
  ip: z.string().nullable(),
  timestamp: z.string().datetime({ offset: true }),
});
export type AuditEventRow = z.infer<typeof AuditEventRow>;
