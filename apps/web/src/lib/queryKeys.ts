export const qk = {
  all: ['cac'] as const,

  health: () => ['cac', 'health'] as const,

  projects: () => ['cac', 'projects'] as const,
  project: (id: string) => ['cac', 'projects', id] as const,
  projectRuns: (id: string) => ['cac', 'projects', id, 'runs'] as const,
  projectGit: (id: string) => ['cac', 'projects', id, 'git'] as const,

  runs: () => ['cac', 'runs'] as const,
  run: (id: string) => ['cac', 'runs', id] as const,
  runEvents: (id: string) => ['cac', 'runs', id, 'events'] as const,
  runArtifacts: (id: string) => ['cac', 'runs', id, 'artifacts'] as const,

  // admin
  adminUsers: () => ['cac', 'admin', 'users'] as const,
  adminAudit: (params?: { userId?: string }) => ['cac', 'admin', 'audit', params ?? {}] as const,

  // filesystem browser
  fsBrowse: (path?: string) => ['cac', 'fs', 'browse', path ?? null] as const,

  // Claude Code project config
  projectClaudeConfig: (id: string) => ['cac', 'projects', id, 'claude-config'] as const,
} as const;
