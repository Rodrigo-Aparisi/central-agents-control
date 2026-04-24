import pino, { type Logger, type LoggerOptions } from 'pino';
import pinoPretty from 'pino-pretty';
import type { Config } from '../config';

const baseOptions = (cfg: Config): LoggerOptions => ({
  level: cfg.LOG_LEVEL,
  base: { app: 'cac-api', env: cfg.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.ANTHROPIC_API_KEY',
      '*.password',
      '*.token',
      '*.secret',
    ],
    remove: false,
    censor: '[REDACTED]',
  },
});

/** Production: return options so Fastify creates its own pino instance. */
export function buildLoggerOptions(cfg: Config): LoggerOptions {
  return baseOptions(cfg);
}

/**
 * Development: create a pino logger backed by a pino-pretty Transform stream
 * running in the main thread.  Using pino-pretty as a transport (worker thread)
 * breaks output capture under `pnpm --parallel --stream` on Windows because the
 * worker writes to its own fd 1, not the pipe that pnpm is reading from.
 */
export function buildDevLogger(cfg: Config): Logger {
  const stream = pinoPretty({ colorize: true, singleLine: false, ignore: 'pid,hostname' });
  return pino(baseOptions(cfg), stream);
}
