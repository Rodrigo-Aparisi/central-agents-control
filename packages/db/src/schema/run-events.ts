import type { EventPayload } from '@cac/shared';
import { index, integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { eventTypeEnum } from './enums';
import { runs } from './runs';

export const runEvents = pgTable(
  'run_events',
  {
    id: uuid('id').primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    type: eventTypeEnum('type').notNull(),
    payload: jsonb('payload').$type<EventPayload>().notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (t) => ({
    runIdIdx: index('run_events_run_id_idx').on(t.runId),
    runSeqIdx: index('run_events_run_seq_idx').on(t.runId, t.seq),
  }),
);

export type RunEventRow = typeof runEvents.$inferSelect;
export type RunEventInsert = typeof runEvents.$inferInsert;
