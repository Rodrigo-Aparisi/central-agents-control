import closeWithGrace from 'close-with-grace';
import { buildApp } from './app';
import { loadConfig } from './config';
import { startRunsWorker } from './workers/runs';

// Use raw writes to bypass any buffering by pnpm -r --parallel. The combined
// dev output otherwise swallows early failures and all we see is the vite
// proxy complaining about ECONNREFUSED, with no hint about the real cause.
function out(msg: string): void {
  process.stdout.write(`${msg}\n`);
}
function err(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

process.on('uncaughtException', (e) => {
  err(`[api] uncaughtException: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  err(
    `[api] unhandledRejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
  );
  process.exit(1);
});

out('[api] booting…');

async function main(): Promise<void> {
  out('[api] loading config…');
  const config = loadConfig();
  out(
    `[api] config OK (host=${config.API_HOST} port=${config.API_PORT} workers=${config.ENABLE_WORKERS})`,
  );

  out('[api] building app…');
  const app = await buildApp({ config });

  let worker: ReturnType<typeof startRunsWorker> | undefined;
  if (config.ENABLE_WORKERS) {
    worker = startRunsWorker({
      config,
      db: app.db,
      io: app.io,
      redis: app.redis,
      logger: app.log.child({ component: 'worker:runs' }),
    });
  }

  closeWithGrace({ delay: 10_000 }, async ({ err: graceErr }) => {
    if (graceErr) app.log.error({ err: graceErr }, 'fatal error, shutting down');
    if (worker) await worker.close();
    await app.close();
  });

  try {
    const address = await app.listen({ host: config.API_HOST, port: config.API_PORT });
    out(`[api] listening on ${address}`);
  } catch (listenErr) {
    app.log.error({ err: listenErr }, 'failed to start listener');
    process.exit(1);
  }
}

main().catch((e) => {
  const detail = e instanceof Error ? (e.stack ?? e.message) : String(e);
  err(`\n[api] fatal during startup:\n${detail}\n`);
  process.exit(1);
});
