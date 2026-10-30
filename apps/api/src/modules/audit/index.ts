import { Express } from 'express';
import { AppContext } from '../../kernel/app.js';
import { AppPorts } from '../../kernel/ports.js';
import { AuditService } from './services/audit-service.js';
import { createAuditRouter } from './routes/audit-routes.js';

export * from './services/audit-service.js';
export * from './controllers/audit-controller.js';
export * from './routes/audit-routes.js';

export function providePorts(ctx: AppContext): Partial<AppPorts> {
  return {
    audit: new AuditService(ctx.db),
  };
}

export function register(app: Express, ctx: AppContext): void {
  const router = createAuditRouter(ctx);
  app.use('/audit', router);
}
