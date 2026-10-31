import { Router } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { ClaimController } from '../controllers/claim-controller.js';
import { claimRateLimiter } from '../middleware/rate-limiters.js';
import { requireAuth, requireRole } from '../../../kernel/auth.js';

export function createClaimRouter(ctx: AppContext): Router {
  const router = Router();
  const ctrl = new ClaimController(ctx);

  router.post('/', requireAuth, claimRateLimiter, ctrl.create);
  router.get('/mine', requireAuth, ctrl.listMine);
  router.get('/:id', requireAuth, ctrl.getById);
  router.patch('/:id/status', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.updateStatus);
  router.post('/:id/approve', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.approve);
  router.post('/:id/reject', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.reject);

  return router;
}
