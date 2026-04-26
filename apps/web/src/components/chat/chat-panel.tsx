import type { ChatMessage, ChatSession } from '@cac/shared';
import { useEffect, useRef, useState } from 'react';
import { ConversationList } from './conversation-list';
import { MessageInput } from './message-input';
import { MessageThread } from './message-thread';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { toast } from 'sonner';

interface ChatPanelProps {
  projectId: string;
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  const qc = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sessions = useQuery({
    queryKey: qk.chatSessions(projectId),
    queryFn: () => api.chat.listSessions(projectId),
  });

  const messages = useQuery({
    queryKey: activeSessionId ? qk.chatMessages(projectId, activeSessionId) : ['__disabled'],
    queryFn: () => api.chat.listMessages(projectId, activeSessionId!),
    enabled: !!activeSessionId,
  });

  const createSession = useMutation({
    mutationFn: () => api.chat.createSession(projectId),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: qk.chatSessions(projectId) });
      setActiveSessionId(session.id);
    },
    onError: () => toast.error('No se pudo crear la conversación'),
  });

  const deleteSession = useMutation({
    mutationFn: (sessionId: string) => api.chat.deleteSession(projectId, sessionId),
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: qk.chatSessions(projectId) });
      if (activeSessionId === deletedId) setActiveSessionId(null);
    },
    onError: () => toast.error('No se pudo eliminar la conversación'),
  });

  async function sendMessage(content: string) {
    if (!activeSessionId || isStreaming) return;

    abortRef.current = new AbortController();
    setIsStreaming(true);
    setStreamingContent('');

    // Optimistically add user message to the cache
    const currentMessages = qc.getQueryData<{ items: ChatMessage[] }>(
      qk.chatMessages(projectId, activeSessionId),
    );
    const userSeq = (currentMessages?.items.length ?? 0) * 2; // approximate
    const optimisticUser: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      sessionId: activeSessionId,
      role: 'user',
      content,
      seq: userSeq,
      createdAt: new Date().toISOString(),
    };
    qc.setQueryData<{ items: ChatMessage[] }>(qk.chatMessages(projectId, activeSessionId), (old) => ({
      items: [...(old?.items ?? []), optimisticUser],
    }));

    try {
      await api.chat.sendMessage(
        projectId,
        activeSessionId,
        { content },
        (chunk) => setStreamingContent((prev) => prev + chunk),
        abortRef.current.signal,
      );
      // Reload messages to get persisted assistant message + real IDs
      await qc.invalidateQueries({ queryKey: qk.chatMessages(projectId, activeSessionId) });
      await qc.invalidateQueries({ queryKey: qk.chatSessions(projectId) });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      toast.error('Error al enviar el mensaje');
      // Revert optimistic update
      qc.setQueryData<{ items: ChatMessage[] }>(qk.chatMessages(projectId, activeSessionId), (old) => ({
        items: (old?.items ?? []).filter((m) => m.id !== optimisticUser.id),
      }));
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }

  function cancelStream() {
    abortRef.current?.abort();
  }

  const sessionList = sessions.data?.items ?? [];
  const activeSession = sessionList.find((s) => s.id === activeSessionId) ?? null;
  const messageList = messages.data?.items ?? [];

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] overflow-hidden rounded-lg border border-border">
      {/* Sidebar */}
      <ConversationList
        sessions={sessionList}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onNew={() => createSession.mutate()}
        onDelete={(id) => deleteSession.mutate(id)}
        isCreating={createSession.isPending}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeSessionId ? (
          <>
            <MessageThread
              messages={messageList}
              streamingContent={streamingContent}
              isStreaming={isStreaming}
              isLoading={messages.isPending}
            />
            <MessageInput
              onSend={sendMessage}
              onCancel={cancelStream}
              isStreaming={isStreaming}
              disabled={!activeSessionId}
              sessionTitle={activeSession?.title}
            />
          </>
        ) : (
          <EmptyState onNew={() => createSession.mutate()} isCreating={createSession.isPending} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ onNew, isCreating }: { onNew: () => void; isCreating: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-card">
        <svg
          className="size-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.25}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
          />
        </svg>
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-medium">Ninguna conversación abierta</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Usa el chat para razonar sobre decisiones, iterar en conceptos o consultar cualquier cosa
          relacionada con el proyecto.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        disabled={isCreating}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isCreating ? 'Creando…' : 'Nueva conversación'}
      </button>
      <div className="mt-2 grid max-w-md gap-2 text-left">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              onNew();
            }}
            className="rounded-md border border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-border/80 hover:bg-accent hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  '¿Cuál es la mejor arquitectura para este feature?',
  'Revisemos las decisiones técnicas del último sprint',
  '¿Qué tradeoffs tiene usar X vs Y en este contexto?',
  'Ayúdame a redactar los criterios de aceptación',
];
