import { cn } from '@/lib/cn';
import type { Run } from '@cac/shared';
import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RunStatusBadge } from './run-status-badge';

const DATE_FMT = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function fmtDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

interface Props {
  runs: Run[];
  emptyMessage?: string;
}

interface RunTree {
  run: Run;
  children: Run[];
}

export function RunList({ runs, emptyMessage = 'Sin runs todavía.' }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  type DisplayItem =
    | { kind: 'parent'; run: Run; children: Run[] }
    | { kind: 'orphan'; run: Run };

  const displayItems = useMemo<DisplayItem[]>(() => {
    const parentIds = new Set(runs.filter((r) => r.parentRunId === null).map((r) => r.id));
    const childrenMap = new Map<string, Run[]>();

    for (const run of runs) {
      if (run.parentRunId !== null) {
        const arr = childrenMap.get(run.parentRunId) ?? [];
        arr.push(run);
        childrenMap.set(run.parentRunId, arr);
      }
    }

    const items: DisplayItem[] = runs.map((run) => {
      if (run.parentRunId === null) {
        return { kind: 'parent', run, children: childrenMap.get(run.id) ?? [] };
      }
      if (!parentIds.has(run.parentRunId)) {
        // Parent not in current page — show in-place by date
        return { kind: 'orphan', run };
      }
      return null; // will be rendered as child under its parent
    }).filter((item): item is DisplayItem => item !== null);

    // Sort all top-level items by createdAt desc so orphans appear in the right position
    return items.sort(
      (a, b) => new Date(b.run.createdAt).getTime() - new Date(a.run.createdAt).getTime(),
    );
  }, [runs]);

  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Fecha / Descripción</th>
            <th className="px-3 py-2 text-left font-medium">Estado</th>
            <th className="px-3 py-2 text-left font-medium">Duración</th>
            <th className="px-3 py-2 text-left font-medium">Tokens</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {displayItems.flatMap((item) => {
            if (item.kind === 'orphan') {
              return [<SubRunRow key={item.run.id} run={item.run} />];
            }
            const { run, children } = item;
            const isExpanded = expandedIds.has(run.id);
            const hasChildren = children.length > 0;
            return [
              <ParentRow
                key={run.id}
                run={run}
                childCount={children.length}
                isExpanded={isExpanded}
                onToggle={hasChildren ? () => toggle(run.id) : undefined}
              />,
              ...(isExpanded
                ? children.map((child) => <SubRunRow key={child.id} run={child} isNested />)
                : []),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Parent row ───────────────────────────────────────────────────────────────

function ParentRow({
  run: r,
  childCount,
  isExpanded,
  onToggle,
}: {
  run: Run;
  childCount: number;
  isExpanded: boolean;
  onToggle?: () => void;
}) {
  return (
    <tr className="border-t border-border hover:bg-accent/40">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              className="flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label={isExpanded ? 'Contraer sub-agentes' : 'Expandir sub-agentes'}
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              <span className="font-mono text-[10px]">{childCount}</span>
            </button>
          ) : (
            <span className="w-[28px] shrink-0" />
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {fmtDate(r.createdAt)}
          </span>
        </div>
      </td>
      <td className="px-3 py-2">
        <RunStatusBadge status={r.status} />
      </td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
        {r.durationMs !== null ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
        {r.usage ? `${r.usage.inputTokens + r.usage.outputTokens}` : '—'}
      </td>
      <td className="px-3 py-2 text-right">
        <Link
          to="/runs/$id"
          params={{ id: r.id }}
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          Ver →
        </Link>
      </td>
    </tr>
  );
}

// ─── Sub-run row ──────────────────────────────────────────────────────────────

function SubRunRow({ run: r, isNested = false }: { run: Run; isNested?: boolean }) {
  return (
    <tr
      className={cn(
        'border-t border-border/60 hover:bg-accent/30',
        isNested && 'bg-[rgba(45,212,191,0.03)]',
      )}
    >
      <td className="py-1.5 pr-3">
        <div className={cn('flex items-center gap-2', isNested ? 'pl-9' : 'pl-3')}>
          {isNested && (
            <span className="shrink-0 text-[#2dd4bf]/50 select-none" aria-hidden>
              └
            </span>
          )}
          <span
            className="shrink-0 rounded border px-1 py-px font-mono text-[9px] uppercase tracking-wider"
            style={{ borderColor: '#2dd4bf', color: '#2dd4bf' }}
          >
            sub-agente
          </span>
          {r.prompt && (
            <span className="truncate font-mono text-xs font-semibold text-foreground max-w-[220px]">
              {r.prompt}
            </span>
          )}
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
            {fmtDate(r.createdAt)}
          </span>
        </div>
      </td>
      <td className="px-3 py-1.5">
        <RunStatusBadge status={r.status} />
      </td>
      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
        {r.durationMs !== null ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}
      </td>
      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
        {r.usage ? `${r.usage.inputTokens + r.usage.outputTokens}` : '—'}
      </td>
      <td className="px-3 py-1.5 text-right">
        <Link
          to="/runs/$id"
          params={{ id: r.id }}
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          Ver →
        </Link>
      </td>
    </tr>
  );
}
