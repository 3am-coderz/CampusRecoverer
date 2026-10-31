import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppContext } from '../../../kernel/app.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../../kernel/errors.js';
import { toPublicItem, toDetailedItem } from '../utils/projections.js';

const createItemSchema = z.object({
  category: z.string().min(1),
  public_description: z.string().min(5),
  hidden_description: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length >= 1 ? v.trim() : 'No hidden description provided')),
  hidden_attributes: z.record(z.any()).optional().default({}),
  found_location_public: z.string().min(2),
  found_date: z.string().datetime().or(z.string()),
});

export class ItemController {
  private ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createItemSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0].message);
      }
      const data = parsed.data;

      let finderId = req.user?.id;
      if (!finderId) {
        const guestUser = await this.ctx.db.query("SELECT id FROM users WHERE email = 'guest@campus.edu'");
        if (guestUser.rows.length > 0) {
          finderId = guestUser.rows[0].id;
        } else {
          finderId = 'usr_guest_finder';
          await this.ctx.db.query(
            "INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
            [finderId, 'guest@campus.edu', 'guest_hash', 'Guest User', 'FINDER']
          );
        }
      }
      const itemId = 'item_' + Math.random().toString(36).substring(2, 10);
      const riskLevel = this.ctx.ports.risk.classify(data.category, data.hidden_attributes);

      await this.ctx.db.query(
        `INSERT INTO items (
          id, category, public_description, hidden_description, hidden_attributes,
          found_location_public, found_date, status, risk_level, security_verified,
          finder_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
        [
          itemId,
          data.category,
          data.public_description,
          data.hidden_description,
          JSON.stringify(data.hidden_attributes),
          data.found_location_public,
          new Date(data.found_date).toISOString(),
          'PENDING_HANDOVER',
          riskLevel,
          false,
          finderId,
        ],
      );

      // Record custody event & Audit
      await this.ctx.ports.workflow.recordCustody({
        item_id: itemId,
        event: 'REPORTED',
        actor_id: finderId,
        location: data.found_location_public,
      });

      await this.ctx.ports.audit.log({
        actor_id: finderId,
        action: 'ITEM_REPORTED',
        item_id: itemId,
        metadata: { category: data.category, risk_level: riskLevel },
      });

      const row = await this.ctx.ports.core.getItem(itemId);
      res.status(201).json({ item: toPublicItem(row) });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = req.query.category as string | undefined;
      const query = req.query.query as string | undefined;
      const status = req.query.status as string | undefined;

      const isStaff = req.user && (req.user.role === 'SECURITY' || req.user.role === 'ADMIN');

      let sql = 'SELECT * FROM items WHERE 1=1';
      const params: any[] = [];

      if (!isStaff) {
        // Public users only see OPEN_FOR_CLAIMS, UNDER_REVIEW, APPROVED_AWAITING_COLLECTION, COLLECTED, EXPIRED
        sql += ` AND status != 'PENDING_HANDOVER' AND status != 'WAITING_PERIOD'`;
      }

      if (category) {
        params.push(`%${category}%`);
        sql += ` AND category ILIKE $${params.length}`;
      }

      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }

      if (query) {
        params.push(`%${query}%`);
        sql += ` AND (public_description ILIKE $${params.length} OR category ILIKE $${params.length} OR found_location_public ILIKE $${params.length})`;
      }

      sql += ' ORDER BY created_at DESC';

      const resDb = await this.ctx.db.query(sql, params.length > 0 ? params : undefined);
      const items = resDb.rows.map((r: any) => toPublicItem(r));
      res.status(200).json({ items });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId = req.params.id;
      const row = await this.ctx.ports.core.getItem(itemId);
      if (!row) throw new NotFoundError('Item not found');

      // Security check: non-staff cannot view PENDING_HANDOVER or WAITING_PERIOD unless they are the finder
      const isStaff = req.user && (req.user.role === 'SECURITY' || req.user.role === 'ADMIN');
      const isFinder = req.user && req.user.id === row.finder_id;

      if (!isStaff && !isFinder && (row.status === 'PENDING_HANDOVER' || row.status === 'WAITING_PERIOD')) {
        throw new NotFoundError('Item not found or not currently available for public viewing');
      }

      res.status(200).json({ item: toDetailedItem(row, req.user) });
    } catch (err) {
      next(err);
    }
  };

  verify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId = req.params.id;
      const row = await this.ctx.ports.core.getItem(itemId);

      // Must have physical receipt from security desk custody
      const hasReceipt = await this.ctx.ports.workflow.hasReceipt(itemId);
      if (!hasReceipt) {
        throw new BadRequestError(
          'Cannot verify item before physical receipt has been logged at security desk',
          'MISSING_PHYSICAL_RECEIPT',
        );
      }

      this.ctx.ports.workflow.assertItemTransition(row.status, 'WAITING_PERIOD');

      const classifiedRisk = this.ctx.ports.risk.classify(row.category, row.hidden_attributes);
      const waitingHours = this.ctx.config.waitingPeriods[classifiedRisk] || 24;
      const waitingUntil = new Date(Date.now() + waitingHours * 3600 * 1000).toISOString();

      await this.ctx.db.query(
        `UPDATE items
         SET status = 'WAITING_PERIOD', security_verified = TRUE, risk_level = $1, waiting_until = $2
         WHERE id = $3`,
        [classifiedRisk, waitingUntil, itemId],
      );

      await this.ctx.ports.audit.log({
        actor_id: req.user!.id,
        action: 'ITEM_VERIFIED',
        item_id: itemId,
        metadata: { risk_level: classifiedRisk, waiting_hours: waitingHours },
      });

      const updated = await this.ctx.ports.core.getItem(itemId);
      res.status(200).json({ item: toPublicItem(updated) });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId = req.params.id;
      const updates = req.body;
      const row = await this.ctx.ports.core.getItem(itemId);

      if (updates.status && updates.status !== row.status) {
        this.ctx.ports.workflow.assertItemTransition(row.status, updates.status);
      }

      await this.ctx.db.query(
        `UPDATE items
         SET public_description = COALESCE($1, public_description),
             status = COALESCE($2, status)
         WHERE id = $3`,
        [updates.public_description, updates.status, itemId],
      );

      const updated = await this.ctx.ports.core.getItem(itemId);
      res.status(200).json({ item: toPublicItem(updated) });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId = req.params.id;
      await this.ctx.db.query('DELETE FROM items WHERE id = $1', [itemId]);
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  };
}
