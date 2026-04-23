import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { Artifact } from '@cac/shared';
import { Suspense, lazy, useState } from 'react';

const DiffViewer = lazy(async () => {
  const mod = await import('react-diff-viewer-continued');
  return { default: mod.default };
});

interface Props {
  artifacts: Artifact[];
}

export function ChangedFiles({ artifacts }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(artifacts[0]?.id ?? null);
  const [splitView, setSplitView] = useState(true);

  if (artifacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Este run no produjo archivos modificados.</p>
    );
  }

  const selected = artifacts.find((a) => a.id === selectedId) ?? artifacts[0];
  if (!selected) return null;

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <div className="space-y-1">
        {artifacts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelectedId(a.id)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm',
              a.id === selected.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
            )}
          >
            <span className="truncate font-mono text-xs">{a.filePath}</span>
            <OperationBadge op={a.operation} />
          </button>
        ))}
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {selected.filePath}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSplitView((v) => !v)}>
            {splitView ? 'Unified' : 'Side-by-side'}
          </Button>
        </div>
        <div className="overflow-hidden rounded-md border border-border">
          {selected.diff ? (
            <Suspense
              fallback={<div className="p-6 text-sm text-muted-foreground">Cargando diff…</div>}
            >
              <DiffViewer
                oldValue=""
                newValue={selected.diff}
                splitView={splitView}
                hideLineNumbers={false}
                useDarkTheme
              />
            </Suspense>
          ) : (
            <pre className="max-h-[480px] overflow-auto bg-card/40 p-3 text-xs">
              {selected.contentAfter ?? '(sin contenido capturado)'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function OperationBadge({ op }: { op: Artifact['operation'] }) {
  if (op === 'created') return <Badge variant="success">+</Badge>;
  if (op === 'deleted') return <Badge variant="destructive">–</Badge>;
  return <Badge variant="muted">~</Badge>;
}
