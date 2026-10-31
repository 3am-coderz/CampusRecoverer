import { Router } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { AuthController } from '../controllers/auth-controller.js';
import { authRateLimiter } from '../middleware/rate-limiters.js';
import { requireAuth } from '../../../kernel/auth.js';

export function createAuthRouter(ctx: AppContext): Router {
  const router = Router();
  const ctrl = new AuthController(ctx);

  router.post('/register', authRateLimiter, ctrl.register);
  router.post('/login', authRateLimiter, ctrl.login);
  router.post('/logout', ctrl.logout);
  router.get('/me', requireAuth, ctrl.me);

  return router;
}
