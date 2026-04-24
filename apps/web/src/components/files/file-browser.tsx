import { api } from '@/lib/api';
import { FolderOpen } from 'lucide-react';
import { FileCode2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { FileTree } from './file-tree';
import { MonacoPanel } from './monaco-panel';

interface Props {
  projectId: string;
  rootPath?: string;
}

export function FileBrowser({ projectId, rootPath }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleOpenFolder() {
    api.projects.openFolder(projectId).catch(() => toast.error('No se pudo abrir la carpeta'));
  }

  return (
    <div className="grid h-[calc(100vh-220px)] min-h-[520px] grid-cols-[280px_1fr] rule border bg-card/40">
      <div className="flex flex-col border-r rule">
        <div className="flex h-8 items-center justify-between px-3 border-b rule">
          <span className="micro">Files</span>
          {rootPath && (
            <button
              type="button"
              onClick={handleOpenFolder}
              title="Abrir carpeta en explorador"
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <FolderOpen className="size-3.5" />
              Abrir
            </button>
          )}
        </div>
        <FileTree projectId={projectId} selectedPath={selected} onSelect={setSelected} />
      </div>
      <div className="min-w-0">
        {selected ? (
          <MonacoPanel projectId={projectId} path={selected} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileCode2 className="size-6" strokeWidth={1.75} />
            <p className="text-sm">Selecciona un archivo para abrirlo</p>
          </div>
        )}
      </div>
    </div>
  );
}
