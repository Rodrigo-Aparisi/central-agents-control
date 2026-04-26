import type { ChatSession } from '@cac/shared';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ConversationListProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isCreating: boolean;
}

export function ConversationList({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  isCreating,
}: ConversationListProps) {
  return (
    <div className="flex w-[260px] shrink-0 flex-col border-r border-border bg-card/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Conversaciones
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onNew}
              disabled={isCreating}
              aria-label="Nueva conversación"
            >
              <Plus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Nueva conversación</TooltipContent>
        </Tooltip>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="mx-auto mb-2 size-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">Sin conversaciones</p>
          </div>
        ) : (
          sessions.map((session) => (
            <ConversationItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      {/* New button at bottom */}
      <div className="border-t border-border p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={onNew}
          disabled={isCreating}
        >
          <Plus className="size-3.5" />
          {isCreating ? 'Creando…' : 'Nueva conversación'}
        </Button>
      </div>
    </div>
  );
}

function ConversationItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const relativeTime = formatRelative(session.updatedAt);

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-sm transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-accent/50',
      )}
      onClick={() => onSelect(session.id)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(session.id)}
      tabIndex={0}
      role="button"
      aria-current={isActive ? 'true' : undefined}
    >
      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium leading-tight">{session.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{relativeTime}</span>
          {session.messageCount > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">
              {session.messageCount}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(session.id);
        }}
        aria-label={`Eliminar conversación "${session.title}"`}
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}
