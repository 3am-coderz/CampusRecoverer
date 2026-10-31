import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppContext } from '../../../kernel/app.js';
import { HandoverController } from '../controllers/handover-controller.js';
import { requireAuth, requireRole } from '../../../kernel/auth.js';

const handoverVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many handover verification attempts. Please wait before retrying.',
    },
  },
});

export function createHandoverRouter(ctx: AppContext): Router {
  const router = Router();
  const ctrl = new HandoverController(ctx);

  router.get('/claims/:claimId/qr', requireAuth, ctrl.getQr);
  router.post('/verify', requireAuth, requireRole('SECURITY', 'ADMIN'), handoverVerifyRateLimiter, ctrl.verify);

  return router;
}
