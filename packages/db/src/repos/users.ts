import { desc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { isoTs, isoTsNullable } from '../lib/dates';
import { newId } from '../lib/uuid';
import { type UserInsert, type UserRow, users } from '../schema/users';

function norm(row: UserRow): UserRow {
  return {
    ...row,
    createdAt: isoTs(row.createdAt),
    lastLoginAt: isoTsNullable(row.lastLoginAt),
  };
}

export function makeUsersRepo(db: Db) {
  return {
    async findById(id: string): Promise<UserRow | undefined> {
      const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return rows[0] ? norm(rows[0]) : undefined;
    },

    async findByEmail(email: string): Promise<UserRow | undefined> {
      const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return rows[0] ? norm(rows[0]) : undefined;
    },

    async insert(data: Omit<UserInsert, 'id' | 'createdAt'> & { id?: string }): Promise<UserRow> {
      const id = data.id ?? newId();
      const rows = await db
        .insert(users)
        .values({ ...data, id })
        .returning();
      const row = rows[0];
      if (!row) throw new Error('insert returned no rows');
      return norm(row);
    },

    async update(
      id: string,
      data: Partial<Pick<UserInsert, 'role' | 'lastLoginAt'>>,
    ): Promise<UserRow | undefined> {
      const rows = await db.update(users).set(data).where(eq(users.id, id)).returning();
      return rows[0] ? norm(rows[0]) : undefined;
    },

    async delete(id: string): Promise<void> {
      await db.delete(users).where(eq(users.id, id));
    },

    async list(): Promise<UserRow[]> {
      const rows = await db.select().from(users).orderBy(desc(users.createdAt));
      return rows.map(norm);
    },
  };
}

export type UsersRepo = ReturnType<typeof makeUsersRepo>;
