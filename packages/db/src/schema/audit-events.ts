import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    resource: text('resource').notNull(),
    resourceId: text('resource_id'),
    detail: text('detail'),
    ip: text('ip'),
    timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    userIdIdx: index('audit_events_user_id_idx').on(t.userId),
    actionIdx: index('audit_events_action_idx').on(t.action),
    resourceIdx: index('audit_events_resource_idx').on(t.resource),
    timestampIdx: index('audit_events_timestamp_idx').on(t.timestamp),
  }),
);

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type AuditEventInsert = typeof auditEvents.$inferInsert;
