import { cn } from '@/lib/cn';
import type { RunEvent } from '@cac/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';

const COLOR_BY_TYPE: Record<string, string> = {
  assistant_message: 'text-foreground',
  tool_use: 'text-sky-400 dark:text-sky-300',
  tool_result: 'text-muted-foreground',
  thinking: 'text-purple-400/80 dark:text-purple-300/80',
  usage: 'text-emerald-400 dark:text-emerald-300',
  system: 'text-amber-400 dark:text-amber-300',
  error: 'text-destructive',
  unknown: 'text-muted-foreground italic',
};

interface Props {
  events: RunEvent[];
  autoscroll?: boolean;
}

export function LogViewer({ events, autoscroll = true }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  useEffect(() => {
    if (!autoscroll || events.length === 0) return;
    virtualizer.scrollToIndex(events.length - 1, { align: 'end' });
  }, [events.length, autoscroll, virtualizer]);

  if (events.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-md border border-border bg-card/40 text-sm text-muted-foreground">
        Esperando eventos…
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-[520px] overflow-auto rounded-md border border-border bg-card/40 font-mono text-xs"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const ev = events[vi.index];
          if (!ev) return null;
          return (
            <div
              key={ev.id}
              ref={virtualizer.measureElement}
              data-index={vi.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${vi.start}px)`,
              }}
              className="border-b border-border/60 px-3 py-2"
            >
              <EventRow ev={ev} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: RunEvent }) {
  const colour = COLOR_BY_TYPE[ev.type] ?? 'text-foreground';
  return (
    <div className="flex gap-3">
      <span className="w-10 shrink-0 text-muted-foreground">#{ev.seq}</span>
      <span className={cn('shrink-0 w-36 font-medium', colour)}>{ev.type}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{renderPayload(ev)}</span>
    </div>
  );
}

export function renderPayload(ev: RunEvent): string {
  const p = ev.payload;
  switch (p.type) {
    case 'assistant_message':
      return p.content;
    case 'tool_use':
      return `${p.tool}(${summarise(p.input)})`;
    case 'tool_result':
      return p.isError ? `ERROR: ${p.output}` : p.output;
    case 'thinking':
      return p.content;
    case 'usage':
      return `in=${p.inputTokens} out=${p.outputTokens} cache r=${p.cacheReadTokens} w=${p.cacheWriteTokens}`;
    case 'system':
      return p.content;
    case 'error':
      return `[${p.code}] ${p.message}`;
    case 'unknown':
      return JSON.stringify(p.raw);
  }
}

function summarise(input: Record<string, unknown>): string {
  const entries = Object.entries(input);
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}=${truncate(JSON.stringify(v), 60)}`).join(', ');
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
