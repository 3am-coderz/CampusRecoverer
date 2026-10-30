import { Request, Response, NextFunction } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { AuditService } from '../services/audit-service.js';

export class AuditController {
  private auditService: AuditService;

  constructor(ctx: AppContext, auditService?: AuditService) {
    if (auditService) {
      this.auditService = auditService;
    } else if (ctx.ports.audit instanceof AuditService) {
      this.auditService = ctx.ports.audit;
    } else {
      this.auditService = new AuditService(ctx.db);
    }
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        action,
        event_type,
        actor_id,
        entity_type,
        entity_id,
        item_id,
        claim_id,
        start_time,
        from,
        end_time,
        to,
        limit,
        offset,
      } = req.query;

      const result = await this.auditService.queryLogs({
        action: typeof action === 'string' ? action : undefined,
        event_type: typeof event_type === 'string' ? event_type : undefined,
        actor_id: typeof actor_id === 'string' ? actor_id : undefined,
        entity_type: typeof entity_type === 'string' ? entity_type : undefined,
        entity_id: typeof entity_id === 'string' ? entity_id : undefined,
        item_id: typeof item_id === 'string' ? item_id : undefined,
        claim_id: typeof claim_id === 'string' ? claim_id : undefined,
        start_time: typeof start_time === 'string' ? start_time : undefined,
        from: typeof from === 'string' ? from : undefined,
        end_time: typeof end_time === 'string' ? end_time : undefined,
        to: typeof to === 'string' ? to : undefined,
        limit: typeof limit === 'string' ? limit : undefined,
        offset: typeof offset === 'string' ? offset : undefined,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
