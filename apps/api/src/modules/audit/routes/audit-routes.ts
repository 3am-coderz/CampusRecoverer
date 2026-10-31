import { Router } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { AuditController } from '../controllers/audit-controller.js';
import { requireAuth, requireRole } from '../../../kernel/auth.js';

export function createAuditRouter(ctx: AppContext): Router {
  const router = Router();
  const ctrl = new AuditController(ctx);

  router.use(requireAuth, requireRole('SECURITY', 'ADMIN'));
  router.get('/', ctrl.getLogs);
  router.get('/verify-chain', ctrl.verifyChain);

  return router;
}
