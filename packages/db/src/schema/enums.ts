import { RUN_STATUSES } from '@cac/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

export const runStatusEnum = pgEnum('run_status', RUN_STATUSES);

export const eventTypeEnum = pgEnum('event_type', [
  'assistant_message',
  'tool_use',
  'tool_result',
  'thinking',
  'usage',
  'system',
  'error',
  'unknown',
]);

export const artifactOperationEnum = pgEnum('artifact_operation', [
  'created',
  'modified',
  'deleted',
]);
