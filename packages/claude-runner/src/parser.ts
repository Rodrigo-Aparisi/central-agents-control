import type { Readable } from 'node:stream';
import type { EventPayload, EventType } from '@cac/shared';
import split2 from 'split2';

export const TOOL_USE_WHITELIST = new Set<string>([
  'bash',
  'read',
  'edit',
  'write',
  'glob',
  'grep',
  'task',
]);

const MAX_TOOL_OUTPUT_BYTES = 4 * 1024;
const MAX_RAW_LINE_BYTES = 1024;

export interface ParsedEvent {
  kind: 'event';
  type: EventType;
  payload: EventPayload;
  timestamp: string;
}

export interface ParseErrorEvent {
  kind: 'parse-error';
  raw: string;
  reason: string;
}

export interface SuspiciousEvent {
  kind: 'suspicious';
  tool: string;
  raw: unknown;
}

export type ParserOutput = ParsedEvent | ParseErrorEvent | SuspiciousEvent;

interface ClaudeCliEventShape {
  type?: unknown;
  role?: unknown;
  content?: unknown;
  name?: unknown;
  tool?: unknown;
  tool_name?: unknown;
  input?: unknown;
  output?: unknown;
  is_error?: unknown;
  stop_reason?: unknown;
  code?: unknown;
  message?: unknown;
  usage?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_read_input_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
}

export function mapRawToEvent(raw: unknown): ParserOutput {
  if (typeof raw !== 'object' || raw === null) {
    return {
      kind: 'event',
      type: 'unknown',
      payload: { type: 'unknown', raw },
      timestamp: new Date().toISOString(),
    };
  }

  const r = raw as ClaudeCliEventShape;
  const now = new Date().toISOString();
  const cliType = typeof r.type === 'string' ? r.type : '';

  switch (cliType) {
    case 'assistant':
    case 'assistant_message':
    case 'message': {
      const isAssistantRole = r.role === undefined || r.role === 'assistant';
      if (!isAssistantRole) break;
      // CLI stream-json nests content inside r.message: {"type":"assistant","message":{"content":[...],...}}
      const msgRecord = isRecord(r.message) ? r.message : null;
      const contentSource = r.content ?? (msgRecord ? msgRecord.content : undefined);
      const content = extractTextContent(contentSource);
      const stopReason =
        typeof r.stop_reason === 'string'
          ? r.stop_reason
          : msgRecord && typeof msgRecord.stop_reason === 'string'
            ? msgRecord.stop_reason
            : undefined;
      return {
        kind: 'event',
        type: 'assistant_message',
        payload: {
          type: 'assistant_message',
          content,
          ...(stopReason ? { stopReason } : {}),
        },
        timestamp: now,
      };
    }

    case 'user': {
      // CLI wraps tool results: {"type":"user","message":{"role":"user","content":[{"type":"tool_result",...}],...}}
      const msgRecord = isRecord(r.message) ? r.message : null;
      const contents = msgRecord && Array.isArray(msgRecord.content) ? msgRecord.content : [];
      for (const item of contents) {
        if (!isRecord(item) || item.type !== 'tool_result') continue;
        const rawContent = item.content;
        let outputStr: string;
        if (typeof rawContent === 'string') {
          outputStr = rawContent;
        } else if (Array.isArray(rawContent)) {
          outputStr = rawContent
            .map((c) => (isRecord(c) && typeof c.text === 'string' ? c.text : ''))
            .join('');
        } else {
          outputStr = '';
        }
        return {
          kind: 'event',
          type: 'tool_result',
          payload: {
            type: 'tool_result',
            tool: 'unknown',
            output: truncate(outputStr, MAX_TOOL_OUTPUT_BYTES),
            isError: item.is_error === true,
          },
          timestamp: now,
        };
      }
      break;
    }

    case 'result': {
      // Final result event from CLI - contains cumulative token usage
      const usageRaw = isRecord(r.usage) ? r.usage : null;
      if (!usageRaw) break;
      return {
        kind: 'event',
        type: 'usage',
        payload: {
          type: 'usage',
          inputTokens: toUint(usageRaw.input_tokens),
          outputTokens: toUint(usageRaw.output_tokens),
          cacheReadTokens: toUint(usageRaw.cache_read_input_tokens),
          cacheWriteTokens: toUint(usageRaw.cache_creation_input_tokens),
        },
        timestamp: now,
      };
    }

    case 'tool_use': {
      const tool = normalizeTool(r.name ?? r.tool ?? r.tool_name);
      const input = isRecord(r.input) ? r.input : {};
      if (tool && !TOOL_USE_WHITELIST.has(tool.toLowerCase())) {
        return { kind: 'suspicious', tool, raw };
      }
      return {
        kind: 'event',
        type: 'tool_use',
        payload: { type: 'tool_use', tool: tool ?? 'unknown', input },
        timestamp: now,
      };
    }

    case 'tool_result': {
      const tool = normalizeTool(r.name ?? r.tool ?? r.tool_name) ?? 'unknown';
      const output = truncate(String(r.output ?? ''), MAX_TOOL_OUTPUT_BYTES);
      const isError = r.is_error === true;
      return {
        kind: 'event',
        type: 'tool_result',
        payload: { type: 'tool_result', tool, output, isError },
        timestamp: now,
      };
    }

    case 'thinking': {
      const content = extractTextContent(r.content);
      return {
        kind: 'event',
        type: 'thinking',
        payload: { type: 'thinking', content },
        timestamp: now,
      };
    }

    case 'usage': {
      const u = isRecord(r.usage) ? r.usage : r;
      return {
        kind: 'event',
        type: 'usage',
        payload: {
          type: 'usage',
          inputTokens: toUint(u.input_tokens),
          outputTokens: toUint(u.output_tokens),
          cacheReadTokens: toUint(u.cache_read_input_tokens),
          cacheWriteTokens: toUint(u.cache_creation_input_tokens),
        },
        timestamp: now,
      };
    }

    case 'system': {
      const content = extractTextContent(r.content) || String(r.message ?? '');
      return {
        kind: 'event',
        type: 'system',
        payload: { type: 'system', content },
        timestamp: now,
      };
    }

    case 'error': {
      return {
        kind: 'event',
        type: 'error',
        payload: {
          type: 'error',
          code: typeof r.code === 'string' ? r.code : 'CLI_ERROR',
          message: typeof r.message === 'string' ? r.message : JSON.stringify(raw),
        },
        timestamp: now,
      };
    }
  }

  return {
    kind: 'event',
    type: 'unknown',
    payload: { type: 'unknown', raw },
    timestamp: now,
  };
}

