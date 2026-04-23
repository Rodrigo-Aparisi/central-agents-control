import { type CreateDbOptions, type Db, type DbHandle, createPgClient } from './client';
import { type ProjectsRepo, makeProjectsRepo } from './repos/projects';
import { type RunArtifactsRepo, makeRunArtifactsRepo } from './repos/run-artifacts';
import { type RunEventsRepo, makeRunEventsRepo } from './repos/run-events';
import { type RunsRepo, makeRunsRepo } from './repos/runs';

export * from './client';
export * from './schema/index';
export { newId } from './lib/uuid';

export interface CacDb {
  handle: DbHandle;
  db: Db;
  projects: ProjectsRepo;
  runs: RunsRepo;
  events: RunEventsRepo;
  artifacts: RunArtifactsRepo;
  transaction: Db['transaction'];
  close: () => Promise<void>;
}

export function createDb(opts: CreateDbOptions): CacDb {
  const handle = createPgClient(opts);
  const { db } = handle;
  return {
    handle,
    db,
    projects: makeProjectsRepo(db),
    runs: makeRunsRepo(db),
    events: makeRunEventsRepo(db),
    artifacts: makeRunArtifactsRepo(db),
    transaction: db.transaction.bind(db),
    close: () => handle.close(),
  };
}

export type { Db } from './client';
