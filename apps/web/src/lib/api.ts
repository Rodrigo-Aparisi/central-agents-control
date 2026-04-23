import type {
  ApiErrorBody,
  Artifact,
  CreateProjectInput,
  HealthResponse,
  LaunchRunInput,
  LaunchRunResponse,
  Project,
  Run,
  RunEvent,
  RunStatus,
  UpdateProjectInput,
} from '@cac/shared';

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
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, init);
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

    events: (id: string, params?: { fromSeq?: number; limit?: number }) =>
      request<{ items: RunEvent[]; nextFromSeq: number | null }>(
        'GET',
        buildQuery(`/v1/runs/${id}/events`, params),
      ),
    artifacts: (id: string) => request<{ items: Artifact[] }>('GET', `/v1/runs/${id}/artifacts`),
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
