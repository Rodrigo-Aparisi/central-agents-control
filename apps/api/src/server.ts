import closeWithGrace from 'close-with-grace';
import { buildApp } from './app';
import { loadConfig } from './config';
import { startRunsWorker } from './workers/runs';

async function main(): Promise<void> {
  const config = loadConfig();
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

  closeWithGrace({ delay: 10_000 }, async ({ err }) => {
    if (err) app.log.error({ err }, 'fatal error, shutting down');
    if (worker) await worker.close();
    await app.close();
  });

  try {
    await app.listen({ host: config.API_HOST, port: config.API_PORT });
  } catch (err) {
    app.log.error({ err }, 'failed to start listener');
    process.exit(1);
  }
}

void main();
