import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Link, createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ['cac', 'stats', 'global', { days: 30 }],
      queryFn: () => api.stats.global({ days: 30 }),
    }),
});

function DashboardPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['cac', 'stats', 'global', { days: 30 }],
    queryFn: () => api.stats.global({ days: 30 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Últimos 30 días.</p>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : isError || !data ? (
        <p className="text-sm text-destructive">No se pudieron cargar las métricas.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Runs" value={String(data.totals.runs)} />
            <Stat label="Completados" value={String(data.totals.completed)} />
            <Stat label="Fallidos" value={String(data.totals.failed)} />
            <Stat label="Coste estimado" value={`$${data.totals.estimatedCostUsd.toFixed(2)}`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top proyectos</CardTitle>
              <CardDescription>Por número de runs.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.topProjects.map((p) => (
                    <li key={p.projectId} className="flex items-center justify-between py-2">
                      <Link
                        to="/projects/$id"
                        params={{ id: p.projectId }}
                        className="truncate text-sm hover:text-primary"
                      >
                        {p.name}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.runs} runs · {p.inputTokens + p.outputTokens} tokens
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actividad diaria</CardTitle>
              <CardDescription>Visualización con Recharts pendiente en Fase 6b.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.days.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin actividad en el periodo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium">Fecha</th>
                        <th className="text-right font-medium">Runs</th>
                        <th className="text-right font-medium">Completados</th>
                        <th className="text-right font-medium">Fallidos</th>
                        <th className="text-right font-medium">Tokens</th>
                        <th className="text-right font-medium">Coste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.days.map((d) => (
                        <tr key={d.date} className="border-t border-border">
                          <td className="py-1 font-mono text-xs">{d.date}</td>
                          <td className="py-1 text-right">{d.runs}</td>
                          <td className="py-1 text-right">{d.completed}</td>
                          <td className="py-1 text-right">{d.failed}</td>
                          <td className="py-1 text-right">{d.inputTokens + d.outputTokens}</td>
                          <td className="py-1 text-right">${d.estimatedCostUsd.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 font-mono text-2xl">{value}</div>
      </CardContent>
    </Card>
  );
}
