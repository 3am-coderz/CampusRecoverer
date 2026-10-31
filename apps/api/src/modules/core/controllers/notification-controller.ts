import { Request, Response, NextFunction } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { ForbiddenError, NotFoundError } from '../../../kernel/errors.js';

export class NotificationController {
  private ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');
      const resDb = await this.ctx.db.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
        [req.user.id],
      );
      res.status(200).json({ notifications: resDb.rows });
    } catch (err) {
      next(err);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');
      const notifId = req.params.id;

      const resDb = await this.ctx.db.query(
        'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
        [notifId, req.user.id],
      );

      if (resDb.rows.length === 0) {
        throw new NotFoundError('Notification not found');
      }

      res.status(200).json({ notification: resDb.rows[0] });
    } catch (err) {
      next(err);
    }
  };
}
