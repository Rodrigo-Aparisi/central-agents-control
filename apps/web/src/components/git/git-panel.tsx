import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { qk } from '@/lib/queryKeys';
import type { GitBranch, GitFileStatus } from '@cac/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Circle,
  Download,
  GitBranch as GitBranchIcon,
  GitCommit,
  Loader2,
  RefreshCw,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

interface GitTabProps {
  projectId: string;
  rootPath: string;
}

export function GitTab({ projectId, rootPath: _rootPath }: GitTabProps) {
  const { data, isPending, isError } = useQuery({
    queryKey: qk.projectGit(projectId),
    queryFn: () => api.git.info(projectId),
    refetchInterval: 30_000,
  });

  if (isPending) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Cargando" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive" role="alert">
        No se pudo cargar la información de Git.
      </p>
    );
  }

  if (!data.isRepo) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <GitBranchIcon className="size-10 opacity-40" aria-hidden />
        <p className="text-sm">Este proyecto no es un repositorio git.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RepoCard projectId={projectId} data={data} />
      <ActionsCard projectId={projectId} data={data} />
      <StatusCard status={data.status} />
      <UserCard user={data.user} />
    </div>
  );
}

// ─── Types inlined because GitInfoResponse shape comes from @cac/shared ─────

type GitInfo = Awaited<ReturnType<typeof api.git.info>>;

// ─── Repo Card ────────────────────────────────────────────────────────────────

function RepoCard({ projectId, data }: { projectId: string; data: GitInfo }) {
  const qc = useQueryClient();

  const checkoutMutation = useMutation({
    mutationFn: (branch: string) => api.git.checkout(projectId, { branch }),
    onSuccess: (res) => {
      toast.success(`Cambiado a rama "${res.branch}"`);
      qc.invalidateQueries({ queryKey: qk.projectGit(projectId) });
    },
    onError: (e) => toast.error(humanizeError(e)),
  });

  const localBranches = data.branches.filter((b: GitBranch) => !b.remote);
  const remoteBranches = data.branches.filter((b: GitBranch) => b.remote);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Repositorio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current branch + selector */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitBranchIcon className="size-4 text-muted-foreground" aria-hidden />
            <Badge variant="outline" className="font-mono text-xs">
              {data.branch ?? 'desconocida'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="branch-select" className="sr-only">
              Cambiar de rama
            </label>
            <select
              id="branch-select"
              aria-label="Cambiar de rama"
              value={data.branch ?? ''}
              disabled={checkoutMutation.isPending}
              onChange={(e) => {
                const val = e.target.value;
                if (val && val !== data.branch) {
                  checkoutMutation.mutate(val);
                }
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {localBranches.length > 0 && (
                <optgroup label="Local">
                  {localBranches.map((b: GitBranch) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {remoteBranches.length > 0 && (
                <optgroup label="Remotas">
                  {remoteBranches.map((b: GitBranch) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {checkoutMutation.isPending && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
            )}
          </div>
        </div>

        {/* Remotes */}
        {data.remotes.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Remotes</p>
            {data.remotes.map((r) => (
              <div key={r.name} className="flex items-baseline gap-1.5 text-xs">
                <span className="font-semibold">{r.name}</span>
                <span className="text-muted-foreground">→</span>
                <code className="break-all font-mono text-[11px] text-muted-foreground">
                  {r.url}
                </code>
              </div>
            ))}
          </div>
        )}

        {/* Ahead / behind */}
        {(data.ahead > 0 || data.behind > 0) && (
          <p className="text-xs text-muted-foreground">
            {data.ahead > 0 && <span>↑ {data.ahead} ahead</span>}
            {data.ahead > 0 && data.behind > 0 && <span className="mx-1">·</span>}
            {data.behind > 0 && <span>↓ {data.behind} behind</span>}
          </p>
        )}

        {/* Last commit */}
        {data.lastCommit && (
          <>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Último commit</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <GitCommit className="size-3.5 text-muted-foreground" aria-hidden />
                <code className="font-mono text-[11px]">{data.lastCommit.hash.slice(0, 7)}</code>
                <span className="truncate font-medium">{data.lastCommit.message}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {data.lastCommit.author} ·{' '}
                {new Date(data.lastCommit.date).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Actions Card ─────────────────────────────────────────────────────────────

function ActionsCard({ projectId, data: _data }: { projectId: string; data: GitInfo }) {
  const qc = useQueryClient();

  const pullMutation = useMutation({
    mutationFn: () => api.git.pull(projectId),
    onSuccess: (res) => {
      toast.success(res.summary || 'Pull completado');
      qc.invalidateQueries({ queryKey: qk.projectGit(projectId) });
    },
    onError: (e) => toast.error(humanizeError(e)),
  });

  const fetchMutation = useMutation({
    mutationFn: () => api.git.fetch(projectId),
    onSuccess: () => {
      toast.success('Fetch completado');
      qc.invalidateQueries({ queryKey: qk.projectGit(projectId) });
    },
    onError: (e) => toast.error(humanizeError(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Acciones</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => pullMutation.mutate()}
          disabled={pullMutation.isPending || fetchMutation.isPending}
          aria-label="Pull desde el remoto"
        >
          {pullMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Pull
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchMutation.mutate()}
          disabled={fetchMutation.isPending || pullMutation.isPending}
          aria-label="Fetch desde el remoto"
        >
          {fetchMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Fetch
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Status Card ──────────────────────────────────────────────────────────────

function StatusCard({ status }: { status: GitFileStatus[] }) {
  const staged = status.filter((f) => f.index !== ' ' && f.index !== '?');
  const unstaged = status.filter((f) => f.index === ' ' && f.working !== ' ');
  const untracked = status.filter((f) => f.index === '?');

  const all = [
    ...staged.map((f) => ({ ...f, group: 'Staged' as const })),
    ...unstaged.map((f) => ({ ...f, group: 'Unstaged' as const })),
    ...untracked.map((f) => ({ ...f, group: 'Sin seguimiento' as const })),
  ];

  const shown = all.slice(0, 20);
  const overflow = all.length - shown.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Estado de archivos</CardTitle>
      </CardHeader>
      <CardContent>
        {all.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 text-green-500 dark:text-green-400" aria-hidden />
            Directorio de trabajo limpio
          </div>
        ) : (
          <div className="space-y-3">
            {(['Staged', 'Unstaged', 'Sin seguimiento'] as const).map((group) => {
              const items = shown.filter((f) => f.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{group}</p>
                  <ul className="space-y-0.5">
                    {items.map((f) => (
                      <li key={f.path} className="flex items-center gap-2 text-xs">
                        <FileStatusDot index={f.index} working={f.working} />
                        <span className="truncate font-mono">{f.path}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {overflow > 0 && (
              <p className="text-xs text-muted-foreground">+ {overflow} más</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FileStatusDot({ index, working }: { index: string; working: string }) {
  const char = index !== ' ' && index !== '?' ? index : working;
  const colorClass =
    char === 'A'
      ? 'text-green-500 dark:text-green-400'
      : char === 'M'
        ? 'text-amber-500 dark:text-amber-400'
        : char === 'D'
          ? 'text-destructive'
          : char === '?'
            ? 'text-muted-foreground'
            : 'text-muted-foreground';

  return <Circle className={`size-2 fill-current ${colorClass}`} aria-hidden />;
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({ user }: { user: { name: string | null; email: string | null } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Usuario git</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-2 text-sm">
          <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-0.5">
            <p>{user.name ?? <span className="text-muted-foreground">No configurado</span>}</p>
            <p className="text-xs text-muted-foreground">
              {user.email ?? 'Sin email configurado'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
