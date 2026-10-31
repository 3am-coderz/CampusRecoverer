import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppContext } from '../../../kernel/app.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../kernel/errors.js';

const createClaimSchema = z.object({
  item_id: z.string().min(1),
  description: z.string().min(5),
  claimed_attributes: z.record(z.any()).default({}),
  lost_date: z.string().datetime().or(z.string()),
  lost_location: z.string().min(2),
});

export class ClaimController {
  private ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');

      const parsed = createClaimSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0].message);
      }
      const data = parsed.data;

      // Fetch item
      const item = await this.ctx.ports.core.getItem(data.item_id);

      // Verify item status is OPEN_FOR_CLAIMS
      if (item.status !== 'OPEN_FOR_CLAIMS') {
        throw new BadRequestError(
          `Cannot submit claim: item status is ${item.status}. Claims are only accepted when OPEN_FOR_CLAIMS.`,
          'ITEM_NOT_OPEN_FOR_CLAIMS',
        );
      }

      // Invariant: Finder cannot claim own item
      if (req.user.id === item.finder_id) {
        throw new ForbiddenError(
          'Finders are strictly prohibited from submitting claims on items they reported.',
          'FINDER_CANNOT_CLAIM_OWN_ITEM',
        );
      }

      // Check unique active claim
      const existing = await this.ctx.db.query(
        'SELECT id FROM claims WHERE item_id = $1 AND claimant_id = $2',
        [data.item_id, req.user.id],
      );
      if (existing.rows.length > 0) {
        throw new BadRequestError('You have already submitted a claim for this item', 'DUPLICATE_CLAIM');
      }

      const claimId = 'claim_' + Math.random().toString(36).substring(2, 10);

      // Call matching engine
      const matchResult = await this.ctx.ports.matching.score(item, {
        description: data.description,
        claimed_attributes: data.claimed_attributes,
        lost_date: data.lost_date,
        lost_location: data.lost_location,
      });

      const initialStatus = 'SCORED';

      // Insert claim
      await this.ctx.db.query(
        `INSERT INTO claims (
          id, item_id, claimant_id, description, claimed_attributes,
          lost_date, lost_location, structured_score, semantic_score,
          final_score, confidence_label, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)`,
        [
          claimId,
          data.item_id,
          req.user.id,
          data.description,
          JSON.stringify(data.claimed_attributes),
          new Date(data.lost_date).toISOString(),
          data.lost_location,
          matchResult.structured_score,
          matchResult.semantic_score,
          matchResult.final_score,
          matchResult.confidence,
          initialStatus,
        ],
      );

      // Audits
      await this.ctx.ports.audit.log({
        actor_id: req.user.id,
        action: 'CLAIM_CREATED',
        item_id: data.item_id,
        claim_id: claimId,
        metadata: { confidence: matchResult.confidence },
      });

      await this.ctx.ports.audit.log({
        actor_id: 'system:matching',
        action: 'CLAIM_SCORED',
        item_id: data.item_id,
        claim_id: claimId,
        metadata: {
          confidence: matchResult.confidence,
          ml_used: matchResult.ml_used,
          explanation: matchResult.explanation,
        },
      });

      // Call resolveClaims from workflow
      const resolveResult = await this.ctx.ports.workflow.resolveClaims(data.item_id);
      if (resolveResult.item_status !== item.status) {
        await this.ctx.ports.core.setItemStatus(data.item_id, resolveResult.item_status);
      }
      for (const update of resolveResult.claim_updates) {
        await this.ctx.ports.core.setClaimStatus(update.claim_id, update.status);
      }

      const claim = await this.ctx.ports.core.getClaim(claimId);
      res.status(201).json({ claim });
    } catch (err) {
      next(err);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');
      const resDb = await this.ctx.db.query(
        'SELECT * FROM claims WHERE claimant_id = $1 ORDER BY created_at DESC',
        [req.user.id],
      );
      const claims = resDb.rows.map((row: any) => {
        if (typeof row.claimed_attributes === 'string') {
          try { row.claimed_attributes = JSON.parse(row.claimed_attributes); } catch {}
        }
        return row;
      });
      res.status(200).json({ claims });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const claimId = req.params.id;
      const claim = await this.ctx.ports.core.getClaim(claimId);
      const isStaff = req.user && (req.user.role === 'SECURITY' || req.user.role === 'ADMIN');
      const isOwner = req.user && req.user.id === claim.claimant_id;

      if (!isStaff && !isOwner) {
        throw new ForbiddenError('You do not have permission to view this claim');
      }

      res.status(200).json({ claim });
    } catch (err) {
      next(err);
    }
  };

  listForItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId = req.params.id;
      const claims = await this.ctx.ports.core.listClaimsForItem(itemId);
      res.status(200).json({ claims });
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const claimId = req.params.id;
      const { status } = req.body;
      const claim = await this.ctx.ports.core.getClaim(claimId);

      this.ctx.ports.workflow.assertClaimTransition(claim.status, status);
      await this.ctx.ports.core.setClaimStatus(claimId, status);

      const updated = await this.ctx.ports.core.getClaim(claimId);
      res.status(200).json({ claim: updated });
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const claimId = req.params.id;
      const claim = await this.ctx.ports.core.getClaim(claimId);
      const item = await this.ctx.ports.core.getItem(claim.item_id);

      // Check risk-level verification requirement:
      // MEDIUM/HIGH risk require a verificationSummary with questions answered
      if (item.risk_level === 'MEDIUM' || item.risk_level === 'HIGH') {
        const summary = await this.ctx.ports.workflow.verificationSummary(claimId);
        if (summary.questions_answered === 0) {
          throw new BadRequestError(
            `Cannot approve claim for ${item.risk_level}-risk item: claimant has not answered ownership verification questions.`,
            'VERIFICATION_QUESTIONS_REQUIRED',
          );
        }
      }

      // Assert legal transitions
      this.ctx.ports.workflow.assertClaimTransition(claim.status, 'APPROVED');
      this.ctx.ports.workflow.assertItemTransition(item.status, 'APPROVED_AWAITING_COLLECTION');

      let handoverResult: any = null;

      // Run approval inside transaction
      await this.ctx.db.transaction(async (txClient) => {
        await txClient.query(`UPDATE claims SET status = 'APPROVED' WHERE id = $1`, [claimId]);
        await txClient.query(`UPDATE items SET status = 'APPROVED_AWAITING_COLLECTION' WHERE id = $1`, [
          claim.item_id,
        ]);

        // Issue handover QR and OTP
        handoverResult = await this.ctx.ports.handover.issue(claimId, { tx: txClient });
      });

      // Dispatch notification with OTP to claimant
      const otpMsg = handoverResult.otp
        ? ` Your pickup verification OTP is: ${handoverResult.otp}. Do not share this with anyone except security at pickup desk.`
        : '';

      await this.ctx.ports.core.createNotification({
        user_id: claim.claimant_id,
        title: 'Claim Approved! Collection Ready',
        message: `Your claim for "${item.public_description}" has been approved.${otpMsg} Open your claim details to view your pickup QR code.`,
      });

      // Audit log
      await this.ctx.ports.audit.log({
        actor_id: req.user!.id,
        action: 'CLAIM_APPROVED',
        item_id: item.id,
        claim_id: claimId,
        metadata: {
          handover_id: handoverResult.handover_id,
          expires_at: handoverResult.expires_at,
        },
      });

      const updated = await this.ctx.ports.core.getClaim(claimId);
      res.status(200).json({
        claim: updated,
        handover_id: handoverResult.handover_id,
        expires_at: handoverResult.expires_at,
      });
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const claimId = req.params.id;
      const { reason } = req.body;
      const claim = await this.ctx.ports.core.getClaim(claimId);

      this.ctx.ports.workflow.assertClaimTransition(claim.status, 'REJECTED');
      await this.ctx.ports.core.setClaimStatus(claimId, 'REJECTED');

      await this.ctx.ports.core.createNotification({
        user_id: claim.claimant_id,
        title: 'Claim Update',
        message: `Your claim for item ${claim.item_id} was reviewed and rejected.${reason ? ` Reason: ${reason}` : ''}`,
      });

      await this.ctx.ports.audit.log({
        actor_id: req.user!.id,
        action: 'CLAIM_REJECTED',
        item_id: claim.item_id,
        claim_id: claimId,
        metadata: { reason },
      });

      const updated = await this.ctx.ports.core.getClaim(claimId);
      res.status(200).json({ claim: updated });
    } catch (err) {
      next(err);
    }
  };
}
