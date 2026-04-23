import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { EventType, RunEvent } from '@cac/shared';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';

interface Props {
  events: RunEvent[];
  selectedSeq: number | null;
  onSelect: (seq: number | null) => void;
}

const TICK_COLOR: Record<EventType, string> = {
  assistant_message: 'var(--color-chart-1)',
  tool_use: 'var(--color-chart-2)',
  tool_result: 'var(--color-muted-foreground)',
  thinking: 'var(--color-chart-5)',
  usage: 'var(--color-chart-3)',
  system: 'var(--color-muted-foreground)',
  error: 'var(--color-status-failed)',
  unknown: 'var(--color-muted)',
};

export function TimelineSlider({ events, selectedSeq, onSelect }: Props) {
  const errorSeqs = useMemo(
    () => events.filter((e) => e.type === 'error').map((e) => e.seq),
    [events],
  );
  const maxSeq = events.length === 0 ? 0 : (events[events.length - 1]?.seq ?? 0);
  const minSeq = events[0]?.seq ?? 0;
  const current = selectedSeq ?? minSeq;

  const goFirst = useCallback(() => onSelect(minSeq), [minSeq, onSelect]);
  const goLast = useCallback(() => onSelect(maxSeq), [maxSeq, onSelect]);
  const goPrev = useCallback(
    () => onSelect(Math.max(minSeq, current - 1)),
    [current, minSeq, onSelect],
  );
  const goNext = useCallback(
    () => onSelect(Math.min(maxSeq, current + 1)),
    [current, maxSeq, onSelect],
  );
  const goPrevError = useCallback(() => {
    const prev = [...errorSeqs].reverse().find((s) => s < current);
    if (prev !== undefined) onSelect(prev);
  }, [errorSeqs, current, onSelect]);
  const goNextError = useCallback(() => {
    const next = errorSeqs.find((s) => s > current);
    if (next !== undefined) onSelect(next);
  }, [errorSeqs, current, onSelect]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        goPrevError();
      } else if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        goNextError();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'Home') {
        goFirst();
      } else if (e.key === 'End') {
        goLast();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [goFirst, goLast, goPrev, goNext, goPrevError, goNextError]);

  if (events.length === 0) return null;

  const firstTs = events[0]?.timestamp;
  const lastTs = events[events.length - 1]?.timestamp;
  const currentErrorIdx = errorSeqs.indexOf(current);
  const hasErrors = errorSeqs.length > 0;

  return (
    <div className="space-y-1 rule border bg-card/40 px-3 py-2">
      {/* Row 1: ruler with coloured ticks */}
      <div className="relative h-2">
        <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--rule-soft)]" />
        {events.map((ev) => (
          <button
            key={ev.id}
            type="button"
            onClick={() => onSelect(ev.seq)}
            title={`#${ev.seq} · ${ev.type}`}
            className="absolute top-0 -translate-x-1/2"
            style={{
              left: `${maxSeq === minSeq ? 50 : ((ev.seq - minSeq) / (maxSeq - minSeq)) * 100}%`,
              width: 1,
              height: ev.type === 'error' ? 8 : 6,
              backgroundColor: TICK_COLOR[ev.type],
              cursor: 'pointer',
            }}
            aria-label={`Evento #${ev.seq} ${ev.type}`}
          />
        ))}
      </div>

      {/* Row 2: handle */}
      <div className="relative h-5">
        <input
          type="range"
          min={minSeq}
          max={maxSeq}
          step={1}
          value={current}
          onChange={(e) => onSelect(Number(e.target.value))}
          className={cn(
            'absolute inset-0 h-full w-full appearance-none bg-transparent',
            '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-[2px]',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-foreground',
            '[&::-webkit-slider-thumb]:cursor-ew-resize',
            '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-[2px] [&::-moz-range-thumb]:border-0',
            '[&::-moz-range-thumb]:bg-foreground',
            'focus:outline-none',
          )}
        />
      </div>

      {/* Row 3: micro labels */}
      <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span className="tnum">
          #{minSeq} · {firstTs?.slice(11, 19) ?? ''}
        </span>
        <span className="tnum text-foreground">
          #{current} / {maxSeq}
        </span>
        <span className="tnum">
          #{maxSeq} · {lastTs?.slice(11, 19) ?? ''}
        </span>
      </div>

      {/* Row 4: toolbar */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={goFirst} aria-label="Primer evento">
            <ChevronsLeft className="size-3.5" strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="sm" onClick={goPrev} aria-label="Evento anterior">
            <ChevronLeft className="size-3.5" strokeWidth={1.75} />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrevError}
            disabled={!hasErrors}
            aria-label="Error anterior"
          >
            <CircleAlert className="size-3.5" strokeWidth={1.75} />
            <ChevronLeft className="-ml-1 size-3" strokeWidth={1.75} />
          </Button>
          <span className="tnum min-w-[70px] text-center font-mono text-[11px] text-muted-foreground">
            {hasErrors
              ? `Err ${currentErrorIdx >= 0 ? currentErrorIdx + 1 : '·'}/${errorSeqs.length}`
              : 'Sin errores'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={goNextError}
            disabled={!hasErrors}
            aria-label="Siguiente error"
          >
            <CircleAlert className="size-3.5" strokeWidth={1.75} />
            <ChevronRight className="-ml-1 size-3" strokeWidth={1.75} />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={goNext} aria-label="Evento siguiente">
            <ChevronRight className="size-3.5" strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="sm" onClick={goLast} aria-label="Último evento">
            <ChevronsRight className="size-3.5" strokeWidth={1.75} />
          </Button>
        </div>
      </div>
    </div>
  );
}
