import { Express, Request, Response, NextFunction } from 'express';
import { AppContext } from '../../kernel/app.js';
import { requireAuth, requireRole } from '../../kernel/auth.js';

export function register(app: Express, ctx: AppContext): void {
  app.get(
    '/audit',
    requireAuth,
    requireRole('ADMIN', 'SECURITY'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const requestedLimit = Number.parseInt(String(req.query.limit ?? '50'), 10);
        const requestedOffset = Number.parseInt(String(req.query.offset ?? '0'), 10);

        const limit = Number.isFinite(requestedLimit)
          ? Math.min(100, Math.max(1, requestedLimit))
          : 50;

        const offset = Number.isFinite(requestedOffset)
          ? Math.max(0, requestedOffset)
          : 0;

        const countResult = await ctx.db.query(
          'SELECT COUNT(*) AS count FROM audit_logs',
        );

        const eventsResult = await ctx.db.query(
          `SELECT id, actor_id, action, item_id, claim_id, metadata, created_at
           FROM audit_logs
           ORDER BY created_at DESC, id DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset],
        );

        res.status(200).json({
          events: eventsResult.rows,
          pagination: {
            limit,
            offset,
            total: Number(countResult.rows[0]?.count ?? 0),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );
}
