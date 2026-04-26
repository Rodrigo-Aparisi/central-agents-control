import { ActivityChart } from '@/components/dashboard/activity-chart';
import { type RangeDays, RangeSelector } from '@/components/dashboard/range-selector';
import { StatusDonut } from '@/components/dashboard/status-donut';
import { TopProjects } from '@/components/dashboard/top-projects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { useState } from 'react';
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
  const [days, setDays] = useState<RangeDays>(30);

  const { data, isPending, isError } = useQuery({
    queryKey: ['cac', 'stats', 'global', { days }],
    queryFn: () => api.stats.global({ days }),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6 [&>*]:animate-[fadeSlideUp_240ms_ease-out_both]">
      <style>{staggerStyles}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="micro mt-1">Últimos {days === 1 ? '24 horas' : `${days} días`}</p>
        </div>
        <RangeSelector value={days} onChange={setDays} />
      </div>

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {['a', 'b', 'c', 'd'].map((k) => (
            <Card key={k}>
              <CardContent className="h-[88px] animate-pulse bg-muted/30" />
            </Card>
          ))}
        </div>
      ) : isError || !data ? (
        <p className="text-sm text-destructive">No se pudieron cargar las métricas.</p>
      ) : (
        <>
          {/* Token KPIs — protagonistas */}
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiPrimary
              label="Tokens totales"
              value={formatTokens(data.totals.inputTokens + data.totals.outputTokens)}
            />
            <Kpi label="Input tokens" value={formatTokens(data.totals.inputTokens)} />
            <Kpi label="Output tokens" value={formatTokens(data.totals.outputTokens)} />
          </div>

          {/* Meta KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Coste estimado" value={`$${data.totals.estimatedCostUsd.toFixed(2)}`} />
            <Kpi label="Runs" value={data.totals.runs.toString()} />
            <Kpi label="Completados" value={data.totals.completed.toString()} />
            <Kpi label="Fallidos" value={data.totals.failed.toString()} />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">Actividad</CardTitle>
              <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <LegendDot color="var(--color-chart-2)" label="Tokens diarios" />
                <LegendDot color="var(--color-chart-1)" label="Runs" />
              </div>
            </CardHeader>
            <CardContent>
              <ActivityChart days={data.days} />
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Distribución</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusDonut days={data.days} totals={data.totals} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Top proyectos</CardTitle>
              </CardHeader>
              <CardContent>
                <TopProjects topProjects={data.topProjects} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex h-[88px] flex-col justify-between px-5 py-4">
        <span className="micro">{label}</span>
        <span className="tnum text-[28px] font-medium leading-none">{value}</span>
      </CardContent>
    </Card>
  );
}

function KpiPrimary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-[var(--color-chart-2)]/30 bg-[var(--color-chart-2)]/5">
      <CardContent className="flex h-[88px] flex-col justify-between px-5 py-4">
        <span className="micro text-[var(--color-chart-2)]">{label}</span>
        <span className="tnum text-[32px] font-semibold leading-none text-[var(--color-chart-2)]">
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

const staggerStyles = `
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
  div.space-y-6 > :nth-child(1) { animation-delay: 0ms; }
  div.space-y-6 > :nth-child(2) { animation-delay: 40ms; }
  div.space-y-6 > :nth-child(3) { animation-delay: 80ms; }
  div.space-y-6 > :nth-child(4) { animation-delay: 120ms; }
  div.space-y-6 > :nth-child(5) { animation-delay: 160ms; }
`;
