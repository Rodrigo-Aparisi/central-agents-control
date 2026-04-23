import { useThemeColors } from '@/hooks/useThemeColors';
import type { StatsDailyPoint } from '@cac/shared';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

interface Props {
  days: StatsDailyPoint[];
  totals: { runs: number; completed: number; failed: number };
}

export function StatusDonut({ days, totals }: Props) {
  const c = useThemeColors();

  const data = useMemo(() => {
    // Extrapolate from totals (completed/failed) and infer the remainder
    // as "other" (queued/running/cancelled/timeout aggregated — the API
    // doesn't break them down further for the MVP aggregation).
    const completed = totals.completed;
    const failed = totals.failed;
    const other = Math.max(0, totals.runs - completed - failed);
    // Keep days around to satisfy the callsite even if we derive from totals.
    void days;
    return [
      { name: 'Completados', value: completed, color: c.statusCompleted },
      { name: 'Fallidos', value: failed, color: c.statusFailed },
      { name: 'Otros', value: other, color: c.mutedForeground },
    ].filter((d) => d.value > 0);
  }, [days, totals, c]);

  if (totals.runs === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Sin runs en el periodo.
      </div>
    );
  }

  return (
    <div className="grid h-[200px] grid-cols-[1fr_160px] items-center gap-4">
      <div className="relative h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={2}
              stroke={c.card}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-[22px] leading-none">{totals.runs}</span>
          <span className="micro mt-1">Runs</span>
        </div>
      </div>
      <ul className="space-y-1.5 font-mono text-[11px]">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: d.color }}
              aria-hidden
            />
            <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
            <span className="tnum text-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
