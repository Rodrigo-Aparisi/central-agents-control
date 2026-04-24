import { and, desc, eq, lt } from 'drizzle-orm';
import type { Db } from '../client';
import { isoTs } from '../lib/dates';
import { newId } from '../lib/uuid';
import { type AuditEventInsert, type AuditEventRow, auditEvents } from '../schema/audit-events';

function norm(row: AuditEventRow): AuditEventRow {
  return { ...row, timestamp: isoTs(row.timestamp) };
}

export interface ListAuditEventsOptions {
  userId?: string;
  limit?: number;
  cursor?: string;
}

export function makeAuditEventsRepo(db: Db) {
  return {
    async insert(
      data: Omit<AuditEventInsert, 'id' | 'timestamp'> & { id?: string },
    ): Promise<AuditEventRow> {
      const id = data.id ?? newId();
      const rows = await db
        .insert(auditEvents)
        .values({ ...data, id })
        .returning();
      const row = rows[0];
      if (!row) throw new Error('insert returned no rows');
      return norm(row);
    },

    async list({
      userId,
      limit = 50,
      cursor,
    }: ListAuditEventsOptions): Promise<{ items: AuditEventRow[]; nextCursor: string | null }> {
      // Build filter conditions. Cursor pages by UUID v7 (time-ordered), descending.
      const userFilter = userId ? eq(auditEvents.userId, userId) : undefined;
      const cursorFilter = cursor ? lt(auditEvents.id, cursor) : undefined;

      const where =
        userFilter && cursorFilter ? and(userFilter, cursorFilter) : (userFilter ?? cursorFilter);

      const rows = await db
        .select()
        .from(auditEvents)
        .where(where)
        .orderBy(desc(auditEvents.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore && lastItem ? lastItem.id : null;

      return { items: items.map(norm), nextCursor };
    },
  };
}

export type AuditEventsRepo = ReturnType<typeof makeAuditEventsRepo>;
