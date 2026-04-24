import { asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { isoTs } from '../lib/dates';
import { newId } from '../lib/uuid';
import { type RunArtifactInsert, type RunArtifactRow, runArtifacts } from '../schema/run-artifacts';

function norm(row: RunArtifactRow): RunArtifactRow {
  return { ...row, createdAt: isoTs(row.createdAt) };
}

export function makeRunArtifactsRepo(db: Db) {
  return {
    async listByRun(runId: string): Promise<RunArtifactRow[]> {
      const rows = await db
        .select()
        .from(runArtifacts)
        .where(eq(runArtifacts.runId, runId))
        .orderBy(asc(runArtifacts.filePath));
      return rows.map(norm);
    },

    async insertMany(
      rows: Array<Omit<RunArtifactInsert, 'id' | 'createdAt'> & { id?: string }>,
    ): Promise<RunArtifactRow[]> {
      if (rows.length === 0) return [];
      const values: RunArtifactInsert[] = rows.map((r) => ({ ...r, id: r.id ?? newId() }));
      const inserted = await db.insert(runArtifacts).values(values).returning();
      return inserted.map(norm);
    },
  };
}

export type RunArtifactsRepo = ReturnType<typeof makeRunArtifactsRepo>;
