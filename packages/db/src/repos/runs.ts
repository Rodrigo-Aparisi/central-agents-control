import type { RunStatus } from '@cac/shared';
import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { newId } from '../lib/uuid';
import { type RunInsert, type RunRow, runs } from '../schema/runs';

export interface ListRunsOptions {
  projectId?: string;
  status?: RunStatus;
  cursor?: string;
  limit: number;
}

export interface DailyStatsRow {
  date: string;
  runs: number;
  completed: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface TotalsRow {
  runs: number;
  completed: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface TopProjectRow {
  projectId: string;
  runs: number;
  inputTokens: number;
  outputTokens: number;
}

export interface GraphNodeRow {
  id: string;
  parentRunId: string | null;
  status: RunStatus;
  createdAt: string;
  prompt: string;
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

    async dailyStats(since: Date, projectId?: string): Promise<DailyStatsRow[]> {
      const sinceIso = since.toISOString();
      const result = await db.execute<{
        day: string;
        runs: number;
        completed: number;
        failed: number;
        input_tokens: number;
        output_tokens: number;
        cost: number;
      }>(sql`
        SELECT
          to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS runs,
          SUM((status = 'completed')::int)::int AS completed,
          SUM((status IN ('failed','timeout','cancelled'))::int)::int AS failed,
          COALESCE(SUM(((usage ->> 'inputTokens')::bigint))::int, 0) AS input_tokens,
          COALESCE(SUM(((usage ->> 'outputTokens')::bigint))::int, 0) AS output_tokens,
          COALESCE(SUM(((usage ->> 'estimatedCostUsd')::numeric)), 0)::float AS cost
        FROM runs
        WHERE created_at >= ${sinceIso}::timestamptz
          ${projectId ? sql`AND project_id = ${projectId}::uuid` : sql``}
        GROUP BY day
        ORDER BY day ASC
      `);
      return result.map((r) => ({
        date: r.day,
        runs: r.runs,
        completed: r.completed,
        failed: r.failed,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        estimatedCostUsd: Number(r.cost ?? 0),
      }));
    },

    async totals(projectId?: string): Promise<TotalsRow> {
      const result = await db.execute<{
        runs: number;
        completed: number;
        failed: number;
        input_tokens: number;
        output_tokens: number;
        cost: number;
      }>(sql`
        SELECT
          COUNT(*)::int AS runs,
          SUM((status = 'completed')::int)::int AS completed,
          SUM((status IN ('failed','timeout','cancelled'))::int)::int AS failed,
          COALESCE(SUM(((usage ->> 'inputTokens')::bigint))::int, 0) AS input_tokens,
          COALESCE(SUM(((usage ->> 'outputTokens')::bigint))::int, 0) AS output_tokens,
          COALESCE(SUM(((usage ->> 'estimatedCostUsd')::numeric)), 0)::float AS cost
        FROM runs
        ${projectId ? sql`WHERE project_id = ${projectId}::uuid` : sql``}
      `);
      const r = result[0];
      return {
        runs: r?.runs ?? 0,
        completed: r?.completed ?? 0,
        failed: r?.failed ?? 0,
        inputTokens: r?.input_tokens ?? 0,
        outputTokens: r?.output_tokens ?? 0,
        estimatedCostUsd: Number(r?.cost ?? 0),
      };
    },

    async topProjects(limit: number): Promise<TopProjectRow[]> {
      const result = await db.execute<{
        project_id: string;
        runs: number;
        input_tokens: number;
        output_tokens: number;
      }>(sql`
        SELECT
          project_id,
          COUNT(*)::int AS runs,
          COALESCE(SUM(((usage ->> 'inputTokens')::bigint))::int, 0) AS input_tokens,
          COALESCE(SUM(((usage ->> 'outputTokens')::bigint))::int, 0) AS output_tokens
        FROM runs
        GROUP BY project_id
        ORDER BY runs DESC
        LIMIT ${limit}
      `);
      return result.map((r) => ({
        projectId: r.project_id,
        runs: r.runs,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
      }));
    },

    async graphByProject(projectId: string): Promise<GraphNodeRow[]> {
      const rows = await db
        .select({
          id: runs.id,
          parentRunId: runs.parentRunId,
          status: runs.status,
          createdAt: runs.createdAt,
          prompt: runs.prompt,
        })
        .from(runs)
        .where(eq(runs.projectId, projectId))
        .orderBy(asc(runs.createdAt));
      return rows;
    },
  };
}

export type RunsRepo = ReturnType<typeof makeRunsRepo>;
