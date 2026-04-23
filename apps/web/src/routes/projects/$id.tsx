import { RunList } from '@/components/runs/run-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { qk } from '@/lib/queryKeys';
import { ALLOWED_CLAUDE_FLAGS, UpdateProjectInput } from '@cac/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createRoute, useNavigate } from '@tanstack/react-router';
import { Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Route as rootRoute } from '../__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$id',
  component: ProjectDetailPage,
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: qk.project(params.id),
        queryFn: () => api.projects.get(params.id),
      }),
      context.queryClient.ensureQueryData({
        queryKey: qk.projectRuns(params.id),
        queryFn: () => api.runs.byProject(params.id, { limit: 50 }),
      }),
    ]);
  },
});

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const project = useQuery({
    queryKey: qk.project(id),
    queryFn: () => api.projects.get(id),
  });
  const runs = useQuery({
    queryKey: qk.projectRuns(id),
    queryFn: () => api.runs.byProject(id, { limit: 50 }),
    refetchInterval: 5_000,
  });

  const del = useMutation({
    mutationFn: () => api.projects.delete(id),
    onSuccess: () => {
      toast.success('Proyecto eliminado');
      qc.invalidateQueries({ queryKey: qk.projects() });
      navigate({ to: '/projects' });
    },
    onError: (e) => toast.error(humanizeError(e)),
  });

  if (project.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (project.isError || !project.data) {
    return <p className="text-sm text-destructive">No se pudo cargar el proyecto.</p>;
  }

  const p = project.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{p.rootPath}</p>
          {p.description ? (
            <p className="max-w-prose text-sm text-muted-foreground">{p.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link to="/projects/$id/runs/new" params={{ id: p.id }}>
              <Play className="size-4" />
              Lanzar run
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm(`¿Eliminar proyecto "${p.name}"? Borrará sus runs en cascada.`)) {
                del.mutate();
              }
            }}
            disabled={del.isPending}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="settings">Ajustes</TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
              <CardDescription>Últimos runs de este proyecto.</CardDescription>
            </CardHeader>
            <CardContent>
              {runs.isPending ? (
                <p className="text-sm text-muted-foreground">Cargando runs…</p>
              ) : runs.data ? (
                <RunList runs={runs.data.items} emptyMessage="Aún no hay runs. Lanza el primero." />
              ) : (
                <p className="text-sm text-destructive">No se pudieron cargar los runs.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab projectId={p.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const FLAG_OPTIONS = Array.from(ALLOWED_CLAUDE_FLAGS).filter((f) => f !== '--output-format');

function SettingsTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const project = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => api.projects.get(projectId),
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timeoutMin, setTimeoutMin] = useState('30');
  const [model, setModel] = useState('');
  const [allowedFlags, setAllowedFlags] = useState<Set<string>>(new Set());
  const [initialised, setInitialised] = useState(false);

  if (project.data && !initialised) {
    setName(project.data.name);
    setDescription(project.data.description ?? '');
    const cfg = (project.data.claudeConfig ?? {}) as {
      timeoutMs?: number;
      model?: string;
      allowedFlags?: string[];
    };
    if (typeof cfg.timeoutMs === 'number') {
      setTimeoutMin(String(Math.max(1, Math.round(cfg.timeoutMs / 60_000))));
    }
    if (typeof cfg.model === 'string') setModel(cfg.model);
    if (Array.isArray(cfg.allowedFlags)) setAllowedFlags(new Set(cfg.allowedFlags));
    setInitialised(true);
  }

  const save = useMutation({
    mutationFn: () => {
      const claudeConfig: Record<string, unknown> = {};
      const minutes = Number(timeoutMin);
      if (Number.isFinite(minutes) && minutes > 0) {
        claudeConfig.timeoutMs = minutes * 60_000;
      }
      if (model.trim().length > 0) claudeConfig.model = model.trim();
      if (allowedFlags.size > 0) claudeConfig.allowedFlags = Array.from(allowedFlags).sort();

      const parsed = UpdateProjectInput.parse({
        name,
        description: description || undefined,
        // claudeConfig isn't in UpdateProjectInput, but the API accepts extra fields via update()
      });
      return api.projects.update(projectId, {
        ...parsed,
        ...(Object.keys(claudeConfig).length > 0 ? { claudeConfig } : {}),
      } as never);
    },
    onSuccess: () => {
      toast.success('Proyecto actualizado');
      qc.invalidateQueries({ queryKey: qk.project(projectId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
    },
    onError: (e) => toast.error(humanizeError(e)),
  });

  function toggleFlag(flag: string): void {
    setAllowedFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flag)) next.delete(flag);
      else next.add(flag);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Ajustes del proyecto</CardTitle>
          <CardDescription>Nombre, descripción y configuración del runner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Nombre</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">Descripción</Label>
            <Textarea
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-model">Modelo por defecto</Label>
              <Input
                id="p-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="claude-sonnet-4-6"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-timeout">Timeout (minutos)</Label>
              <Input
                id="p-timeout"
                type="number"
                min={1}
                max={120}
                value={timeoutMin}
                onChange={(e) => setTimeoutMin(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Flags permitidos en launch</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {FLAG_OPTIONS.map((flag) => (
                <label
                  key={flag}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={allowedFlags.has(flag)}
                    onChange={() => toggleFlag(flag)}
                  />
                  <code className="font-mono text-xs">{flag}</code>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Si no seleccionas ninguno, se acepta la whitelist global.
            </p>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
