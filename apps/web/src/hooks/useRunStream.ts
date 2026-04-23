import { getRunsSocket, joinRun } from '@/lib/socket';
import { useRunnerPanelStore } from '@/stores/runnerPanel';
import type { RunEvent, RunStatus } from '@cac/shared';
import { useEffect } from 'react';

export function useRunStream(runId: string): void {
  const resetFor = useRunnerPanelStore((s) => s.resetFor);
  const appendEvent = useRunnerPanelStore((s) => s.appendEvent);
  const appendEvents = useRunnerPanelStore((s) => s.appendEvents);
  const setStatus = useRunnerPanelStore((s) => s.setStatus);

  useEffect(() => {
    resetFor(runId);
    const socket = joinRun(runId);

    const onEvent = (payload: { runId: string; event: RunEvent } | RunEvent) => {
      const event = 'event' in payload ? payload.event : payload;
      appendEvent(event);
    };
    const onLog = (payload: { runId: string; events: RunEvent[] }) => {
      appendEvents(payload.events);
    };
    const onStatus = (payload: { runId: string; status: RunStatus }) => {
      if (payload.runId === runId) setStatus(payload.status);
    };

    socket.on('run:event', onEvent);
    socket.on('run:log', onLog);
    socket.on('run:status', onStatus);

    return () => {
      socket.off('run:event', onEvent);
      socket.off('run:log', onLog);
      socket.off('run:status', onStatus);
    };
  }, [runId, resetFor, appendEvent, appendEvents, setStatus]);

  useEffect(() => {
    return () => {
      // keep the shared socket alive across pages; just leave the room
      const s = getRunsSocket();
      s.emit('leave', { runId });
    };
  }, [runId]);
}
