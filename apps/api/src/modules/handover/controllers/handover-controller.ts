import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppContext } from '../../../kernel/app.js';
import { HandoverService } from '../services/handover-service.js';
import { BadRequestError, ForbiddenError } from '../../../kernel/errors.js';

const verifySchema = z.object({
  qr_token: z.string().min(1),
  otp: z.string().min(4).max(8),
  id_verified: z.boolean().default(false),
});

export class HandoverController {
  private service: HandoverService;

  constructor(ctx: AppContext) {
    this.service = new HandoverService(ctx);
  }

  getQr = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');
      const claimId = req.params.claimId;
      const data = await this.service.getQrForClaim(claimId, req.user.id);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  };

  verify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ForbiddenError('Authentication required');
      const parsed = verifySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0].message);
      }
      const { qr_token, otp, id_verified } = parsed.data;

      const result = await this.service.verifyAndRelease({
        qr_token,
        otp,
        security_id: req.user.id,
        id_verified,
      });

      res.status(200).json({
        success: true,
        item_id: result.item_id,
        claim_id: result.claim_id,
        message: 'Item physical custody successfully released to verified claimant.',
      });
    } catch (err) {
      next(err);
    }
  };
}
