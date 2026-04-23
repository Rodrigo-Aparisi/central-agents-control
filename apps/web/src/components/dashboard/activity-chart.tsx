import { useThemeColors } from '@/hooks/useThemeColors';
import type { StatsDailyPoint } from '@cac/shared';
import { useMemo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Props {
  days: StatsDailyPoint[];
}

interface ChartRow {
  date: string;
  label: string;
  runs: number;
  tokens: number;
  tokensAcc: number;
}

export function ActivityChart({ days }: Props) {
  const c = useThemeColors();

  const data = useMemo<ChartRow[]>(() => {
    let acc = 0;
    return days.map((d) => {
      const tokens = d.inputTokens + d.outputTokens;
      acc += tokens;
      return {
        date: d.date,
        label: d.date.slice(5),
        runs: d.runs,
        tokens,
        tokensAcc: acc,
      };
    });
  }, [days]);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Sin actividad en el periodo.
      </div>
    );
  }

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke={c.ruleSoft} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: c.mutedForeground }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: c.mutedForeground }}
            tickLine={false}
            axisLine={false}
            width={28}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: c.mutedForeground }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={formatTokens}
          />
          <Tooltip content={<ActivityTooltip />} cursor={{ fill: c.ruleSoft, opacity: 0.4 }} />
          <Bar
            yAxisId="left"
            dataKey="runs"
            fill={c.chart1}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
          <Area
            yAxisId="right"
            dataKey="tokensAcc"
            fill={c.chart2}
            fillOpacity={0.06}
            stroke="none"
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            dataKey="tokensAcc"
            stroke={c.chart2}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: c.chart2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartRow; dataKey: string; value: number }>;
  label?: string;
}

function ActivityTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rule space-y-1 border bg-card px-3 py-2 font-mono text-[11px] shadow-[var(--elev-2)]">
      <div className="micro">{row.date}</div>
      <div className="tnum flex justify-between gap-4">
        <span className="text-muted-foreground">runs</span>
        <span className="text-foreground">{row.runs}</span>
      </div>
      <div className="tnum flex justify-between gap-4">
        <span className="text-muted-foreground">tokens</span>
        <span className="text-foreground">{formatTokens(row.tokens)}</span>
      </div>
      <div className="tnum flex justify-between gap-4">
        <span className="text-muted-foreground">acc</span>
        <span className="text-foreground">{formatTokens(row.tokensAcc)}</span>
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
