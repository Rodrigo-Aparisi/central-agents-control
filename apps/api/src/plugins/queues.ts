import { Queue, QueueEvents } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { Config } from '../config';

export interface RunJobPayload {
  runId: string;
  projectId: string;
}

export interface CacQueues {
  runs: Queue<RunJobPayload>;
  runsEvents: QueueEvents;
  close: () => Promise<void>;
}

declare module 'fastify' {
  interface FastifyInstance {
    queues: CacQueues;
  }
}

export const RUNS_QUEUE_NAME = 'runs';

export const queuesPlugin = fp(
  async (fastify: FastifyInstance, opts: { config: Config }) => {
    const connection = { url: opts.config.REDIS_URL };

    const runs = new Queue<RunJobPayload>(RUNS_QUEUE_NAME, {
      connection,
      defaultJobOptions: { attempts: 1, removeOnComplete: 200, removeOnFail: 500 },
    });
    const runsEvents = new QueueEvents(RUNS_QUEUE_NAME, { connection });

    const queues: CacQueues = {
      runs,
      runsEvents,
      close: async () => {
        await Promise.allSettled([runs.close(), runsEvents.close()]);
      },
    };

    fastify.decorate('queues', queues);

    fastify.addHook('onClose', async () => {
      await queues.close();
    });
  },
  { name: 'queues', dependencies: [] },
);
