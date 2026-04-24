import { desc, eq, lt } from 'drizzle-orm';
import type { Db } from '../client';
import { isoTs } from '../lib/dates';
import { newId } from '../lib/uuid';
import { type ProjectInsert, type ProjectRow, projects } from '../schema/projects';

function norm(row: ProjectRow): ProjectRow {
  return { ...row, createdAt: isoTs(row.createdAt), updatedAt: isoTs(row.updatedAt) };
}

export interface ListOptions {
  cursor?: string;
  limit: number;
}

export function makeProjectsRepo(db: Db) {
  return {
    async findById(id: string): Promise<ProjectRow | null> {
      const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
      return rows[0] ? norm(rows[0]) : null;
    },

    async list({ cursor, limit }: ListOptions): Promise<ProjectRow[]> {
      const where = cursor ? lt(projects.id, cursor) : undefined;
      const rows = await db
        .select()
        .from(projects)
        .where(where)
        .orderBy(desc(projects.id))
        .limit(limit);
      return rows.map(norm);
    },

    async insert(
      input: Omit<ProjectInsert, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    ): Promise<ProjectRow> {
      const id = input.id ?? newId();
      const rows = await db
        .insert(projects)
        .values({ ...input, id })
        .returning();
      const row = rows[0];
      if (!row) throw new Error('insert returned no rows');
      return norm(row);
    },

    async update(id: string, patch: Partial<ProjectInsert>): Promise<ProjectRow | null> {
      const rows = await db
        .update(projects)
        .set({ ...patch, updatedAt: new Date().toISOString() })
        .where(eq(projects.id, id))
        .returning();
      return rows[0] ? norm(rows[0]) : null;
    },

    async delete(id: string): Promise<boolean> {
      const rows = await db
        .delete(projects)
        .where(eq(projects.id, id))
        .returning({ id: projects.id });
      return rows.length > 0;
    },
  };
}

export type ProjectsRepo = ReturnType<typeof makeProjectsRepo>;
