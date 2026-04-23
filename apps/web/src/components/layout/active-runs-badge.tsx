import { Badge } from '@/components/ui/badge';
import { useActiveRunsStore } from '@/stores/activeRuns';
import { Link } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';

export function ActiveRunsBadge() {
  const count = useActiveRunsStore((s) => s.active.size);
  if (count === 0) return null;

  return (
    <Link to="/runs">
      <Badge variant="default" className="gap-1.5">
        <Loader2 className="size-3 animate-spin" />
        {count} activo{count === 1 ? '' : 's'}
      </Badge>
    </Link>
  );
}
