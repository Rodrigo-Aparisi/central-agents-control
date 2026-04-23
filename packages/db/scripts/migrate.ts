import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, '..', 'migrations');

const sql = postgres(url, { max: 1, prepare: false });
const db = drizzle(sql);

try {
  console.log(`Running migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied');
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
