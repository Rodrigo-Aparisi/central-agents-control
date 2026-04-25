import type { IncomingMessage, ServerResponse } from 'node:http';
import cookie from '@fastify/cookie';
import Sensible from '@fastify/sensible';
import Fastify, {
  type FastifyInstance,
  type FastifyBaseLogger,
  type RawServerDefault,
} from 'fastify';
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { Config } from './config';
import { buildDevLogger, buildLoggerOptions } from './lib/logger';
import { authPlugin } from './plugins/auth';
import { configPlugin } from './plugins/config';
import { corsPlugin } from './plugins/cors';
import { dbPlugin } from './plugins/db';
import { errorHandlerPlugin } from './plugins/error-handler';
import { queuesPlugin } from './plugins/queues';
import { rateLimitPlugin } from './plugins/rate-limit';
import { redisPlugin } from './plugins/redis';
import { socketIoPlugin } from './plugins/socketio';
import { adminAuditRoutes } from './routes/admin/audit';
import { adminUserRoutes } from './routes/admin/users';
import { artifactRoutes } from './routes/artifacts';
import { authRoutes } from './routes/auth';
import { agentChatRoutes } from './routes/agent-chat';
import { claudeConfigRoutes } from './routes/claude-config';
import { eventRoutes } from './routes/events';
import { exportRoutes } from './routes/export';
import { fileRoutes } from './routes/files';
import { fsBrowseRoutes } from './routes/fs-browse';
import { gitRoutes } from './routes/git';
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

  const app = (opts.config.NODE_ENV === 'development'
    ? Fastify({ ...sharedOpts, loggerInstance: buildDevLogger(opts.config) })
    : Fastify({
        ...sharedOpts,
        logger: buildLoggerOptions(opts.config),
      })) as unknown as FastifyInstance<
    RawServerDefault,
    IncomingMessage,
    ServerResponse,
    FastifyBaseLogger,
    ZodTypeProvider
  >;

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(Sensible);
  await app.register(errorHandlerPlugin);
  await app.register(configPlugin, { config: opts.config });
  await app.register(corsPlugin);
  await app.register(cookie);
  await app.register(dbPlugin, { config: opts.config });
  await app.register(redisPlugin, { config: opts.config });
  await app.register(queuesPlugin, { config: opts.config });
  await app.register(rateLimitPlugin);
  await app.register(authPlugin);
  await app.register(socketIoPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(projectRoutes);
  await app.register(runRoutes);
  await app.register(eventRoutes);
  await app.register(artifactRoutes);
  await app.register(statsRoutes);
  await app.register(runGraphRoutes);
  await app.register(fileRoutes);
  await app.register(exportRoutes);
  await app.register(gitRoutes);
  await app.register(fsBrowseRoutes);
  await app.register(claudeConfigRoutes);
  await app.register(agentChatRoutes);
  await app.register(adminUserRoutes);
  await app.register(adminAuditRoutes);

  return app as unknown as FastifyInstance;
}
