import type { RunEvent } from '@cac/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRunnerPanelStore } from './runnerPanel';

function makeEvent(runId: string, seq: number): RunEvent {
  return {
    id: `${runId}-${seq}`,
    runId,
    seq,
    type: 'system',
    payload: { type: 'system', content: `event ${seq}` },
    timestamp: new Date().toISOString(),
  };
}

beforeEach(() => {
  useRunnerPanelStore.getState().clear();
});

describe('runnerPanel store', () => {
  it('ignores events from a different runId', () => {
    useRunnerPanelStore.getState().resetFor('run-a');
    useRunnerPanelStore.getState().appendEvent(makeEvent('run-b', 0));
    expect(useRunnerPanelStore.getState().events).toHaveLength(0);
  });

  it('keeps events sorted by seq and deduplicates', () => {
    useRunnerPanelStore.getState().resetFor('r1');
    useRunnerPanelStore.getState().appendEvents([makeEvent('r1', 2), makeEvent('r1', 0)]);
    useRunnerPanelStore.getState().appendEvent(makeEvent('r1', 1));
    useRunnerPanelStore.getState().appendEvent(makeEvent('r1', 1)); // duplicate
    const seqs = useRunnerPanelStore.getState().events.map((e) => e.seq);
    expect(seqs).toEqual([0, 1, 2]);
  });

  it('clear resets the state', () => {
    useRunnerPanelStore.getState().resetFor('r1');
    useRunnerPanelStore.getState().appendEvent(makeEvent('r1', 0));
    useRunnerPanelStore.getState().clear();
    const s = useRunnerPanelStore.getState();
    expect(s.runId).toBeNull();
    expect(s.events).toHaveLength(0);
  });
});
