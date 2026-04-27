import { cn } from '@/lib/cn';

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={cn('text-sm leading-relaxed [&>*+*]:mt-3', className)}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockNode =
  | { type: 'paragraph'; inline: InlineNode[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4; inline: InlineNode[] }
  | { type: 'code'; lang: string; content: string }
  | { type: 'ul'; items: InlineNode[][] }
  | { type: 'ol'; items: InlineNode[][] }
  | { type: 'table'; headers: InlineNode[][]; rows: InlineNode[][][] }
  | { type: 'hr' }
  | { type: 'run'; prompt: string }
  | { type: 'run-launched'; id: string; prompt: string };

type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'bold-italic'; value: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isSeparatorRow(line: string): boolean {
  return isTableRow(line) && /^\|[\s|:-]+\|$/.test(line.trim());
}

function parseTableCells(line: string): InlineNode[][] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => parseInline(cell.trim()));
}

// ─── Block parser ─────────────────────────────────────────────────────────────

function parseBlocks(src: string): BlockNode[] {
  const lines = src.split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const content: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        content.push(lines[i]!);
        i++;
      }
      i++; // consume closing ```
      const raw = content.join('\n');

      if (lang === 'run') {
        blocks.push({ type: 'run', prompt: raw.trim() });
        continue;
      }
      if (lang === 'run-launched') {
        try {
          const parsed = JSON.parse(raw.trim()) as { id: string; prompt: string };
          blocks.push({ type: 'run-launched', id: parsed.id, prompt: parsed.prompt });
        } catch {
          blocks.push({ type: 'code', lang, content: raw });
        }
        continue;
      }

      blocks.push({ type: 'code', lang, content: raw });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: Math.min(headingMatch[1]!.length, 4) as 1 | 2 | 3 | 4,
        inline: parseInline(headingMatch[2]!),
      });
      i++;
      continue;
    }

    // HR
    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Table — detect header row followed by separator row
    if (isTableRow(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1]!)) {
      const headers = parseTableCells(line);
      i += 2; // skip header + separator
      const rows: InlineNode[][][] = [];
      while (i < lines.length && isTableRow(lines[i]!)) {
        rows.push(parseTableCells(lines[i]!));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: InlineNode[][] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i]!)) {
        items.push(parseInline(lines[i]!.replace(/^[-*+]\s/, '')));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: InlineNode[][] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]!)) {
        items.push(parseInline(lines[i]!.replace(/^\d+\.\s/, '')));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — accumulate until blank or block-start
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !lines[i]!.startsWith('```') &&
      !lines[i]!.startsWith('#') &&
      !/^[-*+]\s/.test(lines[i]!) &&
      !/^\d+\.\s/.test(lines[i]!) &&
      !/^[-*_]{3,}$/.test(lines[i]!.trim()) &&
      !(isTableRow(lines[i]!) && i + 1 < lines.length && isSeparatorRow(lines[i + 1]!))
    ) {
      paraLines.push(lines[i]!);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', inline: parseInline(paraLines.join(' ')) });
    }
  }

  return blocks;
}

// ─── Inline parser ────────────────────────────────────────────────────────────

function parseInline(src: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const pattern = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|___[^_]+___|__[^_]+__|_[^_]+_|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(src)) !== null) {
    if (m.index > last) nodes.push({ type: 'text', value: src.slice(last, m.index) });
    const token = m[0]!;
    if (token.startsWith('`')) {
      nodes.push({ type: 'code', value: token.slice(1, -1) });
    } else if (token.startsWith('***') || token.startsWith('___')) {
      nodes.push({ type: 'bold-italic', value: token.slice(3, -3) });
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push({ type: 'bold', value: token.slice(2, -2) });
    } else {
      nodes.push({ type: 'italic', value: token.slice(1, -1) });
    }
    last = m.index + token.length;
  }
  if (last < src.length) nodes.push({ type: 'text', value: src.slice(last) });
  return nodes;
}

// ─── Renderers ────────────────────────────────────────────────────────────────

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'code':
            return (
              <code
                key={i}
                className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em] text-foreground"
              >
                {n.value}
              </code>
            );
          case 'bold':
            return <strong key={i} className="font-semibold">{n.value}</strong>;
          case 'italic':
            return <em key={i}>{n.value}</em>;
          case 'bold-italic':
            return (
              <strong key={i} className="font-semibold">
                <em>{n.value}</em>
              </strong>
            );
          default:
            return <span key={i}>{n.value}</span>;
        }
      })}
    </>
  );
}

function Block({ block }: { block: BlockNode }) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4';
      const cls = cn(
        'font-semibold leading-tight',
        block.level === 1 && 'text-base',
        block.level === 2 && 'text-[0.95rem]',
        block.level >= 3 && 'text-sm',
      );
      return (
        <Tag className={cls}>
          <Inline nodes={block.inline} />
        </Tag>
      );
    }

    case 'paragraph':
      return (
        <p className="leading-relaxed">
          <Inline nodes={block.inline} />
        </p>
      );

    case 'code':
      return (
        <div className="overflow-hidden rounded-md border border-border">
          {block.lang && (
            <div className="border-b border-border bg-muted/60 px-3 py-1 font-mono text-[10px] text-muted-foreground">
              {block.lang}
            </div>
          )}
          <pre className="overflow-x-auto bg-muted/30 p-3 font-mono text-xs leading-relaxed">
            <code>{block.content}</code>
          </pre>
        </div>
      );

    case 'ul':
      return (
        <ul className="space-y-0.5 pl-5">
          {block.items.map((item, i) => (
            <li key={i} className="list-disc">
              <Inline nodes={item} />
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol className="space-y-0.5 pl-5">
          {block.items.map((item, i) => (
            <li key={i} className="list-decimal">
              <Inline nodes={item} />
            </li>
          ))}
        </ol>
      );

    case 'table':
      return (
        <div className="w-full overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {block.headers.map((cell, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left font-semibold text-foreground"
                  >
                    <Inline nodes={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-border/50 last:border-0 odd:bg-muted/10 even:bg-transparent"
                >
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-muted-foreground">
                      <Inline nodes={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'hr':
      return <hr className="border-border" />;

    case 'run':
      return (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-[var(--color-chart-2)]/40 bg-[var(--color-chart-2)]/5 px-4 py-3">
          <span className="mt-0.5 text-[var(--color-chart-2)]" aria-hidden="true">▶</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--color-chart-2)]">Lanzando run…</p>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{block.prompt}</p>
          </div>
        </div>
      );

    case 'run-launched':
      return (
        <a
          href={`/runs/${block.id}`}
          className="flex items-start gap-3 rounded-lg border border-[var(--color-chart-2)]/30 bg-[var(--color-chart-2)]/8 px-4 py-3 no-underline transition-colors hover:bg-[var(--color-chart-2)]/12"
        >
          <span className="mt-0.5 text-[var(--color-chart-2)]" aria-hidden="true">✓</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--color-chart-2)]">Run lanzado</p>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{block.prompt}</p>
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">→ ver run</span>
        </a>
      );

    default:
      return null;
  }
}
