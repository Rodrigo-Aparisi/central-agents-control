import { AgentsTab } from '@/components/agents/agents-tab';
import { ChatPanel } from '@/components/chat/chat-panel';
import { ActivityChart } from '@/components/dashboard/activity-chart';
import { FileBrowser } from '@/components/files/file-browser';
import { GitTab } from '@/components/git/git-panel';
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
import { Copy, Play, Trash2 } from 'lucide-react';
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

  const project = useQuery({
    queryKey: qk.project(id),
    queryFn: () => api.projects.get(id),
  });
  const runs = useQuery({
    queryKey: qk.projectRuns(id),
    queryFn: () => api.runs.byProject(id, { limit: 50 }),
    refetchInterval: 5_000,
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
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="git">Git</TabsTrigger>
          <TabsTrigger value="agents">Agentes</TabsTrigger>
          <TabsTrigger value="settings">Ajustes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ProjectOverviewTab projectId={p.id} />
        </TabsContent>

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

        <TabsContent value="chat" className="mt-0">
          <ChatPanel projectId={p.id} />
        </TabsContent>

        <TabsContent value="files">
          <FileBrowser projectId={p.id} rootPath={p.rootPath} />
        </TabsContent>

        <TabsContent value="git">
          <GitTab projectId={p.id} rootPath={p.rootPath} />
        </TabsContent>

        <TabsContent value="agents">
          <AgentsTab projectId={p.id} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab projectId={p.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function ProjectOverviewTab({ projectId }: { projectId: string }) {
  const stats = useQuery({
    queryKey: qk.projectStats(projectId, 30),
    queryFn: () => api.stats.byProject(projectId, { days: 30 }),
    refetchInterval: 60_000,
  });

  if (stats.isPending) {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {['a', 'b', 'c', 'd'].map((k) => (
            <Card key={k}>
              <CardContent className="h-[88px] animate-pulse bg-muted/30" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats.data) {
    return <p className="text-sm text-destructive">No se pudieron cargar las métricas.</p>;
  }

  const t = stats.data.totals;
  const totalTokens = t.inputTokens + t.outputTokens;

  return (
    <div className="space-y-4">
      {/* Token KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-[var(--color-chart-2)]/30 bg-[var(--color-chart-2)]/5">
          <CardContent className="flex h-[88px] flex-col justify-between px-5 py-4">
            <span className="micro text-[var(--color-chart-2)]">Tokens totales</span>
            <span className="tnum text-[32px] font-semibold leading-none text-[var(--color-chart-2)]">
              {fmtTokens(totalTokens)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-[88px] flex-col justify-between px-5 py-4">
            <span className="micro">Input tokens</span>
            <span className="tnum text-[28px] font-medium leading-none">{fmtTokens(t.inputTokens)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-[88px] flex-col justify-between px-5 py-4">
            <span className="micro">Output tokens</span>
            <span className="tnum text-[28px] font-medium leading-none">{fmtTokens(t.outputTokens)}</span>
          </CardContent>
        </Card>
      </div>

      {/* Meta KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex h-[88px] flex-col justify-between px-5 py-4">
            <span className="micro">Coste estimado</span>
            <span className="tnum text-[28px] font-medium leading-none">
              ${t.estimatedCostUsd.toFixed(2)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-[88px] flex-col justify-between px-5 py-4">
            <span className="micro">Runs totales</span>
            <span className="tnum text-[28px] font-medium leading-none">{t.runs}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-[88px] flex-col justify-between px-5 py-4">
            <span className="micro">Completados / Fallidos</span>
            <span className="tnum text-[28px] font-medium leading-none">
              <span className="text-[var(--color-status-completed)]">{t.completed}</span>
              <span className="text-muted-foreground text-[20px]"> / </span>
              <span className="text-[var(--color-status-failed)]">{t.failed}</span>
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Activity chart */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Actividad (últimos 30 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityChart days={stats.data.days} />
        </CardContent>
      </Card>
    </div>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_MODELS = [
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7 — más capaz' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — equilibrado' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — rápido' },
] as const;

const FLAG_OPTIONS = Array.from(ALLOWED_CLAUDE_FLAGS).filter((f) => f !== '--output-format');

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const project = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => api.projects.get(projectId),
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [timeoutMin, setTimeoutMin] = useState('30');
  const [maxTurns, setMaxTurns] = useState('');
  const [allowedFlags, setAllowedFlags] = useState<Set<string>>(new Set());
  const [initialised, setInitialised] = useState(false);

  if (project.data && !initialised) {
    setName(project.data.name);
    setDescription(project.data.description ?? '');
    const cfg = (project.data.claudeConfig ?? {}) as {
      timeoutMs?: number;
      model?: string;
      allowedFlags?: string[];
      maxTurns?: number;
    };
    if (typeof cfg.timeoutMs === 'number') {
      setTimeoutMin(String(Math.max(1, Math.round(cfg.timeoutMs / 60_000))));
    }
    if (typeof cfg.model === 'string') {
      if (PRESET_MODELS.some((m) => m.id === cfg.model)) {
        setModel(cfg.model);
      } else {
        setModel('custom');
        setCustomModel(cfg.model);
      }
    }
    if (Array.isArray(cfg.allowedFlags)) setAllowedFlags(new Set(cfg.allowedFlags));
    if (typeof cfg.maxTurns === 'number') setMaxTurns(String(cfg.maxTurns));
    setInitialised(true);
  }

  const save = useMutation({
    mutationFn: () => {
      const claudeConfig: Record<string, unknown> = {};
      const minutes = Number(timeoutMin);
      if (Number.isFinite(minutes) && minutes > 0) claudeConfig.timeoutMs = minutes * 60_000;
      const effectiveModel = model === 'custom' ? customModel.trim() : model;
      if (effectiveModel.length > 0) claudeConfig.model = effectiveModel;
      if (allowedFlags.size > 0) claudeConfig.allowedFlags = Array.from(allowedFlags).sort();
      const turns = Number(maxTurns);
      if (Number.isFinite(turns) && turns > 0) claudeConfig.maxTurns = turns;

      const parsed = UpdateProjectInput.safeParse({
        name,
        description: description || undefined,
        claudeConfig: Object.keys(claudeConfig).length > 0 ? claudeConfig : null,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      }
      return api.projects.update(projectId, parsed.data);
    },
    onSuccess: () => {
      toast.success('Proyecto actualizado');
      qc.invalidateQueries({ queryKey: qk.project(projectId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
    },
    onError: (e) => toast.error(humanizeError(e)),
  });

  const del = useMutation({
    mutationFn: () => api.projects.delete(projectId),
    onSuccess: () => {
      toast.success('Proyecto eliminado');
      qc.invalidateQueries({ queryKey: qk.projects() });
      navigate({ to: '/projects' });
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

  const p = project.data;

  return (
    <div className="space-y-4">
      {/* Project Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Información del proyecto</CardTitle>
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
              rows={3}
            />
          </div>
          {p && (
            <div className="space-y-1.5">
              <Label>Ruta del proyecto</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
                  {p.rootPath}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2"
                  onClick={() =>
                    navigator.clipboard.writeText(p.rootPath).then(
                      () => toast.success('Ruta copiada'),
                      () => {},
                    )
                  }
                  aria-label="Copiar ruta"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Creado{' '}
                {new Date(p.createdAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                · Actualizado{' '}
                {new Date(p.updatedAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar información'}
          </Button>
        </CardContent>
      </Card>

      {/* Runner Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Configuración del runner</CardTitle>
          <CardDescription className="text-xs">
            Defaults aplicados al lanzar un run desde este proyecto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-model">Modelo por defecto</Label>
            <select
              id="p-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— Global (claude-sonnet-4-6) —</option>
              {PRESET_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              <option value="custom">Personalizado…</option>
            </select>
            {model === 'custom' && (
              <Input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="claude-sonnet-4-6"
                className="font-mono text-sm"
              />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-timeout">Timeout por defecto (min)</Label>
              <Input
                id="p-timeout"
                type="number"
                min={1}
                max={120}
                value={timeoutMin}
                onChange={(e) => setTimeoutMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-maxturns">
                Max turns{' '}
                <span className="text-xs font-normal text-muted-foreground">(iteraciones)</span>
              </Label>
              <Input
                id="p-maxturns"
                type="number"
                min={1}
                max={200}
                value={maxTurns}
                onChange={(e) => setMaxTurns(e.target.value)}
                placeholder="Sin límite"
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
            {save.isPending ? 'Guardando…' : 'Guardar configuración'}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Zona de peligro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Eliminar el proyecto borrará en cascada todos sus runs, eventos y artefactos. Esta
            acción no se puede deshacer.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (
                confirm(
                  `¿Eliminar el proyecto "${name}"?\n\nSe borrarán todos sus runs en cascada. Esta acción no se puede deshacer.`,
                )
              )
                del.mutate();
            }}
            disabled={del.isPending}
          >
            <Trash2 className="size-4" />
            {del.isPending ? 'Eliminando…' : 'Eliminar proyecto'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
