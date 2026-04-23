import type { RunStatus } from '@cac/shared';
import { create } from 'zustand';

interface ActiveRunsState {
  /** Map of runId → last known status while it is queued or running. */
  active: Map<string, RunStatus>;
  setStatus: (runId: string, status: RunStatus) => void;
  remove: (runId: string) => void;
  count: () => number;
}

export const useActiveRunsStore = create<ActiveRunsState>((set, get) => ({
  active: new Map(),
  setStatus: (runId, status) => {
    set((s) => {
      const next = new Map(s.active);
      if (status === 'queued' || status === 'running') {
        next.set(runId, status);
      } else {
        next.delete(runId);
      }
      return { active: next };
    });
  },
  remove: (runId) => {
    set((s) => {
      if (!s.active.has(runId)) return s;
      const next = new Map(s.active);
      next.delete(runId);
      return { active: next };
    });
  },
  count: () => get().active.size,
}));
