import { Express } from 'express';
import { AppContext } from '../../kernel/app.js';
import { createAdminRouter } from './routes/admin-routes.js';

export * from './services/admin-service.js';
export * from './controllers/admin-controller.js';
export * from './routes/admin-routes.js';

export function register(app: Express, ctx: AppContext): void {
  const router = createAdminRouter(ctx);
  app.use('/admin', router);
}
