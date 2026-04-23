import { z } from 'zod';
import { RunEvent } from './events';
import { RunExitReason, RunStatus } from './run';

export const RUNS_NAMESPACE = '/runs';

export const RunEventMessage = z.object({
  type: z.literal('run:event'),
  runId: z.string().uuid(),
  event: RunEvent,
});
export type RunEventMessage = z.infer<typeof RunEventMessage>;

export const RunLogMessage = z.object({
  type: z.literal('run:log'),
  runId: z.string().uuid(),
  events: z.array(RunEvent),
});
export type RunLogMessage = z.infer<typeof RunLogMessage>;

export const RunStatusMessage = z.object({
  type: z.literal('run:status'),
  runId: z.string().uuid(),
  status: RunStatus,
  exitCode: z.number().int().optional(),
  reason: RunExitReason.optional(),
});
export type RunStatusMessage = z.infer<typeof RunStatusMessage>;

export const SocketServerMessage = z.discriminatedUnion('type', [
  RunEventMessage,
  RunLogMessage,
  RunStatusMessage,
]);
export type SocketServerMessage = z.infer<typeof SocketServerMessage>;

export const SocketClientJoin = z.object({
  type: z.literal('join'),
  runId: z.string().uuid(),
});
export type SocketClientJoin = z.infer<typeof SocketClientJoin>;

export const SocketClientReplay = z.object({
  type: z.literal('replay'),
  runId: z.string().uuid(),
  fromSeq: z.number().int().nonnegative(),
});
export type SocketClientReplay = z.infer<typeof SocketClientReplay>;

export const SocketClientMessage = z.discriminatedUnion('type', [
  SocketClientJoin,
  SocketClientReplay,
]);
export type SocketClientMessage = z.infer<typeof SocketClientMessage>;
