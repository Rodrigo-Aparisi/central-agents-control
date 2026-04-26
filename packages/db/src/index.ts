import { sql } from 'drizzle-orm';
import { type CreateDbOptions, type Db, type DbHandle, createPgClient } from './client';
import { type AuditEventsRepo, makeAuditEventsRepo } from './repos/audit-events';
import { type ChatMessagesRepo, makeChatMessagesRepo } from './repos/chat-messages';
import { type ChatSessionsRepo, makeChatSessionsRepo } from './repos/chat-sessions';
import { type ProjectsRepo, makeProjectsRepo } from './repos/projects';
import { type RefreshTokensRepo, makeRefreshTokensRepo } from './repos/refresh-tokens';
import { type RunArtifactsRepo, makeRunArtifactsRepo } from './repos/run-artifacts';
import { type RunEventsRepo, makeRunEventsRepo } from './repos/run-events';
import { type RunsRepo, makeRunsRepo } from './repos/runs';
import { type UsersRepo, makeUsersRepo } from './repos/users';

export * from './client';
export * from './schema/index';
export { newId } from './lib/uuid';
export type {
  DailyStatsRow,
  GraphNodeRow,
  ListRunsOptions,
  TopProjectRow,
  TotalsRow,
} from './repos/runs';
export type { ListAuditEventsOptions } from './repos/audit-events';

export interface CacDb {
  handle: DbHandle;
  db: Db;
  projects: ProjectsRepo;
  runs: RunsRepo;
  events: RunEventsRepo;
  artifacts: RunArtifactsRepo;
  users: UsersRepo;
  refreshTokens: RefreshTokensRepo;
  auditEvents: AuditEventsRepo;
  chatSessions: ChatSessionsRepo;
  chatMessages: ChatMessagesRepo;
  transaction: Db['transaction'];
  ping: () => Promise<boolean>;
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
    users: makeUsersRepo(db),
    refreshTokens: makeRefreshTokensRepo(db),
    auditEvents: makeAuditEventsRepo(db),
    chatSessions: makeChatSessionsRepo(db),
    chatMessages: makeChatMessagesRepo(db),
    transaction: db.transaction.bind(db),
    ping: async () => {
      await db.execute(sql`select 1`);
      return true;
    },
    close: () => handle.close(),
  };
}

export type { Db } from './client';
