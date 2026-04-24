import { realpathSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const BooleanFromString = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const LogLevel = z
  .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
  .default('info');

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: LogLevel,

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  CLAUDE_BIN: z.string().default('claude'),
  PROJECTS_ROOT: z.string().min(1),
  RUN_TIMEOUT_MS: z.coerce.number().int().positive().default(1_800_000),
  MAX_CONCURRENT_RUNS: z.coerce.number().int().positive().default(3),

  ENABLE_WORKERS: BooleanFromString.default(true),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Auth / security
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(900), // 15 min in seconds
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
  ALLOWED_ORIGINS: z.string().default(''), // comma-separated list
  RATE_LIMIT_ENABLED: BooleanFromString.default(true),
  AUTH_ENABLED: BooleanFromString.default(true), // false = skip auth (dev convenience)
});

export type Config = z.infer<typeof ConfigSchema> & {
  resolvedProjectsRoot: string;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Invalid API configuration:\n  ${issues}`);
  }

  const cfg = parsed.data;

  const absProjectsRoot = path.isAbsolute(cfg.PROJECTS_ROOT)
    ? cfg.PROJECTS_ROOT
    : path.resolve(cfg.PROJECTS_ROOT);

  let resolvedProjectsRoot: string;
  try {
    resolvedProjectsRoot = realpathSync(absProjectsRoot);
  } catch {
    throw new Error(
      `PROJECTS_ROOT does not exist on disk: ${absProjectsRoot}. Create the directory or point PROJECTS_ROOT to an existing path.`,
    );
  }

  return { ...cfg, resolvedProjectsRoot };
}
