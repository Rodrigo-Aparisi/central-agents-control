import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => ({
    emailIdx: index('users_email_idx').on(t.email),
    roleIdx: index('users_role_idx').on(t.role),
    createdAtIdx: index('users_created_at_idx').on(t.createdAt),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
