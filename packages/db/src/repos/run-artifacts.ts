import { asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { newId } from '../lib/uuid';
import { type RunArtifactInsert, type RunArtifactRow, runArtifacts } from '../schema/run-artifacts';

export function makeRunArtifactsRepo(db: Db) {
  return {
    async listByRun(runId: string): Promise<RunArtifactRow[]> {
      return db
        .select()
        .from(runArtifacts)
        .where(eq(runArtifacts.runId, runId))
        .orderBy(asc(runArtifacts.filePath));
    },

    async insertMany(
      rows: Array<Omit<RunArtifactInsert, 'id' | 'createdAt'> & { id?: string }>,
    ): Promise<RunArtifactRow[]> {
      if (rows.length === 0) return [];
      const values: RunArtifactInsert[] = rows.map((r) => ({ ...r, id: r.id ?? newId() }));
      return db.insert(runArtifacts).values(values).returning();
    },
  };
}

export type RunArtifactsRepo = ReturnType<typeof makeRunArtifactsRepo>;
