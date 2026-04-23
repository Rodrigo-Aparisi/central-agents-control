import type { ProjectClaudeConfig } from '@cac/shared';
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    rootPath: text('root_path').notNull(),
    description: text('description'),
    claudeConfig: jsonb('claude_config').$type<ProjectClaudeConfig>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    createdAtIdx: index('projects_created_at_idx').on(t.createdAt),
  }),
);

export type ProjectRow = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
