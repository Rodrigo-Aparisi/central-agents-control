import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { FileEntry } from '@cac/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Fragment, useState } from 'react';

interface Props {
  projectId: string;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function FileTree({ projectId, selectedPath, onSelect }: Props) {
  return (
    <div className="overflow-auto font-mono text-[12px]">
      <DirectoryNode
        projectId={projectId}
        path=""
        depth={0}
        defaultOpen
        selectedPath={selectedPath}
        onSelect={onSelect}
      />
    </div>
  );
}

interface DirectoryNodeProps {
  projectId: string;
  path: string;
  depth: number;
  defaultOpen?: boolean;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function DirectoryNode({
  projectId,
  path,
  depth,
  defaultOpen = false,
  selectedPath,
  onSelect,
}: DirectoryNodeProps) {
  const [open, setOpen] = useState(defaultOpen);

  const { data, isFetching } = useQuery({
    queryKey: ['cac', 'files', projectId, path],
    queryFn: () => api.files.list(projectId, path || undefined),
    enabled: open,
    staleTime: 30_000,
  });

  const entries = data?.entries ?? [];

  return (
    <div>
      {path === '' ? null : (
        <Row depth={depth} onClick={() => setOpen((v) => !v)} selected={false}>
          <DirChevron open={open} loading={isFetching && !data} />
          <span className="truncate">{basename(path)}</span>
        </Row>
      )}
      {open ? (
        <div>
          {entries.map((e) =>
            e.type === 'directory' ? (
              <DirectoryNode
                key={e.path}
                projectId={projectId}
                path={e.path}
                depth={path === '' ? depth : depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ) : (
              <FileRow
                key={e.path}
                entry={e}
                depth={path === '' ? depth : depth + 1}
                selected={selectedPath === e.path}
                onSelect={onSelect}
              />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function FileRow({
  entry,
  depth,
  selected,
  onSelect,
}: {
  entry: FileEntry;
  depth: number;
  selected: boolean;
  onSelect: (path: string) => void;
}) {
  return (
    <Row depth={depth} onClick={() => onSelect(entry.path)} selected={selected}>
      <span className="w-3 shrink-0" aria-hidden />
      <span className="truncate">{entry.name}</span>
    </Row>
  );
}

function Row({
  depth,
  onClick,
  selected,
  children,
}: {
  depth: number;
  onClick: () => void;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-6 w-full items-center gap-1.5 px-2 text-left',
        'hover:bg-accent/40 focus-visible:outline-none focus-visible:bg-accent/60',
        selected && 'bg-accent text-accent-foreground',
      )}
    >
      <IndentGuides depth={depth} />
      {children}
    </button>
  );
}

function IndentGuides({ depth }: { depth: number }) {
  if (depth === 0) return null;
  return (
    <Fragment>
      {Array.from({ length: depth }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: indent guides are purely positional
        <span key={i} className="inline-block h-full w-4 border-l rule-soft" aria-hidden />
      ))}
    </Fragment>
  );
}

function DirChevron({ open, loading }: { open: boolean; loading: boolean }) {
  if (loading) {
    return (
      <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" strokeWidth={1.75} />
    );
  }
  return open ? (
    <ChevronDown className="size-3 shrink-0 text-muted-foreground" strokeWidth={1.75} />
  ) : (
    <ChevronRight className="size-3 shrink-0 text-muted-foreground" strokeWidth={1.75} />
  );
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}
