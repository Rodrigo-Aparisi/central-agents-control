import type { ChatMessage } from '@cac/shared';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { Markdown } from './markdown';

interface MessageThreadProps {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  isLoading: boolean;
}

export function MessageThread({
  messages,
  streamingContent,
  isStreaming,
  isLoading,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingContent]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (messages.length === 0 && !isStreaming) {
    return <NewSessionPrompts />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="space-y-5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming assistant message */}
        {isStreaming && (
          <div className="flex gap-3">
            <AssistantAvatar />
            <div className="flex-1 min-w-0 rounded-xl rounded-tl-none border border-border bg-card px-4 py-3">
              {streamingContent ? (
                <Markdown content={streamingContent} />
              ) : (
                <TypingIndicator />
              )}
              {streamingContent && <BlinkingCursor />}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-tr-none bg-[var(--color-chart-1)]/10 px-4 py-3 text-sm ring-1 ring-[var(--color-chart-1)]/20">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="flex-1 min-w-0 rounded-xl rounded-tl-none border border-border bg-card px-4 py-3">
        <Markdown content={message.content} />
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div
      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-chart-2)]/15 text-[10px] font-semibold text-[var(--color-chart-2)]"
      aria-label="Claude"
    >
      C
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1.5 py-1" aria-label="Claude está escribiendo">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

function BlinkingCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-[var(--color-chart-2)] align-middle"
      aria-hidden="true"
    />
  );
}

function NewSessionPrompts() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <div className="space-y-1">
        <p className="text-sm font-medium">¿Cómo puedo ayudarte hoy?</p>
        <p className="text-xs text-muted-foreground">
          Pregunta sobre decisiones técnicas, arquitectura, tradeoffs o cualquier cosa relacionada
          con tu proyecto.
        </p>
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-2">
        {PROMPT_SUGGESTIONS.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border bg-card/60 p-3 text-left"
          >
            <p className="text-xs font-medium">{s.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PROMPT_SUGGESTIONS = [
  { label: 'Decisiones de arquitectura', desc: 'Razona tradeoffs antes de implementar' },
  { label: 'Code review verbal', desc: 'Discute un enfoque sin escribir código' },
  { label: 'Brainstorming', desc: 'Genera ideas y evalúalas en contexto' },
  { label: 'Documentación', desc: 'Redacta specs, READMEs o ADRs' },
];
