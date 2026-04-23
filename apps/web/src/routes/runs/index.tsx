import { RunList } from '@/components/runs/run-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  component: RunsIndexPage,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: qk.runs(),
      queryFn: () => api.runs.list({ limit: 50 }),
    }),
});

function RunsIndexPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: qk.runs(),
    queryFn: () => api.runs.list({ limit: 50 }),
    refetchInterval: 5_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Runs recientes</h1>
        <p className="text-sm text-muted-foreground">Últimos 50 runs de todos los proyectos.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial global</CardTitle>
          <CardDescription>Actualizado cada 5s.</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">Error al cargar.</p>
          ) : (
            <RunList runs={data?.items ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
