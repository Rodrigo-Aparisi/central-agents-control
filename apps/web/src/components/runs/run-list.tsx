import type { Run } from '@cac/shared';
import { Link } from '@tanstack/react-router';
import { RunStatusBadge } from './run-status-badge';

interface Props {
  runs: Run[];
  emptyMessage?: string;
}

export function RunList({ runs, emptyMessage = 'Sin runs todavía.' }: Props) {
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Fecha</th>
            <th className="px-3 py-2 text-left font-medium">Estado</th>
            <th className="px-3 py-2 text-left font-medium">Duración</th>
            <th className="px-3 py-2 text-left font-medium">Tokens</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-accent/40">
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-2">
                <RunStatusBadge status={r.status} />
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.durationMs !== null ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.usage ? `${r.usage.inputTokens + r.usage.outputTokens}` : '—'}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  to="/runs/$id"
                  params={{ id: r.id }}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Ver →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
