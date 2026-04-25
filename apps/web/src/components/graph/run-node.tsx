import { cn } from '@/lib/cn';
import type { RunStatus } from '@cac/shared';
import { Handle, type NodeProps, Position } from '@xyflow/react';

export interface RunNodeData extends Record<string, unknown> {
  shortId: string;
  label?: string;
  name?: string;
  subtitle?: string;
  toolType?: 'orchestrator' | 'agent' | 'task';
  status: RunStatus;
  timestamp: string;
  duration: string | null;
}

const STATUS_COLOR: Record<RunStatus, string> = {
  queued: 'var(--color-status-queued)',
  running: 'var(--color-status-running)',
  completed: 'var(--color-status-completed)',
  cancelled: 'var(--color-status-cancelled)',
  failed: 'var(--color-status-failed)',
  timeout: 'var(--color-status-timeout)',
};

const ACCENT: Record<string, { border: string; bg: string }> = {
  orchestrator: { border: '#a78bfa', bg: 'rgba(167,139,250,0.07)' },
  agent: { border: '#2dd4bf', bg: 'rgba(45,212,191,0.07)' },
  task: { border: '#60a5fa', bg: 'rgba(96,165,250,0.07)' },
};

export function RunNode({ data, selected }: NodeProps) {
  const d = data as unknown as RunNodeData;
  const statusColor = STATUS_COLOR[d.status];
  const toolType = d.toolType;
  const accent = toolType ? (ACCENT[toolType] ?? ACCENT.orchestrator) : null;
  // When no toolType provided (run-graph context), fall back to status-based stripe
  const stripeColor = accent ? accent.border : statusColor;
  const bgColor = accent ? accent.bg : undefined;

  const primaryLabel = d.name ?? d.label ?? d.shortId;
  const hasSubtitle = Boolean(d.subtitle);

  return (
    <div
      className={cn(
        'group relative w-[200px] pl-[12px] pr-3 py-2 rule border bg-card cursor-pointer',
        'transition-[border-color,box-shadow] duration-100',
        selected && 'border-primary shadow-[var(--elev-2)]',
      )}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: selected ? 'var(--color-primary)' : stripeColor }}
        aria-hidden
      />

      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-transparent" />

      <div className="flex items-center gap-1.5 min-w-0">
        <span className="flex-1 min-w-0 truncate font-mono text-[11px] font-semibold leading-snug text-foreground">
          {primaryLabel}
        </span>
        <span
          className={cn('size-1.5 shrink-0 rounded-full', d.status === 'running' && 'animate-pulse')}
          style={{ backgroundColor: statusColor }}
          aria-hidden
        />
      </div>

      {hasSubtitle ? (
        <div className="mt-0.5 flex items-center gap-1 min-w-0">
          <span className="flex-1 min-w-0 truncate font-mono text-[10px] leading-snug text-muted-foreground">
            {d.subtitle}
          </span>
          {d.timestamp ? (
            <span className="tnum shrink-0 font-mono text-[10px] text-muted-foreground/60">
              {d.timestamp}
            </span>
          ) : null}
        </div>
      ) : d.timestamp ? (
        <div className="mt-0.5 font-mono text-[10px] leading-snug text-muted-foreground/60">
          {d.timestamp}
        </div>
      ) : null}

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-transparent" />
    </div>
  );
}
