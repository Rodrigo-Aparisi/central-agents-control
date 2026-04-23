import { and, asc, eq, gte } from 'drizzle-orm';
import type { Db } from '../client';
import { newId } from '../lib/uuid';
import { type RunEventInsert, type RunEventRow, runEvents } from '../schema/run-events';

export interface ListEventsOptions {
  runId: string;
  fromSeq?: number;
  limit?: number;
}

export function makeRunEventsRepo(db: Db) {
  return {
    async list({ runId, fromSeq = 0, limit }: ListEventsOptions): Promise<RunEventRow[]> {
      const where =
        fromSeq > 0
          ? and(eq(runEvents.runId, runId), gte(runEvents.seq, fromSeq))
          : eq(runEvents.runId, runId);
      const q = db.select().from(runEvents).where(where).orderBy(asc(runEvents.seq));
      return limit ? q.limit(limit) : q;
    },

    async insertMany(
      rows: Array<Omit<RunEventInsert, 'id'> & { id?: string }>,
    ): Promise<RunEventRow[]> {
      if (rows.length === 0) return [];
      const values: RunEventInsert[] = rows.map((r) => ({ ...r, id: r.id ?? newId() }));
      return db.insert(runEvents).values(values).returning();
    },
  };
}

export type RunEventsRepo = ReturnType<typeof makeRunEventsRepo>;
