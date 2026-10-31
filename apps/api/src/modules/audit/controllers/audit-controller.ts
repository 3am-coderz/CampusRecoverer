import { Request, Response, NextFunction } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { AuditService } from '../services/audit-service.js';

export class AuditController {
  private service: AuditService;

  constructor(ctx: AppContext) {
    this.service = new AuditService(ctx.db);
  }

  getLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { item_id, claim_id, actor_id, action, page, limit } = req.query;
      const result = await this.service.queryLogs({
        item_id: item_id as string | undefined,
        claim_id: claim_id as string | undefined,
        actor_id: actor_id as string | undefined,
        action: action as string | undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  verifyChain = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.verifyChain();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
