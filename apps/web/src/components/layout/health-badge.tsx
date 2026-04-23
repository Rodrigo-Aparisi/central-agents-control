import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';

export function HealthBadge() {
  const { data, isPending, isError } = useQuery({
    queryKey: qk.health(),
    queryFn: api.health,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  if (isPending) {
    return (
      <Badge variant="muted" className="gap-1.5">
        <CircleAlert className="size-3" />…
      </Badge>
    );
  }

  if (isError || !data) {
    return (
      <Badge variant="destructive" className="gap-1.5">
        <CircleX className="size-3" />
        offline
      </Badge>
    );
  }

  const healthy = data.status === 'ok';
  const icon = healthy ? <CircleCheck className="size-3" /> : <CircleAlert className="size-3" />;
  const variant = healthy ? 'success' : 'warning';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className="gap-1.5">
          {icon}
          {data.status}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5">
          <div>DB: {data.db}</div>
          <div>Redis: {data.redis}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
