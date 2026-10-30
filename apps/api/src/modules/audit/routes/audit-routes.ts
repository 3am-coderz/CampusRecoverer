import { Router } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { AuditController } from '../controllers/audit-controller.js';
import { requireAuth, requireRole } from '../../../kernel/auth.js';

export function createAuditRouter(ctx: AppContext): Router {
  const router = Router();
  const ctrl = new AuditController(ctx);

  // Read-only audit history endpoint: restricted to SECURITY and ADMIN roles
  router.get('/', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.list);

  return router;
}
