import { Router } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { NotificationController } from '../controllers/notification-controller.js';
import { requireAuth } from '../../../kernel/auth.js';

export function createNotificationRouter(ctx: AppContext): Router {
  const router = Router();
  const ctrl = new NotificationController(ctx);

  router.get('/', requireAuth, ctrl.list);
  router.patch('/:id/read', requireAuth, ctrl.markRead);

  return router;
}
