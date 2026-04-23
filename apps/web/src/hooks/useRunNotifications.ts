import { qk } from '@/lib/queryKeys';
import { getRunsSocket } from '@/lib/socket';
import { useActiveRunsStore } from '@/stores/activeRuns';
import type { RunStatus } from '@cac/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';

const BASE_TITLE = 'Central Agents Control';

export function useRunNotifications(): void {
  const setStatus = useActiveRunsStore((s) => s.setStatus);
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getRunsSocket();
    const onStatus = (payload: { runId: string; status: RunStatus }) => {
      setStatus(payload.runId, payload.status);
      qc.invalidateQueries({ queryKey: qk.run(payload.runId) });
      qc.invalidateQueries({ queryKey: qk.runs() });

      if (payload.status === 'completed') {
        toast.success('Run completado', {
          description: `run ${payload.runId.slice(0, 8)} terminó correctamente`,
          action: { label: 'Abrir', onClick: () => openRun(payload.runId) },
        });
      } else if (
        payload.status === 'failed' ||
        payload.status === 'timeout' ||
        payload.status === 'cancelled'
      ) {
        toast.error(`Run ${payload.status}`, {
          description: `run ${payload.runId.slice(0, 8)}`,
          action: { label: 'Abrir', onClick: () => openRun(payload.runId) },
        });
      }
    };

    socket.on('run:status', onStatus);
    return () => {
      socket.off('run:status', onStatus);
    };
  }, [setStatus, qc]);

  const count = useActiveRunsStore((s) => s.active.size);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE;
  }, [count]);
}

function openRun(runId: string): void {
  const target = `/runs/${runId}`;
  if (typeof window !== 'undefined') {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
