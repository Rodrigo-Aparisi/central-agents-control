import { useRef, useState } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface MessageInputProps {
  onSend: (content: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
  disabled: boolean;
  sessionTitle?: string;
}

export function MessageInput({
  onSend,
  onCancel,
  isStreaming,
  disabled,
}: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    // Auto-grow textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const content = value.trim();
    if (!content || isStreaming) return;
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSend(content);
  }

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-sm px-4 py-3">
      <div className="mx-auto w-full max-w-[80%]">
      {isStreaming && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1 animate-bounce rounded-full bg-[var(--color-chart-2)]"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </span>
          Claude está escribiendo…
        </div>
      )}
      <div
        className={cn(
          'flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 transition-colors',
          'focus-within:border-[var(--color-chart-2)]/40 focus-within:ring-1 focus-within:ring-[var(--color-chart-2)]/20',
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={disabled ? 'Selecciona o crea una conversación…' : 'Escribe un mensaje… (Enter para enviar, Shift+Enter para nueva línea)'}
          disabled={disabled || isStreaming}
          className="flex-1 resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: '24px', maxHeight: '200px' }}
          aria-label="Mensaje a Claude"
        />
        {isStreaming ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onCancel}
            aria-label="Cancelar respuesta"
          >
            <Square className="size-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              'size-8 shrink-0 transition-colors',
              value.trim()
                ? 'text-[var(--color-chart-2)] hover:text-[var(--color-chart-2)]/80'
                : 'text-muted-foreground/30',
            )}
            onClick={submit}
            disabled={!value.trim() || disabled}
            aria-label="Enviar mensaje"
          >
            <Send className="size-3.5" />
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
        Claude puede cometer errores. Verifica la información importante.
      </p>
      </div>
    </div>
  );
}
