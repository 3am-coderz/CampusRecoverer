import { Router } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { ItemController } from '../controllers/item-controller.js';
import { requireAuth, requireRole } from '../../../kernel/auth.js';

export function createItemRouter(ctx: AppContext): Router {
  const router = Router();
  const ctrl = new ItemController(ctx);

  router.post('/', requireAuth, ctrl.create);
  router.get('/', ctrl.list);
  router.get('/:id', ctrl.getById);
  router.patch('/:id', requireAuth, ctrl.update);
  router.delete('/:id', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.delete);
  router.post('/:id/verify', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.verify);

  return router;
}
