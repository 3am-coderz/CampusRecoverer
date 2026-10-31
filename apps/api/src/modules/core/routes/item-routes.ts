import { Router } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { ItemController } from '../controllers/item-controller.js';
import { requireAuth, requireRole } from '../../../kernel/auth.js';

export function createItemRouter(ctx: AppContext): Router {
  const router = Router();
  const ctrl = new ItemController(ctx);

  router.post('/', requireAuth, ctrl.create);
  router.post('/found', ctrl.create);
  router.post('/lost', async (req, res, next) => {
    try {
      const actorId = req.user ? req.user.id : 'guest_claimant';
      const reportId = 'lost_' + Math.random().toString(36).substring(2, 10);

      if (ctx.ports?.audit?.log) {
        try {
          await ctx.ports.audit.log({
            actor_id: actorId,
            action: 'ITEM_REPORTED',
            metadata: {
              report_id: reportId,
              type: 'LOST',
              category: req.body?.category,
              description: req.body?.description,
              lost_location: req.body?.lost_location,
            },
          });
        } catch {}
      }

      res.status(200).json({
        success: true,
        message: 'Lost item report recorded',
        report_id: reportId,
      });
    } catch (err) {
      next(err);
    }
  });
  router.get('/', ctrl.list);
  router.get('/:id', ctrl.getById);
  router.patch('/:id', requireAuth, ctrl.update);
  router.delete('/:id', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.delete);
  router.post('/:id/verify', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.verify);

  return router;
}
