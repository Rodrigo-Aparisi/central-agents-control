import type { GlobalStatsResponse } from '@cac/shared';
import { Link } from '@tanstack/react-router';

interface Props {
  topProjects: GlobalStatsResponse['topProjects'];
}

export function TopProjects({ topProjects }: Props) {
  if (topProjects.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Sin datos todavía.
      </div>
    );
  }

  const maxRuns = Math.max(...topProjects.map((p) => p.runs));

  return (
    <ul className="space-y-2.5">
      {topProjects.map((p) => {
        const pct = maxRuns > 0 ? (p.runs / maxRuns) * 100 : 0;
        const tokens = p.inputTokens + p.outputTokens;
        return (
          <li key={p.projectId} className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/projects/$id"
                params={{ id: p.projectId }}
                className="truncate text-sm hover:text-primary"
              >
                {p.name}
              </Link>
              <span className="tnum shrink-0 font-mono text-[11px] text-muted-foreground">
                {p.runs} runs · {formatTokens(tokens)} tok
              </span>
            </div>
            <div className="relative h-[3px] w-full rounded-full bg-[var(--color-chart-1)]/15">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-chart-1)]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
