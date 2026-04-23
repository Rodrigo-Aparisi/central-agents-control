import { Badge } from '@/components/ui/badge';
import type { RunStatus } from '@cac/shared';

const MAP: Record<
  RunStatus,
  {
    variant: 'default' | 'success' | 'warning' | 'destructive' | 'muted' | 'secondary';
    label: string;
  }
> = {
  queued: { variant: 'muted', label: 'En cola' },
  running: { variant: 'default', label: 'Corriendo' },
  completed: { variant: 'success', label: 'Completado' },
  cancelled: { variant: 'secondary', label: 'Cancelado' },
  failed: { variant: 'destructive', label: 'Fallido' },
  timeout: { variant: 'warning', label: 'Timeout' },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const { variant, label } = MAP[status];
  return (
    <Badge variant={variant} className="capitalize">
      {status === 'running' ? (
        <span className="relative mr-1 flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground/60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary-foreground" />
        </span>
      ) : null}
      {label}
    </Badge>
  );
}
