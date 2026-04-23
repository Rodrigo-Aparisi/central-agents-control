import { Badge } from '@/components/ui/badge';
import type { RunStatus } from '@cac/shared';
import { CheckCircle2, CircleDashed, CircleMinus, Clock, Loader2, XCircle } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'muted' | 'secondary';

interface StatusDef {
  variant: Variant;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  spin?: boolean;
}

const MAP: Record<RunStatus, StatusDef> = {
  queued: { variant: 'muted', label: 'En cola', Icon: CircleDashed },
  running: { variant: 'default', label: 'Corriendo', Icon: Loader2, spin: true },
  completed: { variant: 'success', label: 'Completado', Icon: CheckCircle2 },
  cancelled: { variant: 'secondary', label: 'Cancelado', Icon: CircleMinus },
  failed: { variant: 'destructive', label: 'Fallido', Icon: XCircle },
  timeout: { variant: 'warning', label: 'Timeout', Icon: Clock },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const { variant, label, Icon, spin } = MAP[status];
  return (
    <Badge variant={variant} className="tnum">
      <Icon className={`size-3 ${spin ? 'animate-spin' : ''}`} strokeWidth={1.75} aria-hidden />
      {label}
    </Badge>
  );
}
