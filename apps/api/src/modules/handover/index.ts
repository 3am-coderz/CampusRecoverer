import { Express } from 'express';
import { AppContext } from '../../kernel/app.js';
import { AppPorts } from '../../kernel/ports.js';
import { HandoverService } from './services/handover-service.js';
import { createHandoverRouter } from './routes/handover-routes.js';

export function providePorts(ctx: AppContext): Partial<AppPorts> {
  return {
    handover: new HandoverService(ctx),
  };
}

export function register(app: Express, ctx: AppContext): void {
  const router = createHandoverRouter(ctx);
  app.use('/handover', router);
}
