import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { isoTs } from '../lib/dates';
import { newId } from '../lib/uuid';
import { type ChatMessageInsert, type ChatMessageRow, chatMessages } from '../schema/chat-messages';

function norm(row: ChatMessageRow): ChatMessageRow {
  return { ...row, createdAt: isoTs(row.createdAt) };
}

export function makeChatMessagesRepo(db: Db) {
  return {
    async listBySession(sessionId: string): Promise<ChatMessageRow[]> {
      const rows = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(asc(chatMessages.seq))
        .limit(500);
      return rows.map(norm);
    },

    async nextSeq(sessionId: string): Promise<number> {
      const result = await db
        .select({ max: sql<number>`coalesce(max(${chatMessages.seq}), -1)` })
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId));
      return (result[0]?.max ?? -1) + 1;
    },

    async insert(
      input: Omit<ChatMessageInsert, 'id' | 'createdAt'> & { id?: string },
    ): Promise<ChatMessageRow> {
      const id = input.id ?? newId();
      const rows = await db.insert(chatMessages).values({ ...input, id }).returning();
      const row = rows[0];
      if (!row) throw new Error('insert returned no rows');
      return norm(row);
    },

    async countBySession(sessionId: string): Promise<number> {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId));
      return result[0]?.count ?? 0;
    },
  };
}

export type ChatMessagesRepo = ReturnType<typeof makeChatMessagesRepo>;
