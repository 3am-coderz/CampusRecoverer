import { AuditPort, AuditLogPayload } from '../ports.js';
import { logger } from '../logger.js';

export class AuditStub implements AuditPort {
  public readonly logs: AuditLogPayload[] = [];

  async log(payload: AuditLogPayload): Promise<void> {
    this.logs.push({ ...payload });
    logger.info({ action: payload.action, actor_id: payload.actor_id }, '[AuditStub] Log recorded');
  }
}
