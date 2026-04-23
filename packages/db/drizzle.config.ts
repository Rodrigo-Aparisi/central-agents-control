import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? 'postgres://cac:cac@localhost:5432/cac';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
