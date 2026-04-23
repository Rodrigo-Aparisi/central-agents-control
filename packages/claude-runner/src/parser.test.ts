import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { mapRawToEvent, parseLine, parseStream } from './parser';

describe('parseLine', () => {
  it('returns parse-error for invalid JSON with truncated raw', () => {
    const out = parseLine('not-json{');
    expect(out.kind).toBe('parse-error');
    if (out.kind === 'parse-error') {
      expect(out.raw).toBe('not-json{');
      expect(out.reason).toMatch(/JSON|Unexpected|Expected/i);
    }
  });

  it('returns parse-error for empty line', () => {
    const out = parseLine('   ');
    expect(out.kind).toBe('parse-error');
  });

  it('maps an assistant message line', () => {
    const out = parseLine(JSON.stringify({ type: 'assistant', role: 'assistant', content: 'hi' }));
    expect(out.kind).toBe('event');
    if (out.kind === 'event') {
      expect(out.type).toBe('assistant_message');
      if (out.payload.type === 'assistant_message') {
        expect(out.payload.content).toBe('hi');
      }
    }
  });
});

describe('mapRawToEvent', () => {
  it('extracts text from content array', () => {
    const out = mapRawToEvent({
      type: 'assistant',
      content: [
        { type: 'text', text: 'hello ' },
        { type: 'text', text: 'world' },
      ],
    });
    expect(out.kind).toBe('event');
    if (out.kind === 'event' && out.payload.type === 'assistant_message') {
      expect(out.payload.content).toBe('hello world');
    }
  });

  it('flags tool_use outside the whitelist as suspicious', () => {
    const out = mapRawToEvent({ type: 'tool_use', name: 'danger', input: {} });
    expect(out.kind).toBe('suspicious');
    if (out.kind === 'suspicious') expect(out.tool).toBe('danger');
  });

  it('accepts whitelisted tool_use', () => {
    const out = mapRawToEvent({
      type: 'tool_use',
      name: 'bash',
      input: { command: 'ls' },
    });
    expect(out.kind).toBe('event');
    if (out.kind === 'event' && out.payload.type === 'tool_use') {
      expect(out.payload.tool).toBe('bash');
    }
  });

  it('truncates tool_result output to 4KB', () => {
    const big = 'x'.repeat(8192);
    const out = mapRawToEvent({ type: 'tool_result', tool: 'read', output: big });
    if (out.kind === 'event' && out.payload.type === 'tool_result') {
      expect(out.payload.output.length).toBeLessThan(big.length);
      expect(out.payload.output).toContain('[truncated]');
    }
  });

  it('maps usage with cache tokens', () => {
    const out = mapRawToEvent({
      type: 'usage',
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 3,
      cache_creation_input_tokens: 4,
    });
    if (out.kind === 'event' && out.payload.type === 'usage') {
      expect(out.payload).toMatchObject({
        inputTokens: 10,
        outputTokens: 20,
        cacheReadTokens: 3,
        cacheWriteTokens: 4,
      });
    }
  });

  it('marks unknown CLI types as unknown', () => {
    const out = mapRawToEvent({ type: 'made_up_event', foo: 1 });
    if (out.kind === 'event') expect(out.type).toBe('unknown');
  });
});

describe('parseStream', () => {
  it('yields one ParserOutput per line', async () => {
    const lines = [
      JSON.stringify({ type: 'system', content: 'boot' }),
      'broken{',
      JSON.stringify({ type: 'assistant', content: 'done' }),
    ].join('\n');
    const stream = Readable.from([lines]);
    const out = [];
    for await (const ev of parseStream(stream)) out.push(ev);
    expect(out).toHaveLength(3);
    expect(out[0]?.kind).toBe('event');
    expect(out[1]?.kind).toBe('parse-error');
    expect(out[2]?.kind).toBe('event');
  });
});
