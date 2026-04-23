import type { RunEvent } from '@cac/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LogViewer, renderPayload } from './log-viewer';

function makeEvent(seq: number, partial: Pick<RunEvent, 'type' | 'payload'>): RunEvent {
  return {
    id: `00000000-0000-7000-8000-${seq.toString().padStart(12, '0')}`,
    runId: '00000000-0000-7000-8000-000000000000',
    seq,
    timestamp: '2026-04-23T12:00:00.000Z',
    type: partial.type,
    payload: partial.payload,
  };
}

describe('LogViewer placeholder', () => {
  it('shows the waiting message when events is empty', () => {
    render(<LogViewer events={[]} />);
    expect(screen.getByText(/esperando eventos/i)).toBeInTheDocument();
  });
});

describe('renderPayload', () => {
  it('renders assistant messages as plain content', () => {
    const ev = makeEvent(0, {
      type: 'assistant_message',
      payload: { type: 'assistant_message', content: 'hola mundo' },
    });
    expect(renderPayload(ev)).toBe('hola mundo');
  });

  it('summarises tool_use with its input keys', () => {
    const ev = makeEvent(0, {
      type: 'tool_use',
      payload: { type: 'tool_use', tool: 'bash', input: { command: 'ls -la' } },
    });
    expect(renderPayload(ev)).toContain('bash(');
    expect(renderPayload(ev)).toContain('command=');
  });

  it('prefixes tool_result errors with ERROR', () => {
    const ok = makeEvent(0, {
      type: 'tool_result',
      payload: { type: 'tool_result', tool: 'read', output: 'fine', isError: false },
    });
    const bad = makeEvent(0, {
      type: 'tool_result',
      payload: { type: 'tool_result', tool: 'read', output: 'bad', isError: true },
    });
    expect(renderPayload(ok)).toBe('fine');
    expect(renderPayload(bad)).toBe('ERROR: bad');
  });

  it('renders usage with all token counters', () => {
    const ev = makeEvent(0, {
      type: 'usage',
      payload: {
        type: 'usage',
        inputTokens: 10,
        outputTokens: 20,
        cacheReadTokens: 1,
        cacheWriteTokens: 2,
      },
    });
    expect(renderPayload(ev)).toBe('in=10 out=20 cache r=1 w=2');
  });

  it('renders error payload with code and message', () => {
    const ev = makeEvent(0, {
      type: 'error',
      payload: { type: 'error', code: 'BOOM', message: 'explosion' },
    });
    expect(renderPayload(ev)).toBe('[BOOM] explosion');
  });

  it('serializes unknown payloads', () => {
    const ev = makeEvent(0, {
      type: 'unknown',
      payload: { type: 'unknown', raw: { hello: 'world' } },
    });
    expect(renderPayload(ev)).toContain('"hello":"world"');
  });
});