export function parseLine(line: string): ParserOutput {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return {
      kind: 'parse-error',
      raw: '',
      reason: 'empty line',
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      kind: 'parse-error',
      raw: truncate(trimmed, MAX_RAW_LINE_BYTES),
      reason: err instanceof Error ? err.message : 'JSON parse failed',
    };
  }
  return mapRawToEvent(parsed);
}

export async function* parseStream(stream: Readable): AsyncGenerator<ParserOutput, void, void> {
  const lines = stream.pipe(split2());
  try {
    for await (const line of lines as AsyncIterable<string>) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        yield {
          kind: 'parse-error',
          raw: truncate(trimmed, MAX_RAW_LINE_BYTES),
          reason: err instanceof Error ? err.message : 'JSON parse failed',
        };
        continue;
      }
      yield mapRawToEvent(parsed);
      // Claude CLI embeds tool_use blocks inside assistant message content arrays.
      // Extract and emit them separately so workers can detect file operations.
      yield* extractEmbeddedToolUses(parsed);
    }
  } finally {
    if (typeof (lines as { destroy?: () => void }).destroy === 'function') {
      (lines as { destroy: () => void }).destroy();
    }
  }
}

function extractEmbeddedToolUses(raw: unknown): ParserOutput[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const r = raw as ClaudeCliEventShape;
  const cliType = typeof r.type === 'string' ? r.type : '';
  if (cliType !== 'assistant' && cliType !== 'assistant_message' && cliType !== 'message')
    return [];
  const isAssistantRole = r.role === undefined || r.role === 'assistant';
  if (!isAssistantRole) return [];
  const msgRecord = isRecord(r.message) ? r.message : null;
  const contentArr: unknown = r.content ?? (msgRecord ? msgRecord.content : undefined);
  if (!Array.isArray(contentArr)) return [];
  const now = new Date().toISOString();
  const events: ParserOutput[] = [];
  for (const item of contentArr) {
    if (!isRecord(item) || item.type !== 'tool_use') continue;
    const tool = normalizeTool(item.name ?? item.tool ?? item.tool_name);
    const input = isRecord(item.input) ? item.input : {};
    if (tool && !TOOL_USE_WHITELIST.has(tool.toLowerCase())) {
      events.push({ kind: 'suspicious', tool, raw: item });
      continue;
    }
    events.push({
      kind: 'event',
      type: 'tool_use',
      payload: { type: 'tool_use', tool: tool ?? 'unknown', input },
      timestamp: now,
    });
  }
  return events;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeTool(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function toUint(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return 0;
  return Math.floor(v);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[truncated]`;
}

function extractTextContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (isRecord(part) && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('');
  }
  if (isRecord(value) && typeof value.text === 'string') return value.text;
  return '';
}
