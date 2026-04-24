import { RUNS_NAMESPACE } from '@cac/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { type Namespace, Server as SocketIOServer } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
    runsNs: Namespace;
  }
}

export const socketIoPlugin = fp(
  async (fastify: FastifyInstance) => {
    const io = new SocketIOServer(fastify.server, {
      path: '/ws',
      cors: { origin: false },
      serveClient: false,
    });

    const runsNs = io.of(RUNS_NAMESPACE);
    runsNs.on('connection', (socket) => {
      socket.on('join', (payload: { runId?: unknown }) => {
        if (typeof payload?.runId === 'string') {
          socket.join(payload.runId);
        }
      });
      socket.on('leave', (payload: { runId?: unknown }) => {
        if (typeof payload?.runId === 'string') {
          socket.leave(payload.runId);
        }
      });
    });

    fastify.decorate('io', io);
    fastify.decorate('runsNs', runsNs);

    fastify.addHook('onClose', async () => {
      await io.close();
    });
  },
  { name: 'socketio' },
);
