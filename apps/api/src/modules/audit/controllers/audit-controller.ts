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
      const { item_id, claim_id, actor_id, action, page, limit, offset } = req.query;
      const parsedLimit = limit ? parseInt(limit as string, 10) : 20;
      const parsedPage = page
        ? parseInt(page as string, 10)
        : offset
          ? Math.floor(parseInt(offset as string, 10) / parsedLimit) + 1
          : 1;

      const result = await this.service.queryLogs({
        item_id: item_id as string | undefined,
        claim_id: claim_id as string | undefined,
        actor_id: actor_id as string | undefined,
        action: action as string | undefined,
        page: parsedPage,
        limit: parsedLimit,
      });

      const effectiveOffset = (result.page - 1) * parsedLimit;

      res.status(200).json({
        logs: result.logs,
        events: result.logs,
        total: result.total,
        page: result.page,
        pagination: {
          limit: parsedLimit,
          offset: effectiveOffset,
          total: result.total,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  verifyChain = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.verifyChain();
      res.status(200).json({
        ...result,
        valid: result.verified,
        totalRows: result.total_entries,
        brokenAtSeq: result.tampered_seqs[0] ?? null,
      });
    } catch (err) {
      next(err);
    }
  };
}
