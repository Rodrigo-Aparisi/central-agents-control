import { RUNS_NAMESPACE } from '@cac/shared';
import { type Socket, io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

let socket: Socket | null = null;

export function getRunsSocket(): Socket {
  if (socket?.connected) return socket;
  if (socket) {
    socket.connect();
    return socket;
  }
  socket = io(`${SOCKET_URL}${RUNS_NAMESPACE}`, {
    path: '/ws',
    autoConnect: true,
    transports: ['websocket'],
  });
  return socket;
}

export function joinRun(runId: string): Socket {
  const s = getRunsSocket();
  s.emit('join', { runId });
  return s;
}
