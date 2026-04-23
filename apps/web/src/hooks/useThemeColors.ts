import { readToken } from '@/lib/theme-tokens';
import { useUiStore } from '@/stores/ui';
import { useMemo } from 'react';

export interface ThemeColors {
  foreground: string;
  mutedForeground: string;
  ruleSoft: string;
  card: string;
  border: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  statusQueued: string;
  statusRunning: string;
  statusCompleted: string;
  statusCancelled: string;
  statusFailed: string;
  statusTimeout: string;
}

function snapshot(): ThemeColors {
  return {
    foreground: readToken('--foreground'),
    mutedForeground: readToken('--muted-foreground'),
    ruleSoft: readToken('--rule-soft'),
    card: readToken('--card'),
    border: readToken('--border'),
    chart1: readToken('--chart-1'),
    chart2: readToken('--chart-2'),
    chart3: readToken('--chart-3'),
    chart4: readToken('--chart-4'),
    chart5: readToken('--chart-5'),
    statusQueued: readToken('--status-queued'),
    statusRunning: readToken('--status-running'),
    statusCompleted: readToken('--status-completed'),
    statusCancelled: readToken('--status-cancelled'),
    statusFailed: readToken('--status-failed'),
    statusTimeout: readToken('--status-timeout'),
  };
}

/** Keeps chart/runtime colours in sync with the CSS tokens when the theme flips. */
export function useThemeColors(): ThemeColors {
  const theme = useUiStore((s) => s.theme);
  // The snapshot reads computed styles from `documentElement`, which the store's
  // `setTheme()` mutates synchronously before the state change fires. Passing
  // `theme` through useMemo makes the dependency explicit for Biome / React.
  return useMemo(() => {
    void theme;
    return snapshot();
  }, [theme]);
}
