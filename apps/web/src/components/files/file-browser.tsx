import { FileCode2 } from 'lucide-react';
import { useState } from 'react';
import { FileTree } from './file-tree';
import { MonacoPanel } from './monaco-panel';

interface Props {
  projectId: string;
}

export function FileBrowser({ projectId }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="grid h-[calc(100vh-220px)] min-h-[520px] grid-cols-[280px_1fr] rule border bg-card/40">
      <div className="flex flex-col border-r rule">
        <div className="flex h-8 items-center px-3 border-b rule">
          <span className="micro">Files</span>
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
