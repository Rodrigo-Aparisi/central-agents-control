import { eq, lt } from 'drizzle-orm';
import type { Db } from '../client';
import { isoTs } from '../lib/dates';
import { newId } from '../lib/uuid';
import {
  type RefreshTokenInsert,
  type RefreshTokenRow,
  refreshTokens,
} from '../schema/refresh-tokens';

function norm(row: RefreshTokenRow): RefreshTokenRow {
  return {
    ...row,
    expiresAt: isoTs(row.expiresAt),
    createdAt: isoTs(row.createdAt),
  };
}

export function makeRefreshTokensRepo(db: Db) {
  return {
    async insert(
      data: Omit<RefreshTokenInsert, 'id' | 'createdAt'> & { id?: string },
    ): Promise<RefreshTokenRow> {
      const id = data.id ?? newId();
      const rows = await db
        .insert(refreshTokens)
        .values({ ...data, id })
        .returning();
      const row = rows[0];
      if (!row) throw new Error('insert returned no rows');
      return norm(row);
    },

    async findByHash(hash: string): Promise<RefreshTokenRow | undefined> {
      const rows = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hash))
        .limit(1);
      return rows[0] ? norm(rows[0]) : undefined;
    },

    async deleteByHash(hash: string): Promise<void> {
      await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, hash));
    },

    async deleteByUserId(userId: string): Promise<void> {
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    },

    async deleteExpired(): Promise<void> {
      await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date().toISOString()));
    },
  };
}

export type RefreshTokensRepo = ReturnType<typeof makeRefreshTokensRepo>;
