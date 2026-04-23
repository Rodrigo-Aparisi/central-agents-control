import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { artifactOperationEnum } from './enums';
import { runs } from './runs';

export const runArtifacts = pgTable(
  'run_artifacts',
  {
    id: uuid('id').primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    filePath: text('file_path').notNull(),
    operation: artifactOperationEnum('operation').notNull(),
    diff: text('diff'),
    contentAfter: text('content_after'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    runIdIdx: index('run_artifacts_run_id_idx').on(t.runId),
    runPathIdx: index('run_artifacts_run_path_idx').on(t.runId, t.filePath),
  }),
);

export type RunArtifactRow = typeof runArtifacts.$inferSelect;
export type RunArtifactInsert = typeof runArtifacts.$inferInsert;
