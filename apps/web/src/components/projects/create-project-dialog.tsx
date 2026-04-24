import { DirectoryBrowser } from '@/components/fs/directory-browser';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { qk } from '@/lib/queryKeys';
import { CreateProjectInput } from '@cac/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Mode = 'local' | 'clone';

const REPO_URL_RE = /^https?:\/\/(github\.com|bitbucket\.org)\//;

function extractRepoName(url: string): string {
  const last = url.split('/').pop() ?? '';
  return last.replace(/\.git$/, '');
}

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('local');
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: CreateProjectInput) => api.projects.create(input),
    onSuccess: (project) => {
      toast.success(`Proyecto "${project.name}" creado`);
      qc.invalidateQueries({ queryKey: qk.projects() });
      setOpen(false);
      reset();
    },
    onError: (err) => {
      setError(humanizeError(err));
    },
  });

  function reset() {
    setMode('local');
    setName('');
    setRootPath('');
    setGitUrl('');
    setDescription('');
    setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = CreateProjectInput.safeParse({
      name,
      rootPath,
      description: description || undefined,
      gitUrl: mode === 'clone' && gitUrl ? gitUrl : undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    mutation.mutate(parsed.data);
  }

  /** Called when the user types a URL in the local path field — hints to switch mode. */
  const looksLikeRepoUrl = REPO_URL_RE.test(rootPath);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogTrigger asChild>
          <Button>
            <Plus className="size-4" />
            Nuevo proyecto
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
            <DialogDescription>
              Crea un proyecto local o clona desde un repositorio Git.
            </DialogDescription>
          </DialogHeader>

          {/* Mode selector */}
          <div
            role="group"
            aria-label="Modo de creación"
            className="flex gap-1 rounded-md border border-border p-0.5"
          >
            <button
              type="button"
              onClick={() => setMode('local')}
              aria-pressed={mode === 'local'}
              className={[
                'flex-1 rounded-sm px-3 py-1 text-sm font-medium transition-colors',
                mode === 'local'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              Local
            </button>
            <button
              type="button"
              onClick={() => setMode('clone')}
              aria-pressed={mode === 'clone'}
              className={[
                'flex-1 rounded-sm px-3 py-1 text-sm font-medium transition-colors',
                mode === 'clone'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              Clonar desde URL
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-project"
                autoFocus
                required
              />
            </div>

            {mode === 'local' ? (
              <div className="space-y-2">
                <Label htmlFor="rootPath">Ruta absoluta</Label>
                <div className="flex gap-1.5">
                  <Input
                    id="rootPath"
                    value={rootPath}
                    onChange={(e) => setRootPath(e.target.value)}
                    placeholder="D:/Proyectos/my-project"
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Explorar carpetas"
                    onClick={() => setBrowserOpen(true)}
                  >
                    <FolderOpen className="size-4" />
                  </Button>
                </div>
                {looksLikeRepoUrl && (
                  <p className="text-xs text-muted-foreground">
                    Parece una URL de repositorio.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setGitUrl(rootPath);
                        const autoName = extractRepoName(rootPath);
                        if (autoName && !name) setName(autoName);
                        setRootPath('');
                        setMode('clone');
                      }}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      ¿Cambiar a modo Clonar?
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="gitUrl">URL del repositorio</Label>
                  <Input
                    id="gitUrl"
                    type="url"
                    value={gitUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGitUrl(val);
                      if (!name) {
                        const autoName = extractRepoName(val);
                        if (autoName) setName(autoName);
                      }
                    }}
                    placeholder="https://github.com/user/repo"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destPath">Ruta de destino</Label>
                  <div className="flex gap-1.5">
                    <Input
                      id="destPath"
                      value={rootPath}
                      onChange={(e) => setRootPath(e.target.value)}
                      placeholder="D:/Proyectos/my-project"
                      required
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Explorar carpetas"
                      onClick={() => setBrowserOpen(true)}
                    >
                      <FolderOpen className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? mode === 'clone'
                    ? 'Clonando…'
                    : 'Creando…'
                  : mode === 'clone'
                    ? 'Clonar y crear'
                    : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Directory browser — rendered outside the main Dialog to avoid nesting portals */}
      <DirectoryBrowser
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        onSelect={(path) => {
          setRootPath(path);
          setBrowserOpen(false);
        }}
      />
    </>
  );
}
