import { AuditPort, AuditLogPayload } from '../ports.js';
import { DatabaseContext } from '../db.js';
import { logger } from '../logger.js';

export class AuditStub implements AuditPort {
  public readonly logs: AuditLogPayload[] = [];

  constructor(private readonly db?: DatabaseContext) {}

  async log(payload: AuditLogPayload): Promise<void> {
    // Keep the in-memory event list for existing tests and debugging.
    this.logs.push({ ...payload });

    // Persist the event when a database is available.
    if (this.db) {
      await this.db.query(
        `INSERT INTO audit_logs
          (actor_id, action, item_id, claim_id, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          payload.actor_id,
          payload.action,
          payload.item_id ?? null,
          payload.claim_id ?? null,
          JSON.stringify(payload.metadata ?? {}),
        ],
      );
    }

    logger.info(
      {
        action: payload.action,
        actor_id: payload.actor_id,
        item_id: payload.item_id,
      },
      '[AuditStub] Log recorded',
    );
  }
}
