import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface CreateDbOptions {
  url: string;
  max?: number;
  idleTimeoutSec?: number;
  connectTimeoutSec?: number;
}

export interface DbHandle {
  db: Db;
  sql: ReturnType<typeof postgres>;
  close: () => Promise<void>;
}

export function createPgClient(opts: CreateDbOptions): DbHandle {
  const sql = postgres(opts.url, {
    max: opts.max ?? 10,
    idle_timeout: opts.idleTimeoutSec ?? 30,
    connect_timeout: opts.connectTimeoutSec ?? 10,
    prepare: false,
  });
  const db = drizzle(sql, { schema, casing: 'snake_case' });
  return {
    db,
    sql,
    close: () => sql.end({ timeout: 5 }),
  };
}
