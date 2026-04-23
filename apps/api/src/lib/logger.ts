import type { LoggerOptions } from 'pino';
import type { Config } from '../config';

export function buildLoggerOptions(cfg: Config): LoggerOptions {
  return {
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
    ...(cfg.NODE_ENV === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, singleLine: false, ignore: 'pid,hostname' },
          },
        }
      : {}),
  };
}
