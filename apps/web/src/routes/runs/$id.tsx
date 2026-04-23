import { ChangedFiles } from '@/components/runs/changed-files';
import { LogViewer } from '@/components/runs/log-viewer';
import { RunStatusBadge } from '@/components/runs/run-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRunStream } from '@/hooks/useRunStream';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { qk } from '@/lib/queryKeys';
import { useRunnerPanelStore } from '@/stores/runnerPanel';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { Ban, Download, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Route as rootRoute } from '../__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs/$id',
  component: RunPage,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData({
      queryKey: qk.run(params.id),
      queryFn: () => api.runs.get(params.id),
    }),
});

function RunPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  useRunStream(id);
  const streamEvents = useRunnerPanelStore((s) => s.events);
  const streamStatus = useRunnerPanelStore((s) => s.status);

  const run = useQuery({
    queryKey: qk.run(id),
    queryFn: () => api.runs.get(id),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'queued' || s === 'running' ? 2000 : false;
    },
  });

  const initialEvents = useQuery({
    queryKey: qk.runEvents(id),
    queryFn: () => api.runs.events(id, { limit: 1000 }),
  });

  const artifacts = useQuery({
    queryKey: qk.runArtifacts(id),
    queryFn: () => api.runs.artifacts(id),
    enabled:
      run.data?.status === 'completed' ||
      run.data?.status === 'cancelled' ||
      run.data?.status === 'failed' ||
      run.data?.status === 'timeout',
  });

  const cancel = useMutation({
    mutationFn: () => api.runs.cancel(id),
    onSuccess: () => toast.success('Cancelación solicitada'),
    onError: (e) => toast.error(humanizeError(e)),
  });

  const rerun = useMutation({
    mutationFn: () => api.runs.rerun(id),
    onSuccess: ({ runId }) => {
      toast.success('Run relanzado');
      navigate({ to: '/runs/$id', params: { id: runId } });
    },
    onError: (e) => toast.error(humanizeError(e)),
  });

  const mergedEvents = useMemo(() => {
    const out = new Map<number, (typeof streamEvents)[number]>();
    for (const ev of initialEvents.data?.items ?? []) out.set(ev.seq, ev);
    for (const ev of streamEvents) out.set(ev.seq, ev);
    return Array.from(out.values()).sort((a, b) => a.seq - b.seq);
  }, [initialEvents.data, streamEvents]);

  if (run.isPending) return <p className="text-sm text-muted-foreground">Cargando run…</p>;
  if (run.isError || !run.data) {
    return <p className="text-sm text-destructive">No se pudo cargar el run.</p>;
  }
  const r = run.data;
  const displayStatus = streamStatus ?? r.status;
  const isActive = displayStatus === 'queued' || displayStatus === 'running';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Run</h1>
            <RunStatusBadge status={displayStatus} />
          </div>
          <p className="font-mono text-xs text-muted-foreground">{r.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <Button variant="outline" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              <Ban className="size-4" />
              {cancel.isPending ? 'Cancelando…' : 'Cancelar'}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => rerun.mutate()} disabled={rerun.isPending}>
                <RotateCcw className="size-4" />
                {rerun.isPending ? 'Relanzando…' : 'Re-run'}
              </Button>
              <Button variant="outline" asChild>
                <a href={api.runs.exportUrl(r.id, 'json')} download>
                  <Download className="size-4" />
                  JSON
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={api.runs.exportUrl(r.id, 'markdown')} download>
                  <Download className="size-4" />
                  Markdown
                </a>
              </Button>
            </>
          )}
        </div>
      </div>

      <StatsRow r={r} />

      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log">Log</TabsTrigger>
          <TabsTrigger value="files">
            Archivos cambiados
            {artifacts.data ? ` (${artifacts.data.items.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <LogViewer events={mergedEvents} autoscroll={isActive} />
        </TabsContent>

        <TabsContent value="files">
          {artifacts.isPending ? (
            <p className="text-sm text-muted-foreground">Cargando archivos…</p>
          ) : artifacts.data ? (
            <ChangedFiles artifacts={artifacts.data.items} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Disponible cuando el run haya terminado.
            </p>
          )}
        </TabsContent>

        <TabsContent value="prompt">
          <Card>
            <CardHeader>
              <CardTitle>Prompt original</CardTitle>
              <CardDescription>Tal como se guardó (ya saneado).</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs">
                {r.prompt}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatsRow({
  r,
}: {
  r: {
    durationMs: number | null;
    exitCode: number | null;
    usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number } | null;
  };
}) {
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <Stat
          label="Duración"
          value={r.durationMs !== null ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}
        />
        <Stat label="Exit code" value={r.exitCode !== null ? String(r.exitCode) : '—'} />
        <Stat
          label="Tokens"
          value={r.usage ? String(r.usage.inputTokens + r.usage.outputTokens) : '—'}
        />
        <Stat
          label="Coste estimado"
          value={r.usage ? `$${r.usage.estimatedCostUsd.toFixed(4)}` : '—'}
        />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm">{value}</div>
      <Separator className="mt-2 sm:hidden" />
    </div>
  );
}
