import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { qk } from '@/lib/queryKeys';
import type { DirEntry } from '@cac/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronUp, FolderOpen, FolderPlus, HardDrive, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';

export interface DirectoryBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function DirectoryBrowser({
  open,
  onOpenChange,
  onSelect,
  initialPath,
}: DirectoryBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string | undefined>(initialPath);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [mkdirError, setMkdirError] = useState<string | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: qk.fsBrowse(currentPath),
    queryFn: () => api.fs.browse(currentPath),
    enabled: open,
  });

  const mkdirMutation = useMutation({
    mutationFn: (name: string) =>
      api.fs.mkdir({ parentPath: data?.path ?? currentPath ?? '', name }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: qk.fsBrowse(currentPath) });
      setCreatingFolder(false);
      setNewFolderName('');
      setMkdirError(null);
      // Navigate into the newly created folder
      setCurrentPath(res.path);
    },
    onError: (err) => setMkdirError(humanizeError(err)),
  });

  const entries = (data?.entries ?? []).filter(
    (e: DirEntry) => e.type === 'directory' || e.type === 'drive',
  );

  const isRoot = data?.parent == null;
  const displayPath = data?.path ?? currentPath ?? null;
  // Can only create folders when we're inside a real directory (not at the drives list)
  const canCreate = !!displayPath && displayPath !== '';

  function buildBreadcrumbs(): { label: string; path: string }[] {
    if (!displayPath) return [];
    const normalised = displayPath.replace(/\\/g, '/');
    const parts = normalised.split('/').filter(Boolean);
    const crumbs: { label: string; path: string }[] = [];
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part.includes(':') ? `${part}/` : part;
      crumbs.push({ label: part, path: acc });
    }
    return crumbs;
  }

  const breadcrumbs = buildBreadcrumbs();

  function handleNavigate(p: string) {
    setCurrentPath(p);
    cancelCreating();
  }

  function handleUp() {
    if (data?.parent != null) {
      setCurrentPath(data.parent);
      cancelCreating();
    }
  }

  function handleSelect() {
    const target = displayPath ?? currentPath;
    if (target) onSelect(target);
  }

  function startCreating() {
    setCreatingFolder(true);
    setNewFolderName('');
    setMkdirError(null);
    setTimeout(() => newFolderInputRef.current?.focus(), 0);
  }

  function cancelCreating() {
    setCreatingFolder(false);
    setNewFolderName('');
    setMkdirError(null);
  }

  function submitNewFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    mkdirMutation.mutate(newFolderName.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[80vh] w-full max-w-lg flex-col gap-0 p-0"
        aria-label="Explorador de directorios"
      >
        <DialogHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-sm font-semibold">Seleccionar carpeta</DialogTitle>
            {canCreate && !creatingFolder && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={startCreating}
                aria-label="Nueva carpeta"
              >
                <FolderPlus className="size-3.5" />
                Nueva carpeta
              </Button>
            )}
          </div>
          {/* Breadcrumb */}
          <nav aria-label="Ruta actual" className="mt-1 flex flex-wrap items-center gap-0.5">
            {breadcrumbs.length === 0 ? (
              <span className="text-xs text-muted-foreground">Unidades</span>
            ) : (
              breadcrumbs.map((crumb, idx) => (
                <span key={crumb.path} className="flex items-center">
                  {idx > 0 && <span className="mx-0.5 text-muted-foreground">/</span>}
                  <button
                    type="button"
                    onClick={() => handleNavigate(crumb.path)}
                    className="max-w-[120px] truncate rounded px-0.5 text-xs hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Ir a ${crumb.label}`}
                  >
                    {crumb.label}
                  </button>
                </span>
              ))
            )}
          </nav>
        </DialogHeader>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto">
          {isPending ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2
                className="size-5 animate-spin text-muted-foreground"
                aria-label="Cargando"
              />
            </div>
          ) : isError ? (
            <p className="px-4 py-6 text-center text-sm text-destructive">
              No se pudo cargar el directorio.
            </p>
          ) : (
            <ul role="listbox" aria-label="Entradas del directorio">
              {!isRoot && (
                <li>
                  <button
                    type="button"
                    onClick={handleUp}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    aria-label="Subir al directorio padre"
                  >
                    <ChevronUp className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">..</span>
                  </button>
                </li>
              )}

              {/* Inline new-folder form */}
              {creatingFolder && (
                <li className="px-4 py-2">
                  <form onSubmit={submitNewFolder} className="flex items-center gap-2">
                    <FolderPlus className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
                    <Input
                      ref={newFolderInputRef}
                      value={newFolderName}
                      onChange={(e) => {
                        setNewFolderName(e.target.value);
                        setMkdirError(null);
                      }}
                      placeholder="Nombre de la carpeta"
                      className="h-7 flex-1 text-sm"
                      disabled={mkdirMutation.isPending}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={!newFolderName.trim() || mkdirMutation.isPending}
                      aria-label="Confirmar nombre"
                    >
                      {mkdirMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        'Crear'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={cancelCreating}
                      disabled={mkdirMutation.isPending}
                      aria-label="Cancelar nueva carpeta"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </form>
                  {mkdirError && (
                    <p className="mt-1 pl-6 text-xs text-destructive" role="alert">
                      {mkdirError}
                    </p>
                  )}
                </li>
              )}

              {entries.length === 0 && !creatingFolder && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Carpeta vacía
                </li>
              )}
              {entries.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleNavigate(entry.path)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    {entry.type === 'drive' ? (
                      <HardDrive className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FolderOpen className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
                    )}
                    <span className="truncate">{entry.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t border-border px-4 py-3">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSelect} disabled={!displayPath && !currentPath}>
            Seleccionar esta carpeta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
