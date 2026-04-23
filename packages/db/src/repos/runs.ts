import type { RunStatus } from '@cac/shared';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { Db } from '../client';
import { newId } from '../lib/uuid';
import { type RunInsert, type RunRow, runs } from '../schema/runs';

export interface ListRunsOptions {
  projectId?: string;
  status?: RunStatus;
  cursor?: string;
  limit: number;
}

export function makeRunsRepo(db: Db) {
  return {
    async findById(id: string): Promise<RunRow | null> {
      const rows = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
      return rows[0] ?? null;
    },

    async list({ projectId, status, cursor, limit }: ListRunsOptions): Promise<RunRow[]> {
      const filters = [];
      if (projectId) filters.push(eq(runs.projectId, projectId));
      if (status) filters.push(eq(runs.status, status));
      if (cursor) filters.push(lt(runs.id, cursor));
      const where = filters.length ? and(...filters) : undefined;
      return db.select().from(runs).where(where).orderBy(desc(runs.id)).limit(limit);
    },

    async insert(input: Omit<RunInsert, 'id' | 'createdAt'> & { id?: string }): Promise<RunRow> {
      const id = input.id ?? newId();
      const rows = await db
        .insert(runs)
        .values({ ...input, id })
        .returning();
      const row = rows[0];
      if (!row) throw new Error('insert returned no rows');
      return row;
    },

    async update(id: string, patch: Partial<RunInsert>): Promise<RunRow | null> {
      const rows = await db.update(runs).set(patch).where(eq(runs.id, id)).returning();
      return rows[0] ?? null;
    },

    async markStarted(id: string): Promise<RunRow | null> {
      return this.update(id, { status: 'running', startedAt: new Date().toISOString() });
    },

    async markFinished(id: string, patch: Partial<RunInsert>): Promise<RunRow | null> {
      return this.update(id, { ...patch, finishedAt: new Date().toISOString() });
    },
  };
}

export type RunsRepo = ReturnType<typeof makeRunsRepo>;
