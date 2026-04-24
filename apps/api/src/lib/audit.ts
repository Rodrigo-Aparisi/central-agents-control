import { newId } from '@cac/db';
import type { CacDb } from '@cac/db';
import type { FastifyRequest } from 'fastify';

/**
 * Persists an audit event to the DB.
 * Never throws — failures are logged and swallowed so the request is not aborted.
 */
export async function logAudit(
  db: CacDb,
  req: FastifyRequest,
  action: string,
  resource: string,
  resourceId: string | null,
  detail?: string,
): Promise<void> {
  const userId = req.jwtUser?.sub ?? null;
  try {
    await db.auditEvents.insert({
      id: newId(),
      userId,
      action,
      resource,
      resourceId,
      detail: detail != null ? detail.slice(0, 500) : null,
      ip: req.ip,
    });
  } catch (err) {
    req.log.warn({ err, action, resource, resourceId }, 'audit log insert failed');
  }
}
