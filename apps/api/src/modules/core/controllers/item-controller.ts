import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppContext } from '../../../kernel/app.js';
import { BadRequestError, NotFoundError, ForbiddenError, UnauthorizedError } from '../../../kernel/errors.js';
import { RiskLevel } from '../../../kernel/ports.js';
import { toPublicItem, toDetailedItem } from '../utils/projections.js';

const createItemSchema = z.object({
  category: z.string().min(1),
  public_description: z.string().min(5),
  hidden_description: z.string().min(5),
  hidden_attributes: z.record(z.any()).default({}),
  found_location_public: z.string().min(2),
  found_date: z.string().datetime().or(z.string()),
});

const verifyItemSchema = z
  .object({
    risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  })
  .optional();

export class ItemController {
  private ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');

      const parsed = createItemSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0].message);
      }
      const data = parsed.data;
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
          req.user.id,
        ],
      );

      // Record custody event & Audit
      await this.ctx.ports.workflow.recordCustody({
        item_id: itemId,
        event: 'REPORTED',
        actor_id: req.user.id,
        location: data.found_location_public,
      });

      await this.ctx.ports.audit.log({
        actor_id: req.user.id,
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
      if (!row) throw new NotFoundError('Item not found', 'ITEM_NOT_FOUND');

      // Security check: non-staff cannot view PENDING_HANDOVER or WAITING_PERIOD unless they are the finder
      const isStaff = req.user && (req.user.role === 'SECURITY' || req.user.role === 'ADMIN');
      const isFinder = req.user && req.user.id === row.finder_id;

      if (!isStaff && !isFinder && (row.status === 'PENDING_HANDOVER' || row.status === 'WAITING_PERIOD')) {
        throw new NotFoundError('Item not found or not currently available for public viewing', 'ITEM_NOT_FOUND');
      }

      res.status(200).json({ item: toDetailedItem(row, req.user) });
    } catch (err) {
      next(err);
    }
  };

  verify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Authenticated user and role verification (defense-in-depth)
      if (!req.user) {
        throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
      }
      if (req.user.role !== 'SECURITY' && req.user.role !== 'ADMIN') {
        throw new ForbiddenError('Insufficient permissions for this resource', 'FORBIDDEN_ROLE');
      }

      const itemId = req.params.id;

      // 2. Validate optional request body schema
      if (req.body && Object.keys(req.body).length > 0) {
        const parsed = verifyItemSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new BadRequestError(parsed.error.errors[0].message);
        }
      }

      // 3. Validate item existence first
      const row = await this.ctx.ports.core.getItem(itemId);
      if (!row) {
        throw new NotFoundError(`Item with ID ${itemId} not found`, 'ITEM_NOT_FOUND');
      }

      // 4. Reject duplicate verification
      if (row.security_verified) {
        throw new BadRequestError('Item has already been verified', 'ALREADY_VERIFIED');
      }

      // 5. Validate current status permits verification (must be PENDING_HANDOVER)
      if (row.status !== 'PENDING_HANDOVER') {
        this.ctx.ports.workflow.assertItemTransition(row.status, 'WAITING_PERIOD');
        throw new BadRequestError(
          `Cannot verify item with status '${row.status}'. Only items with status 'PENDING_HANDOVER' can be verified.`,
          'ILLEGAL_ITEM_TRANSITION',
        );
      }

      // 6. Must have physical custody receipt logged at security desk
      const hasReceipt = await this.ctx.ports.workflow.hasReceipt(itemId);
      if (!hasReceipt) {
        throw new BadRequestError(
          'Cannot verify item before physical receipt has been logged at security desk',
          'MISSING_PHYSICAL_RECEIPT',
        );
      }

      this.ctx.ports.workflow.assertItemTransition(row.status, 'WAITING_PERIOD');

      let finalRisk: RiskLevel = 'LOW';
      let waitingHours = 24;

      // 7. Atomic transaction with row lock and conditional update to prevent race conditions
      await this.ctx.db.transaction(async (txClient) => {
        const lockRes = await txClient.query(
          'SELECT * FROM items WHERE id = $1 FOR UPDATE',
          [itemId],
        );
        if (lockRes.rows.length === 0) {
          throw new NotFoundError(`Item with ID ${itemId} not found`, 'ITEM_NOT_FOUND');
        }
        const current = lockRes.rows[0];

        if (current.security_verified) {
          throw new BadRequestError('Item has already been verified', 'ALREADY_VERIFIED');
        }
        if (current.status !== 'PENDING_HANDOVER') {
          this.ctx.ports.workflow.assertItemTransition(current.status, 'WAITING_PERIOD');
          throw new BadRequestError(
            `Cannot verify item with status '${current.status}'. Only items with status 'PENDING_HANDOVER' can be verified.`,
            'ILLEGAL_ITEM_TRANSITION',
          );
        }

        const hiddenAttrs = typeof current.hidden_attributes === 'string'
          ? (() => { try { return JSON.parse(current.hidden_attributes); } catch { return {}; } })()
          : current.hidden_attributes || {};

        const classifiedRisk = this.ctx.ports.risk.classify(current.category, hiddenAttrs);

        // Security rule: high-risk items cannot be downgraded
        const requestedRisk = req.body?.risk_level as RiskLevel | undefined;
        if (classifiedRisk === 'HIGH' && requestedRisk && requestedRisk !== 'HIGH') {
          throw new BadRequestError('Cannot downgrade risk level for high-risk item', 'CANNOT_DOWNGRADE_HIGH_RISK');
        }

        finalRisk = (classifiedRisk === 'HIGH' || requestedRisk === 'HIGH')
          ? 'HIGH'
          : (requestedRisk || classifiedRisk);

        waitingHours = this.ctx.config.waitingPeriods[finalRisk] || 24;
        const waitingUntil = new Date(Date.now() + waitingHours * 3600 * 1000).toISOString();

        const updateRes = await txClient.query(
          `UPDATE items
           SET status = 'WAITING_PERIOD', security_verified = TRUE, risk_level = $1, waiting_until = $2
           WHERE id = $3 AND status = 'PENDING_HANDOVER' AND security_verified = FALSE`,
          [finalRisk, waitingUntil, itemId],
        );

        if (updateRes.rowCount === 0) {
          throw new BadRequestError('Item has already been verified', 'ALREADY_VERIFIED');
        }
      });

      // 8. Record custody event & Audit trail
      await this.ctx.ports.workflow.recordCustody({
        item_id: itemId,
        event: 'STORED',
        actor_id: req.user.id,
        location: 'Security Lost & Found Storage',
      });

      await this.ctx.ports.audit.log({
        actor_id: req.user.id,
        action: 'ITEM_VERIFIED',
        item_id: itemId,
        metadata: { risk_level: finalRisk, waiting_hours: waitingHours },
      });

      // 9. Return sanitized public projection
      const updated = await this.ctx.ports.core.getItem(itemId);
      res.status(200).json({ item: toPublicItem(updated) });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
      }

      const itemId = req.params.id;
      const updates = req.body;
      const row = await this.ctx.ports.core.getItem(itemId);

      const isStaff = req.user.role === 'SECURITY' || req.user.role === 'ADMIN';
      const isFinder = req.user.id === row.finder_id;

      if (!isStaff && !isFinder) {
        throw new ForbiddenError('You do not have permission to update this item', 'FORBIDDEN_RESOURCE');
      }

      // Non-staff finders cannot alter status
      if (!isStaff && updates.status && updates.status !== row.status) {
        throw new ForbiddenError('Only security officers and administrators can change item status', 'FORBIDDEN_ROLE');
      }

      // Finders cannot edit item once verified or processed past PENDING_HANDOVER
      if (!isStaff && row.status !== 'PENDING_HANDOVER') {
        throw new BadRequestError('Cannot modify item after it has been verified or processed', 'ITEM_LOCKED');
      }

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
      await this.ctx.ports.core.getItem(itemId);
      await this.ctx.db.query('DELETE FROM items WHERE id = $1', [itemId]);
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  };
}
