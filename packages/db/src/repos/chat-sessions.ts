import { desc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { isoTs } from '../lib/dates';
import { newId } from '../lib/uuid';
import { type ChatSessionInsert, type ChatSessionRow, chatSessions } from '../schema/chat-sessions';

function norm(row: ChatSessionRow): ChatSessionRow {
  return { ...row, createdAt: isoTs(row.createdAt), updatedAt: isoTs(row.updatedAt) };
}

export function makeChatSessionsRepo(db: Db) {
  return {
    async findById(id: string): Promise<ChatSessionRow | null> {
      const rows = await db.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1);
      return rows[0] ? norm(rows[0]) : null;
    },

    async listByProject(projectId: string): Promise<ChatSessionRow[]> {
      const rows = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.projectId, projectId))
        .orderBy(desc(chatSessions.updatedAt))
        .limit(100);
      return rows.map(norm);
    },

    async insert(
      input: Omit<ChatSessionInsert, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    ): Promise<ChatSessionRow> {
      const id = input.id ?? newId();
      const rows = await db.insert(chatSessions).values({ ...input, id }).returning();
      const row = rows[0];
      if (!row) throw new Error('insert returned no rows');
      return norm(row);
    },

    async updateTitle(id: string, title: string): Promise<ChatSessionRow | null> {
      const rows = await db
        .update(chatSessions)
        .set({ title, updatedAt: new Date().toISOString() })
        .where(eq(chatSessions.id, id))
        .returning();
      return rows[0] ? norm(rows[0]) : null;
    },

    async touch(id: string): Promise<void> {
      await db
        .update(chatSessions)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(chatSessions.id, id));
    },

    async delete(id: string): Promise<boolean> {
      const rows = await db
        .delete(chatSessions)
        .where(eq(chatSessions.id, id))
        .returning({ id: chatSessions.id });
      return rows.length > 0;
    },
  };
}

export type ChatSessionsRepo = ReturnType<typeof makeChatSessionsRepo>;
