import { Router } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { AdminController } from '../controllers/admin-controller.js';
import { requireAuth, requireRole } from '../../../kernel/auth.js';

export function createAdminRouter(ctx: AppContext): Router {
  const router = Router();
  const ctrl = new AdminController(ctx);

  // All administrative endpoints require authentication and ADMIN role
  router.use(requireAuth, requireRole('ADMIN'));

  router.get('/dashboard', ctrl.getDashboard);
  router.get('/items', ctrl.listItems);
  router.get('/claims', ctrl.listClaims);
  router.get('/users', ctrl.listUsers);

  return router;
}
