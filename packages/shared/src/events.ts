import { z } from 'zod';

export const EventType = z.enum([
  'assistant_message',
  'tool_use',
  'tool_result',
  'thinking',
  'usage',
  'system',
  'error',
  'unknown',
]);
export type EventType = z.infer<typeof EventType>;

const AssistantMessagePayload = z.object({
  type: z.literal('assistant_message'),
  content: z.string(),
  stopReason: z.string().optional(),
});

const ToolUsePayload = z.object({
  type: z.literal('tool_use'),
  tool: z.string(),
  input: z.record(z.unknown()),
});

const ToolResultPayload = z.object({
  type: z.literal('tool_result'),
  tool: z.string(),
  output: z.string(),
  isError: z.boolean().default(false),
});

const ThinkingPayload = z.object({
  type: z.literal('thinking'),
  content: z.string(),
});

const UsagePayload = z.object({
  type: z.literal('usage'),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative().default(0),
  cacheWriteTokens: z.number().int().nonnegative().default(0),
});

const SystemPayload = z.object({
  type: z.literal('system'),
  content: z.string(),
});

const ErrorPayload = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
});

const UnknownPayload = z.object({
  type: z.literal('unknown'),
  raw: z.unknown(),
});

export const EventPayload = z.discriminatedUnion('type', [
  AssistantMessagePayload,
  ToolUsePayload,
  ToolResultPayload,
  ThinkingPayload,
  UsagePayload,
  SystemPayload,
  ErrorPayload,
  UnknownPayload,
]);
export type EventPayload = z.infer<typeof EventPayload>;

export const RunEvent = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  seq: z.number().int().nonnegative(),
  type: EventType,
  payload: EventPayload,
  timestamp: z.string().datetime({ offset: true }),
});
export type RunEvent = z.infer<typeof RunEvent>;
