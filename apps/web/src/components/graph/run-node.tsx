import { cn } from '@/lib/cn';
import type { RunStatus } from '@cac/shared';
import { Handle, type NodeProps, Position } from '@xyflow/react';

export interface RunNodeData extends Record<string, unknown> {
  shortId: string;
  label?: string;
  status: RunStatus;
  timestamp: string;
  duration: string | null;
}

const STRIPE_VAR: Record<RunStatus, string> = {
  queued: 'var(--color-status-queued)',
  running: 'var(--color-status-running)',
  completed: 'var(--color-status-completed)',
  cancelled: 'var(--color-status-cancelled)',
  failed: 'var(--color-status-failed)',
  timeout: 'var(--color-status-timeout)',
};

export function RunNode({ data, selected }: NodeProps) {
  const d = data as unknown as RunNodeData;
  const stripe = STRIPE_VAR[d.status];

  return (
    <div
      className={cn(
        'group relative flex h-[40px] w-[220px] items-center gap-2 rule border bg-card pl-[11px] pr-3',
        'transition-[border-color,box-shadow] duration-120',
        'hover:shadow-[var(--elev-2)] focus-visible:outline-none',
        selected && 'border-primary',
      )}
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: selected ? 'var(--color-primary)' : stripe }}
        aria-hidden
      />

      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-transparent"
      />

      {d.label ? (
        <span className="flex-1 truncate font-mono text-[11px] text-foreground">{d.label}</span>
      ) : (
        <span className="tnum font-mono text-[11px] text-foreground">{d.shortId}</span>
      )}
      <span
        className={cn('size-1.5 rounded-full', d.status === 'running' && 'animate-pulse')}
        style={{ backgroundColor: stripe }}
        aria-hidden
      />
      <span className="tnum flex-1 truncate font-mono text-[11px] text-muted-foreground">
        {d.timestamp}
      </span>
      {d.duration ? (
        <span className="tnum shrink-0 font-mono text-[11px] text-muted-foreground">
          {d.duration}
        </span>
      ) : null}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-transparent"
      />
    </div>
  );
}
