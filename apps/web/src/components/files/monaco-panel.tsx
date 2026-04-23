import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui';
import { useQuery } from '@tanstack/react-query';
import { Copy, ExternalLink } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { toast } from 'sonner';
import { detectLanguage } from './detect-language';

const Editor = lazy(async () => {
  const mod = await import('@monaco-editor/react');
  return { default: mod.default };
});

interface Props {
  projectId: string;
  path: string;
}

export function MonacoPanel({ projectId, path }: Props) {
  const theme = useUiStore((s) => s.theme);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['cac', 'files', 'content', projectId, path],
    queryFn: () => api.files.content(projectId, path),
    staleTime: 30_000,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 items-center justify-between border-b rule px-3">
        <span className="truncate font-mono text-[11px] text-muted-foreground">{path}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (data?.content) {
                navigator.clipboard.writeText(data.content).then(
                  () => toast.success('Contenido copiado'),
                  () => toast.error('No se pudo copiar'),
                );
              }
            }}
            disabled={!data?.content}
          >
            <Copy className="size-3.5" strokeWidth={1.75} />
            Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(path).then(
                () => toast.success('Ruta copiada'),
                () => toast.error('No se pudo copiar'),
              );
            }}
          >
            <ExternalLink className="size-3.5" strokeWidth={1.75} />
            Path
          </Button>
        </div>
      </div>

      {data?.truncated ? (
        <div className="border-b rule bg-[var(--warning)]/15 px-3 py-1.5 text-[11px] text-foreground">
          Archivo truncado a 500KB ({formatBytes(data.size)})
        </div>
      ) : null}

      <div className="relative flex-1">
        {isPending ? (
          <Skeleton />
        ) : isError ? (
          <div className="p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : 'No se pudo cargar el archivo'}
          </div>
        ) : data && data.size === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Archivo vacío
          </div>
        ) : data ? (
          <Suspense fallback={<Skeleton />}>
            <Editor
              height="100%"
              value={data.content}
              language={detectLanguage(path)}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                lineNumbers: 'on',
                renderLineHighlight: 'none',
                wordWrap: 'on',
                bracketPairColorization: { enabled: true },
                smoothScrolling: true,
              }}
            />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-1.5 p-3 font-mono text-[12px]">
      {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k, i) => (
        <div
          key={k}
          className="h-3 animate-pulse rounded bg-muted"
          style={{ width: `${40 + ((i * 17) % 50)}%` }}
        />
      ))}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}
