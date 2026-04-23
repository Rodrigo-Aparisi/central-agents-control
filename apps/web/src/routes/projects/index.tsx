import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';
import { Link, createRoute } from '@tanstack/react-router';
import { FolderOpen } from 'lucide-react';
import { Route as rootRoute } from '../__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsPage,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: qk.projects(),
      queryFn: () => api.projects.list({ limit: 50 }),
    }),
});

function ProjectsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: qk.projects(),
    queryFn: () => api.projects.list({ limit: 50 }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Orquesta runs de Claude Code sobre proyectos locales.
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {isPending ? <LoadingGrid /> : null}
      {isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            No se pudieron cargar los proyectos.
          </CardContent>
        </Card>
      ) : null}
      {data && data.items.length === 0 ? <EmptyState /> : null}

      {data && data.items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((p) => (
            <Link key={p.id} to="/projects/$id" params={{ id: p.id }} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="size-4 text-muted-foreground" />
                    {p.name}
                  </CardTitle>
                  <CardDescription className="truncate font-mono text-xs">
                    {p.rootPath}
                  </CardDescription>
                </CardHeader>
                {p.description ? (
                  <CardContent className="pt-0">
                    <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  </CardContent>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const LOADING_KEYS = ['a', 'b', 'c'];

function LoadingGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {LOADING_KEYS.map((k) => (
        <Card key={k}>
          <CardHeader>
            <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <FolderOpen className="size-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Aún no hay proyectos</p>
          <p className="text-sm text-muted-foreground">Crea uno para lanzar tu primer run.</p>
        </div>
        <CreateProjectDialog />
      </CardContent>
    </Card>
  );
}
