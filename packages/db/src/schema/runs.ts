import type { RunParams, RunUsage } from '@cac/shared';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { runStatusEnum } from './enums';
import { projects } from './projects';

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    parentRunId: uuid('parent_run_id').references((): AnyPgColumn => runs.id, {
      onDelete: 'set null',
    }),
    status: runStatusEnum('status').notNull().default('queued'),
    prompt: text('prompt').notNull(),
    params: jsonb('params').$type<RunParams>(),
    usage: jsonb('usage').$type<RunUsage>(),
    exitCode: integer('exit_code'),
    durationMs: integer('duration_ms'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => ({
    projectIdIdx: index('runs_project_id_idx').on(t.projectId),
    parentRunIdx: index('runs_parent_run_idx').on(t.parentRunId),
    statusIdx: index('runs_status_idx').on(t.status),
    createdAtIdx: index('runs_created_at_idx').on(t.createdAt),
    projectCreatedIdx: index('runs_project_created_idx').on(t.projectId, t.createdAt),
  }),
);

export type RunRow = typeof runs.$inferSelect;
export type RunInsert = typeof runs.$inferInsert;
