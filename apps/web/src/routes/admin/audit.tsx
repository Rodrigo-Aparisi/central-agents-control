import { Button } from '@/components/ui/button';
import { guardAdmin, guardAuth } from '@/hooks/useAuthGuard';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { qk } from '@/lib/queryKeys';
import type { AuditEventRow, UserRow } from '@cac/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Route as rootRoute } from '../__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/audit',
  beforeLoad: async ({ location }) => {
    await guardAuth(location.pathname);
    guardAdmin();
  },
  component: AdminAuditPage,
});

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function AuditRow({ event, users }: { event: AuditEventRow; users: UserRow[] }) {
  const userEmail = users.find((u) => u.id === event.userId)?.email ?? event.userId ?? '—';

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3 text-xs text-muted-foreground">
        <span
          title={formatTimestamp(event.timestamp)}
          aria-label={formatTimestamp(event.timestamp)}
        >
          {relativeTime(event.timestamp)}
        </span>
      </td>
      <td className="max-w-[160px] truncate px-4 py-3 text-sm" title={userEmail}>
        {userEmail}
      </td>
      <td className="px-4 py-3 font-mono text-xs">{event.action}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{event.resource}</td>
      <td
        className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-muted-foreground"
        title={event.resourceId ?? undefined}
      >
        {event.resourceId ?? '—'}
      </td>
      <td
        className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground"
        title={event.detail ?? undefined}
      >
        {event.detail ?? '—'}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{event.ip ?? '—'}</td>
    </tr>
  );
}

function AdminAuditPage() {
  const [filterUserId, setFilterUserId] = useState<string>('');

  const usersQuery = useQuery({
    queryKey: qk.adminUsers(),
    queryFn: () => api.admin.users.list(),
  });

  const auditQuery = useInfiniteQuery({
    queryKey: qk.adminAudit(filterUserId ? { userId: filterUserId } : undefined),
    queryFn: ({ pageParam }) =>
      api.admin.audit.list({
        userId: filterUserId || undefined,
        cursor: pageParam as string | undefined,
        limit: 50,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const allEvents = auditQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const users = usersQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
          <p className="text-sm text-muted-foreground">Registro de acciones de usuarios.</p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="audit-user-filter" className="text-sm text-muted-foreground sr-only">
            Filtrar por usuario
          </label>
          <select
            id="audit-user-filter"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Filtrar por usuario"
          >
            <option value="">Todos los usuarios</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {auditQuery.isPending && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Cargando eventos…
        </div>
      )}

      {auditQuery.isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {humanizeError(auditQuery.error)}
        </div>
      )}

      {!auditQuery.isPending && !auditQuery.isError && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[800px] text-sm" aria-label="Registro de auditoría">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Cuando</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Acción</th>
                  <th className="px-4 py-3 font-medium">Recurso</th>
                  <th className="px-4 py-3 font-medium">ID recurso</th>
                  <th className="px-4 py-3 font-medium">Detalle</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {allEvents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No hay eventos de auditoría.
                    </td>
                  </tr>
                )}
                {allEvents.map((event) => (
                  <AuditRow key={event.id} event={event} users={users} />
                ))}
              </tbody>
            </table>
          </div>

          {auditQuery.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => auditQuery.fetchNextPage()}
                disabled={auditQuery.isFetchingNextPage}
                aria-label="Cargar más eventos de auditoría"
              >
                {auditQuery.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
