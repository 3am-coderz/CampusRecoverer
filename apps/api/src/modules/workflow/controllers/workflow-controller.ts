import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppContext } from '../../../kernel/app.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../kernel/errors.js';
import { CustodyService } from '../services/custody-service.js';
import { QuestionsService } from '../services/questions-service.js';

const receiveItemSchema = z.object({
  storage_location: z.string().min(2),
});

const answersSchema = z.object({
  answers: z.array(
    z.object({
      question_id: z.string().min(1),
      answer: z.string().min(1),
    }),
  ).min(1),
});

const disputeSchema = z.object({
  item_id: z.string().min(1),
  reason: z.string().min(3),
  claim_ids: z.array(z.string()).default([]),
});

const dispositionSchema = z.object({
  disposition: z.enum(['STORE', 'DONATE', 'DISPOSE']),
  notes: z.string().optional(),
});

export class WorkflowController {
  private ctx: AppContext;
  private custodyService: CustodyService;
  private questionsService: QuestionsService;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
    this.custodyService = new CustodyService(ctx.db);
    this.questionsService = new QuestionsService(ctx.db, ctx.ports.matching);
  }

  receiveItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');
      const itemId = req.params.id;
      const parsed = receiveItemSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0].message);
      }
      const { storage_location } = parsed.data;

      // Record RECEIVED_BY_SECURITY
      await this.custodyService.record({
        item_id: itemId,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: req.user.id,
        location: storage_location,
      });

      // Record STORED
      await this.custodyService.record({
        item_id: itemId,
        event: 'STORED',
        actor_id: req.user.id,
        location: storage_location,
      });

      await this.ctx.ports.audit.log({
        actor_id: req.user.id,
        action: 'ITEM_RECEIVED',
        item_id: itemId,
        metadata: { storage_location },
      });

      res.status(200).json({ success: true, message: 'Item checked in and stored in physical custody.' });
    } catch (err) {
      next(err);
    }
  };

  getCustodyTimeline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId = req.params.id;
      const events = await this.custodyService.getTimeline(itemId);
      res.status(200).json({ custody_events: events });
    } catch (err) {
      next(err);
    }
  };

  getQuestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');
      const claimId = req.params.id;
      const questions = await this.questionsService.generateQuestions(claimId, req.user.id);
      res.status(200).json({ questions });
    } catch (err) {
      next(err);
    }
  };

  submitAnswers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');
      const claimId = req.params.id;
      const parsed = answersSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0].message);
      }

      await this.questionsService.evaluateAnswers(claimId, req.user.id, parsed.data.answers);

      await this.ctx.ports.audit.log({
        actor_id: req.user.id,
        action: 'QUESTIONS_ANSWERED',
        claim_id: claimId,
        metadata: { question_count: parsed.data.answers.length },
      });

      // Security requirement: Never return correctness to claimant!
      res.status(200).json({
        received: true,
        message: 'Your verification answers have been recorded and sent for desk review.',
      });
    } catch (err) {
      next(err);
    }
  };

  getDashboard = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const pendingRes = await this.ctx.db.query(
        `SELECT COUNT(*) as cnt FROM items WHERE status = 'PENDING_HANDOVER'`,
      );
      const awaitingRes = await this.ctx.db.query(
        `SELECT COUNT(*) as cnt FROM items WHERE status = 'APPROVED_AWAITING_COLLECTION'`,
      );
      const activeClaimsRes = await this.ctx.db.query(
        `SELECT COUNT(*) as cnt FROM claims WHERE status IN ('SUBMITTED', 'SCORED', 'MANUAL_REVIEW')`,
      );
      const highRiskRes = await this.ctx.db.query(
        `SELECT COUNT(*) as cnt FROM items WHERE risk_level = 'HIGH'`,
      );
      const expiredRes = await this.ctx.db.query(
        `SELECT COUNT(*) as cnt FROM items WHERE status = 'EXPIRED'`,
      );

      res.status(200).json({
        pending_reports: parseInt(pendingRes.rows[0]?.cnt || '0', 10),
        awaiting_handover: parseInt(awaitingRes.rows[0]?.cnt || '0', 10),
        active_claims: parseInt(activeClaimsRes.rows[0]?.cnt || '0', 10),
        high_risk_items: parseInt(highRiskRes.rows[0]?.cnt || '0', 10),
        expired_items: parseInt(expiredRes.rows[0]?.cnt || '0', 10),
      });
    } catch (err) {
      next(err);
    }
  };

  getItems = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const resDb = await this.ctx.db.query(
        `SELECT i.*, u.name as finder_name, u.email as finder_email
         FROM items i
         JOIN users u ON i.finder_id = u.id
         ORDER BY i.created_at DESC`,
      );
      const items = resDb.rows.map((r: any) => {
        if (typeof r.hidden_attributes === 'string') {
          try { r.hidden_attributes = JSON.parse(r.hidden_attributes); } catch {}
        }
        return r;
      });
      res.status(200).json({ items });
    } catch (err) {
      next(err);
    }
  };

  getClaims = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const resDb = await this.ctx.db.query(
        `SELECT c.*, u.name as claimant_name, u.email as claimant_email, i.public_description as item_title, i.risk_level
         FROM claims c
         JOIN users u ON c.claimant_id = u.id
         JOIN items i ON c.item_id = i.id
         ORDER BY c.created_at DESC`,
      );

      const claimsWithSummaries = await Promise.all(
        resDb.rows.map(async (row: any) => {
          if (typeof row.claimed_attributes === 'string') {
            try { row.claimed_attributes = JSON.parse(row.claimed_attributes); } catch {}
          }
          const summary = await this.questionsService.getVerificationSummary(row.id);
          return {
            ...row,
            verification_summary: summary,
          };
        }),
      );

      res.status(200).json({ claims: claimsWithSummaries });
    } catch (err) {
      next(err);
    }
  };

  getHiddenData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');
      const itemId = req.params.id;
      const item = await this.ctx.ports.core.getItem(itemId);

      // Audited as HIDDEN_DATA_VIEWED
      await this.ctx.ports.audit.log({
        actor_id: req.user.id,
        action: 'HIDDEN_DATA_VIEWED',
        item_id: itemId,
        metadata: { category: item.category },
      });

      res.status(200).json({
        hidden_description: item.hidden_description,
        hidden_attributes: item.hidden_attributes,
      });
    } catch (err) {
      next(err);
    }
  };

  createDispute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');
      const parsed = disputeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0].message);
      }
      const data = parsed.data;
      const disputeId = 'disp_' + Math.random().toString(36).substring(2, 10);

      await this.ctx.db.query(
        `INSERT INTO disputes (id, item_id, reason, claim_ids, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [disputeId, data.item_id, data.reason, JSON.stringify(data.claim_ids)],
      );

      await this.ctx.ports.audit.log({
        actor_id: req.user.id,
        action: 'DISPUTE_FLAGGED',
        item_id: data.item_id,
        metadata: { reason: data.reason },
      });

      res.status(201).json({
        dispute: {
          id: disputeId,
          item_id: data.item_id,
          reason: data.reason,
          claim_ids: data.claim_ids,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  listDisputes = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const resDb = await this.ctx.db.query('SELECT * FROM disputes ORDER BY created_at DESC');
      const disputes = resDb.rows.map((r: any) => ({
        ...r,
        claim_ids: typeof r.claim_ids === 'string' ? JSON.parse(r.claim_ids) : r.claim_ids,
      }));
      res.status(200).json({ disputes });
    } catch (err) {
      next(err);
    }
  };

  decideDisposition = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');
      const itemId = req.params.id;
      const parsed = dispositionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0].message);
      }
      const { disposition, notes } = parsed.data;

      const item = await this.ctx.ports.core.getItem(itemId);
      if (item.status !== 'EXPIRED') {
        throw new BadRequestError(
          `Disposition can only be decided for EXPIRED items. Current status: ${item.status}`,
          'ITEM_NOT_EXPIRED',
        );
      }

      let newStatus: any = 'DISPOSED';
      if (disposition === 'STORE') newStatus = 'STORED_LONG_TERM';
      else if (disposition === 'DONATE') newStatus = 'DONATED';

      this.ctx.ports.workflow.assertItemTransition('EXPIRED', newStatus);

      const decisionId = 'disp_dec_' + Math.random().toString(36).substring(2, 10);
      await this.ctx.db.query(
        `INSERT INTO disposition_decisions (id, item_id, decision, notes, decided_by, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [decisionId, itemId, disposition, notes || null, req.user.id],
      );

      await this.ctx.ports.core.setItemStatus(itemId, newStatus);

      await this.ctx.ports.audit.log({
        actor_id: req.user.id,
        action: 'DISPOSITION_DECIDED',
        item_id: itemId,
        metadata: { disposition, new_status: newStatus },
      });

      res.status(200).json({ success: true, item_status: newStatus });
    } catch (err) {
      next(err);
    }
  };
}
