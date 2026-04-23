export const qk = {
  all: ['cac'] as const,

  health: () => ['cac', 'health'] as const,

  projects: () => ['cac', 'projects'] as const,
  project: (id: string) => ['cac', 'projects', id] as const,
  projectRuns: (id: string) => ['cac', 'projects', id, 'runs'] as const,

  runs: () => ['cac', 'runs'] as const,
  run: (id: string) => ['cac', 'runs', id] as const,
  runEvents: (id: string) => ['cac', 'runs', id, 'events'] as const,
  runArtifacts: (id: string) => ['cac', 'runs', id, 'artifacts'] as const,
} as const;
