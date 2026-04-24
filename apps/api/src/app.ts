import Sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { Config } from './config';
import { buildDevLogger, buildLoggerOptions } from './lib/logger';
import { configPlugin } from './plugins/config';
import { dbPlugin } from './plugins/db';
import { errorHandlerPlugin } from './plugins/error-handler';
import { queuesPlugin } from './plugins/queues';
import { redisPlugin } from './plugins/redis';
import { socketIoPlugin } from './plugins/socketio';
import { artifactRoutes } from './routes/artifacts';
import { eventRoutes } from './routes/events';
import { exportRoutes } from './routes/export';
import { fileRoutes } from './routes/files';
import { healthRoutes } from './routes/health';
import { projectRoutes } from './routes/projects';
import { runGraphRoutes } from './routes/run-graph';
import { runRoutes } from './routes/runs';
import { statsRoutes } from './routes/stats';

export interface BuildAppOptions {
  config: Config;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const sharedOpts = {
    disableRequestLogging: false,
    genReqId: (req: { headers: Record<string, string | string[] | undefined> }) =>
      (req.headers['x-request-id'] as string | undefined) ??
      `req_${Math.random().toString(36).slice(2, 10)}`,
    bodyLimit: 2 * 1024 * 1024,
  } as const;

  const app = (
    opts.config.NODE_ENV === 'development'
      ? Fastify({ ...sharedOpts, loggerInstance: buildDevLogger(opts.config) })
      : Fastify({ ...sharedOpts, logger: buildLoggerOptions(opts.config) })
  ).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(Sensible);
  await app.register(errorHandlerPlugin);
  await app.register(configPlugin, { config: opts.config });
  await app.register(dbPlugin, { config: opts.config });
  await app.register(redisPlugin, { config: opts.config });
  await app.register(queuesPlugin, { config: opts.config });
  await app.register(socketIoPlugin);

  await app.register(healthRoutes);
  await app.register(projectRoutes);
  await app.register(runRoutes);
  await app.register(eventRoutes);
  await app.register(artifactRoutes);
  await app.register(statsRoutes);
  await app.register(runGraphRoutes);
  await app.register(fileRoutes);
  await app.register(exportRoutes);

  return app;
}
