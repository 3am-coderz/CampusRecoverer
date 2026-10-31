import { Router } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { WorkflowController } from '../controllers/workflow-controller.js';
import { requireAuth, requireRole } from '../../../kernel/auth.js';

export function createWorkflowRouter(ctx: AppContext): Router {
  const router = Router();
  const ctrl = new WorkflowController(ctx);

  // Custody desk checkin
  router.post('/items/:id/receive', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.receiveItem);
  router.get('/items/:id/custody', requireAuth, ctrl.getCustodyTimeline);

  // Ownership questions & answers
  router.get('/claims/:id/questions', requireAuth, ctrl.getQuestions);
  router.post('/claims/:id/answers', requireAuth, ctrl.submitAnswers);

  // Admin & Security Management
  router.get('/dashboard', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.getDashboard);
  router.get('/items', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.getItems);
  router.get('/claims', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.getClaims);
  router.get('/items/:id/hidden', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.getHiddenData);

  // Disputes & Dispositions
  router.post('/disputes', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.createDispute);
  router.get('/disputes', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.listDisputes);
  router.post('/items/:id/disposition', requireAuth, requireRole('SECURITY', 'ADMIN'), ctrl.decideDisposition);

  return router;
}
