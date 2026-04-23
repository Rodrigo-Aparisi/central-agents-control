import type { RunEvent, RunStatus } from '@cac/shared';
import { create } from 'zustand';

interface RunnerPanelState {
  runId: string | null;
  status: RunStatus | null;
  events: RunEvent[];
  connectedAt: number | null;

  start: (runId: string, status?: RunStatus) => void;
  setStatus: (status: RunStatus) => void;
  appendEvent: (event: RunEvent) => void;
  appendEvents: (events: RunEvent[]) => void;
  resetFor: (runId: string) => void;
  clear: () => void;
}

export const useRunnerPanelStore = create<RunnerPanelState>((set, get) => ({
  runId: null,
  status: null,
  events: [],
  connectedAt: null,

  start: (runId, status) =>
    set({ runId, status: status ?? 'running', events: [], connectedAt: Date.now() }),
  setStatus: (status) => set({ status }),
  appendEvent: (event) => {
    if (get().runId !== event.runId) return;
    set((s) => ({ events: insertSorted(s.events, [event]) }));
  },
  appendEvents: (events) => {
    if (events.length === 0) return;
    const runId = events[0]?.runId;
    if (!runId || get().runId !== runId) return;
    set((s) => ({ events: insertSorted(s.events, events) }));
  },
  resetFor: (runId) => set({ runId, status: null, events: [], connectedAt: Date.now() }),
  clear: () => set({ runId: null, status: null, events: [], connectedAt: null }),
}));

function insertSorted(existing: RunEvent[], incoming: RunEvent[]): RunEvent[] {
  const seen = new Set(existing.map((e) => e.seq));
  const merged = [...existing];
  for (const ev of incoming) {
    if (seen.has(ev.seq)) continue;
    merged.push(ev);
    seen.add(ev.seq);
  }
  merged.sort((a, b) => a.seq - b.seq);
  return merged;
}
