import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui';
import type { RunEvent } from '@cac/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef } from 'react';

// Colour by event type
const COLOR_BY_TYPE: Record<string, string> = {
  assistant_message: 'text-foreground',
  tool_use: 'text-[var(--color-chart-2)]',
  tool_result: 'text-muted-foreground',
  thinking: 'text-[var(--color-chart-5)]',
  usage: 'text-[var(--color-chart-3)]',
  system: 'text-muted-foreground/70',
  error: 'text-destructive',
  unknown: 'text-muted-foreground italic',
};

interface Props {
  events: RunEvent[];
  autoscroll?: boolean;
  highlightSeq?: number | null;
}

const FONT_SIZE_CLASS = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
} as const;

/** Events that are noise and should not be shown in the viewer */
function shouldHide(ev: RunEvent): boolean {
  // Empty assistant messages (Claude emits these before tool calls)
  if (ev.payload.type === 'assistant_message' && ev.payload.content === '') return true;
  // Unknown events (e.g. rate_limit_event — internal Claude Code telemetry)
  if (ev.type === 'unknown') return true;
  return false;
}

export function LogViewer({ events, autoscroll = true, highlightSeq = null }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const fontSize = useUiStore((s) => s.logFontSize);

  const visibleEvents = useMemo(() => events.filter((ev) => !shouldHide(ev)), [events]);

  const virtualizer = useVirtualizer({
    count: visibleEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  useEffect(() => {
    if (!autoscroll || visibleEvents.length === 0) return;
    virtualizer.scrollToIndex(visibleEvents.length - 1, { align: 'end' });
  }, [visibleEvents.length, autoscroll, virtualizer]);

  useEffect(() => {
    if (highlightSeq === null) return;
    const idx = visibleEvents.findIndex((e) => e.seq === highlightSeq);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: 'center' });
  }, [highlightSeq, visibleEvents, virtualizer]);

  if (visibleEvents.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rule border bg-card/40 text-sm text-muted-foreground">
        Esperando eventos…
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn(
        'h-[520px] overflow-auto rule border bg-card/40 font-mono',
        FONT_SIZE_CLASS[fontSize],
      )}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const ev = visibleEvents[vi.index];
          if (!ev) return null;
          const isHighlighted = ev.seq === highlightSeq;
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
              className={cn(
                'relative border-b rule-soft px-3 py-2',
                isHighlighted && 'bg-accent/40',
              )}
            >
              {isHighlighted ? (
                <span className="absolute inset-y-0 left-0 w-[2px] bg-foreground" aria-hidden />
              ) : null}
              <EventRow ev={ev} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Returns the display label for an event.
 * For tool_use: shows the tool name directly (or subagent_type for Agent).
 * For everything else: shows ev.type.
 */
function getLabel(ev: RunEvent): string {
  const p = ev.payload;
  if (p.type === 'tool_use') {
    if (p.tool.toLowerCase() === 'agent' && typeof p.input.subagent_type === 'string') {
      return p.input.subagent_type;
    }
    return p.tool;
  }
  if (p.type === 'tool_result') {
    return p.tool !== 'unknown' ? p.tool : 'tool_result';
  }
  return ev.type;
}

function EventRow({ ev }: { ev: RunEvent }) {
  const label = getLabel(ev);
  const colour = COLOR_BY_TYPE[ev.type] ?? 'text-foreground';
  return (
    <div className="flex gap-3">
      <span className="tnum w-10 shrink-0 text-muted-foreground">#{ev.seq}</span>
      <span className={cn('w-40 shrink-0 font-medium truncate', colour)} title={label}>
        {label}
      </span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{renderPayload(ev)}</span>
    </div>
  );
}

export function renderPayload(ev: RunEvent): string {
  const p = ev.payload;
  switch (p.type) {
    case 'assistant_message':
      return p.content;
    case 'tool_use': {
      const toolLower = p.tool.toLowerCase();
      if (toolLower === 'task' || toolLower === 'agent') {
        const desc =
          typeof p.input.description === 'string'
            ? p.input.description
            : typeof p.input.prompt === 'string'
              ? p.input.prompt.slice(0, 120)
              : '';
        return desc ? `→ ${desc}` : `(${summarise(p.input)})`;
      }
      return `(${summarise(p.input)})`;
    }
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
