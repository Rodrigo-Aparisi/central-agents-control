import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { CLAUDE_INIT_PROMPT } from '@/lib/claude-init';
import { humanizeError } from '@/lib/errors';
import { qk } from '@/lib/queryKeys';
import { useUiStore } from '@/stores/ui';
import type { ClaudeAgentEntry } from '@cac/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Bot, FileText, Loader2, Pencil, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { toast } from 'sonner';

const MonacoEditor = lazy(async () => {
  const { default: Editor } = await import('@monaco-editor/react');
  return { default: Editor };
});

function EditorSkeleton() {
  return (
    <div className="space-y-1.5 p-3 font-mono text-[12px]">
      {['a', 'b', 'c', 'd', 'e', 'f'].map((k, i) => (
        <div
          key={k}
          className="h-3 animate-pulse rounded bg-muted"
          style={{ width: `${40 + ((i * 17) % 50)}%` }}
        />
      ))}
    </div>
  );
}

interface AgentsTabProps {
  projectId: string;
}

export function AgentsTab({ projectId }: AgentsTabProps) {
  const navigate = useNavigate();
  const { data, isPending, isError } = useQuery({
    queryKey: qk.projectClaudeConfig(projectId),
    queryFn: () => api.claudeConfig.get(projectId),
  });

  const [claudeMdOpen, setClaudeMdOpen] = useState(false);
  const [agentEditorOpen, setAgentEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<ClaudeAgentEntry | null>(null);

  const initMutation = useMutation({
    mutationFn: () => api.runs.launch(projectId, { prompt: CLAUDE_INIT_PROMPT }),
    onSuccess: ({ runId }) => {
      toast.success('Inicialización lanzada — siguiendo el progreso…');
      navigate({ to: '/runs/$id', params: { id: runId } });
    },
    onError: (e) => toast.error(humanizeError(e)),
  });

  if (isPending) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">No se pudo cargar la configuración de Claude.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Init quick action */}
      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Inicializar con Claude</p>
            <p className="text-xs text-muted-foreground">
              Analiza el proyecto y genera CLAUDE.md y agentes automáticamente.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                data.claudeMd.exists || data.agents.length > 0
                  ? confirm(
                      'Este proyecto ya tiene CLAUDE.md o agentes. ¿Re-inicializar igualmente? Los archivos existentes se sobreescribirán.',
                    )
                  : true
              ) {
                initMutation.mutate();
              }
            }}
            disabled={initMutation.isPending}
          >
            {initMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {initMutation.isPending ? 'Lanzando…' : 'Inicializar'}
          </Button>
        </CardContent>
      </Card>

      {/* CLAUDE.md */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" aria-hidden />
              <CardTitle className="text-sm">CLAUDE.md</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => setClaudeMdOpen(true)}>
              <Pencil className="size-3.5" />
              {data.claudeMd.exists ? 'Editar' : 'Crear'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.claudeMd.exists ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs font-normal">
                  Configurado
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {data.claudeMd.content.length.toLocaleString()} caracteres
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Instrucciones globales que Claude Code lee automáticamente en cada sesión.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin CLAUDE.md — crea uno para darle contexto e instrucciones permanentes a Claude
              Code.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Agents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-muted-foreground" aria-hidden />
              <CardTitle className="text-sm">Agentes</CardTitle>
              <Badge variant="outline" className="text-xs">
                {data.agents.length}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingAgent(null);
                setAgentEditorOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              Nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin agentes. Los agentes son subagentes especializados en{' '}
              <code className="text-xs">.claude/agents/</code> que Claude Code puede invocar para
              tareas concretas.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.agents.map((agent) => (
                <AgentRow
                  key={agent.filename}
                  projectId={projectId}
                  agent={agent}
                  onEdit={() => {
                    setEditingAgent(agent);
                    setAgentEditorOpen(true);
                  }}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Hooks / settings.json */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" aria-hidden />
            <CardTitle className="text-sm">Hooks</CardTitle>
            <code className="text-[11px] text-muted-foreground">.claude/settings.json</code>
          </div>
        </CardHeader>
        <CardContent>
          {data.settingsJson.exists && data.settingsJson.content ? (
            <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
              {JSON.stringify(data.settingsJson.content, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin configuración local. Se creará automáticamente con permisos por defecto al lanzar
              el primer run.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialogs — conditionally mounted to reset state on each open */}
      {claudeMdOpen && (
        <ClaudeMdEditorDialog
          projectId={projectId}
          initialContent={data.claudeMd.content}
          open={claudeMdOpen}
          onOpenChange={setClaudeMdOpen}
        />
      )}
      {agentEditorOpen && (
        <AgentEditorDialog
          key={editingAgent?.filename ?? '__new__'}
          projectId={projectId}
          agent={editingAgent}
          open={agentEditorOpen}
          onOpenChange={setAgentEditorOpen}
        />
      )}
    </div>
  );
}

// ─── Agent Row ────────────────────────────────────────────────────────────────

function AgentRow({
  projectId,
  agent,
  onEdit,
}: {
  projectId: string;
  agent: ClaudeAgentEntry;
  onEdit: () => void;
}) {
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: () => api.claudeConfig.deleteAgent(projectId, agent.filename),
    onSuccess: () => {
      toast.success(`Agente "${agent.name}" eliminado`);
      qc.invalidateQueries({ queryKey: qk.projectClaudeConfig(projectId) });
    },
    onError: (e) => toast.error(humanizeError(e)),
  });

  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Bot className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="text-sm font-medium">{agent.name}</span>
          <code className="text-[11px] text-muted-foreground">{agent.filename}.md</code>
        </div>
        {agent.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onEdit}
          aria-label="Editar agente"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={() => {
            if (confirm(`¿Eliminar agente "${agent.name}"? Esta acción no se puede deshacer.`))
              del.mutate();
          }}
          disabled={del.isPending}
          aria-label="Eliminar agente"
        >
          {del.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      </div>
    </li>
  );
}

// ─── CLAUDE.md Editor ─────────────────────────────────────────────────────────

function ClaudeMdEditorDialog({
  projectId,
  initialContent,
  open,
  onOpenChange,
}: {
  projectId: string;
  initialContent: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const theme = useUiStore((s) => s.theme);
  const qc = useQueryClient();
  const [content, setContent] = useState(initialContent);

  const save = useMutation({
    mutationFn: () => api.claudeConfig.writeClaude(projectId, { content }),
    onSuccess: () => {
      toast.success('CLAUDE.md guardado');
      qc.invalidateQueries({ queryKey: qk.projectClaudeConfig(projectId) });
      onOpenChange(false);
    },
    onError: (e) => toast.error(humanizeError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm font-semibold">Editar CLAUDE.md</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<EditorSkeleton />}>
            <MonacoEditor
              height="520px"
              language="markdown"
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              value={content}
              onChange={(val) => setContent(val ?? '')}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                wordWrap: 'on',
                lineNumbers: 'on',
                padding: { top: 8, bottom: 8 },
              }}
            />
          </Suspense>
        </div>
        <DialogFooter className="border-t border-border px-4 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Agent Editor ─────────────────────────────────────────────────────────────

function AgentEditorDialog({
  projectId,
  agent,
  open,
  onOpenChange,
}: {
  projectId: string;
  agent: ClaudeAgentEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const theme = useUiStore((s) => s.theme);
  const qc = useQueryClient();
  const [name, setName] = useState(agent?.name ?? '');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [body, setBody] = useState(agent?.body ?? '');

  const isEdit = agent !== null;
  const derivedFilename = isEdit ? agent.filename : slugify(name);
  const canSave = name.trim().length > 0 && (isEdit || derivedFilename.length > 0);

  const save = useMutation({
    mutationFn: () =>
      api.claudeConfig.upsertAgent(projectId, isEdit ? agent.filename : derivedFilename, {
        name: name.trim(),
        description: description.trim() || undefined,
        body,
      }),
    onSuccess: () => {
      toast.success(isEdit ? `Agente "${name}" actualizado` : `Agente "${name}" creado`);
      qc.invalidateQueries({ queryKey: qk.projectClaudeConfig(projectId) });
      onOpenChange(false);
    },
    onError: (e) => toast.error(humanizeError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm font-semibold">
            {isEdit ? `Editar: ${agent.name}` : 'Nuevo agente'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-3 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="agent-name">Nombre</Label>
                <Input
                  id="agent-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Investigador"
                />
                {!isEdit && name && derivedFilename && (
                  <p className="text-xs text-muted-foreground">
                    Archivo: <code className="font-mono">.claude/agents/{derivedFilename}.md</code>
                  </p>
                )}
                {!isEdit && name && !derivedFilename && (
                  <p className="text-xs text-destructive">
                    Nombre no válido — usa letras, números o guiones.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-desc">Descripción</Label>
                <Input
                  id="agent-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Cuándo y para qué usar este agente"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Instrucciones del agente</Label>
              <div className="overflow-hidden rounded-md border border-border">
                <Suspense fallback={<EditorSkeleton />}>
                  <MonacoEditor
                    height="360px"
                    language="markdown"
                    theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                    value={body}
                    onChange={(val) => setBody(val ?? '')}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-border px-4 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !canSave}>
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {save.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear agente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}
