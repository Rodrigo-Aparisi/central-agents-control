import { useAuthStore } from '@/stores/auth';
import type {
  ApiErrorBody,
  Artifact,
  AuditEventRow,
  AuthTokensResponse,
  CreateProjectInput,
  CreateUserInput,
  DirEntry,
  ExportFormat,
  FsMkdirInput,
  FsMkdirResponse,
  FileContentResponse,
  FsBrowseResponse,
  GitBranch,
  GitCheckoutInput,
  GitCheckoutResponse,
  GitInfoResponse,
  GitPullResponse,
  GlobalStatsResponse,
  HealthResponse,
  LaunchRunInput,
  LaunchRunResponse,
  ListFilesResponse,
  LoginInput,
  Project,
  ProjectStatsResponse,
  Run,
  RunEvent,
  RunGraphResponse,
  RunStatus,
  UpdateProjectInput,
  UpdateUserInput,
  UserRow,
} from '@cac/shared';

// Re-export types that consumers may need
export type { DirEntry, FsBrowseResponse, GitBranch, GitInfoResponse, GitPullResponse };

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody['error'];

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';

  const token = useAuthStore.getState().accessToken;
  if (token) headers.authorization = `Bearer ${token}`;

  const init: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, init);

  if (res.status === 401) {
    useAuthStore.getState().clearAuth();
    // Don't redirect when already at /login — just throw so the caller can handle it.
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
      return new Promise<never>(() => {});
    }
    throw new ApiError(401, { code: 'UNAUTHORIZED' as const, message: 'Unauthorized' });
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const parsed = text.length > 0 ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const envelope = parsed as ApiErrorBody | undefined;
    const errBody = envelope?.error ?? {
      code: 'INTERNAL' as const,
      message: res.statusText || 'Request failed',
    };
    throw new ApiError(res.status, errBody);
  }

  return parsed as T;
}

export const api = {
  // health
  health: () => request<HealthResponse>('GET', '/v1/health'),

  // auth
  auth: {
    login: (input: LoginInput) => request<AuthTokensResponse>('POST', '/v1/auth/login', input),
    refresh: () => request<AuthTokensResponse>('POST', '/v1/auth/refresh'),
    logout: () => request<void>('POST', '/v1/auth/logout'),
  },

  // admin
  admin: {
    users: {
      list: () => request<{ items: UserRow[] }>('GET', '/v1/admin/users'),
      create: (input: CreateUserInput) => request<UserRow>('POST', '/v1/admin/users', input),
      updateRole: (id: string, input: UpdateUserInput) =>
        request<UserRow>('PUT', `/v1/admin/users/${id}`, input),
      delete: (id: string) => request<void>('DELETE', `/v1/admin/users/${id}`),
    },
    audit: {
      list: (params?: { userId?: string; cursor?: string; limit?: number }) =>
        request<{ items: AuditEventRow[]; nextCursor: string | null }>(
          'GET',
          buildQuery('/v1/admin/audit', params),
        ),
    },
  },

  // projects
  projects: {
    list: (params?: { cursor?: string; limit?: number }) =>
      request<{ items: Project[]; nextCursor: string | null }>(
        'GET',
        buildQuery('/v1/projects', params),
      ),
    get: (id: string) => request<Project>('GET', `/v1/projects/${id}`),
    create: (input: CreateProjectInput) => request<Project>('POST', '/v1/projects', input),
    update: (id: string, input: UpdateProjectInput) =>
      request<Project>('PUT', `/v1/projects/${id}`, input),
    delete: (id: string) => request<void>('DELETE', `/v1/projects/${id}`),
    openFolder: (id: string) => request<void>('POST', `/v1/projects/${id}/open-folder`),
  },

  // runs
  runs: {
    list: (params?: { projectId?: string; status?: RunStatus; cursor?: string; limit?: number }) =>
      request<{ items: Run[]; nextCursor: string | null }>('GET', buildQuery('/v1/runs', params)),
    get: (id: string) => request<Run>('GET', `/v1/runs/${id}`),
    byProject: (projectId: string, params?: { cursor?: string; limit?: number }) =>
      request<{ items: Run[]; nextCursor: string | null }>(
        'GET',
        buildQuery(`/v1/projects/${projectId}/runs`, params),
      ),
    launch: (projectId: string, input: LaunchRunInput) =>
      request<LaunchRunResponse>('POST', `/v1/projects/${projectId}/launch`, input),
    cancel: (id: string) => request<Run>('POST', `/v1/runs/${id}/cancel`),
    rerun: (id: string, input?: { prompt?: string }) =>
      request<LaunchRunResponse>('POST', `/v1/runs/${id}/rerun`, input ?? {}),

    events: (id: string, params?: { fromSeq?: number; limit?: number }) =>
      request<{ items: RunEvent[]; nextFromSeq: number | null }>(
        'GET',
        buildQuery(`/v1/runs/${id}/events`, params),
      ),
    artifacts: (id: string) => request<{ items: Artifact[] }>('GET', `/v1/runs/${id}/artifacts`),
    exportUrl: (id: string, format: ExportFormat) =>
      `${BASE_URL}/v1/runs/${id}/export?format=${format}`,
  },

  // stats
  stats: {
    global: (params?: { days?: number }) =>
      request<GlobalStatsResponse>('GET', buildQuery('/v1/stats/global', params)),
    byProject: (projectId: string, params?: { days?: number }) =>
      request<ProjectStatsResponse>('GET', buildQuery(`/v1/stats/projects/${projectId}`, params)),
  },

  // run graph (backend only in 6a; xyflow viz in 6b)
  runGraph: (projectId: string) =>
    request<RunGraphResponse>('GET', `/v1/projects/${projectId}/run-graph`),

  // files (backend only in 6a; Monaco UI in 6b)
  files: {
    list: (projectId: string, path?: string) =>
      request<ListFilesResponse>(
        'GET',
        buildQuery(`/v1/projects/${projectId}/files`, path ? { path } : undefined),
      ),
    content: (projectId: string, path: string) =>
      request<FileContentResponse>(
        'GET',
        buildQuery(`/v1/projects/${projectId}/files/content`, { path }),
      ),
  },

  // git
  git: {
    info: (projectId: string) =>
      request<GitInfoResponse>('GET', `/v1/projects/${projectId}/git`),
    branches: (projectId: string) =>
      request<{ branches: GitBranch[] }>('GET', `/v1/projects/${projectId}/git/branches`),
    pull: (projectId: string) =>
      request<GitPullResponse>('POST', `/v1/projects/${projectId}/git/pull`),
    fetch: (projectId: string) =>
      request<{ ok: boolean }>('POST', `/v1/projects/${projectId}/git/fetch`),
    checkout: (projectId: string, input: GitCheckoutInput) =>
      request<GitCheckoutResponse>('POST', `/v1/projects/${projectId}/git/checkout`, input),
  },

  // filesystem browser
  fs: {
    browse: (path?: string) =>
      request<FsBrowseResponse>('GET', buildQuery('/v1/fs/browse', path ? { path } : undefined)),
    mkdir: (input: FsMkdirInput) => request<FsMkdirResponse>('POST', '/v1/fs/mkdir', input),
  },
};

function buildQuery(path: string, params?: Record<string, unknown>): string {
  if (!params) return path;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s.length > 0 ? `${path}?${s}` : path;
}
