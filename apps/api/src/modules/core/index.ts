import { Express } from 'express';
import cron from 'node-cron';
import { AppContext } from '../../kernel/app.js';
import { AppPorts } from '../../kernel/ports.js';
import { CoreServices } from './services/core-services.js';
import { HttpMatchingClient } from './clients/matching-client.js';
import { createAuthRouter } from './routes/auth-routes.js';
import { createItemRouter } from './routes/item-routes.js';
import { createClaimRouter } from './routes/claim-routes.js';
import { createNotificationRouter } from './routes/notification-routes.js';
import { requireAuth, requireRole } from '../../kernel/auth.js';
import { ClaimController } from './controllers/claim-controller.js';

let cronTask: cron.ScheduledTask | null = null;

export function providePorts(ctx: AppContext): Partial<AppPorts> {
  return {
    core: new CoreServices(ctx.db),
    matching: new HttpMatchingClient(ctx.config.matchingServiceUrl, ctx.config.internalApiKey),
  };
}

export function register(app: Express, ctx: AppContext): void {
  const authRouter = createAuthRouter(ctx);
  const itemRouter = createItemRouter(ctx);
  const claimRouter = createClaimRouter(ctx);
  const notificationRouter = createNotificationRouter(ctx);

  app.use('/auth', authRouter);
  app.use('/items', itemRouter);
  app.use('/claims', claimRouter);
  app.use('/notifications', notificationRouter);

  // Cross-reference route: /items/:id/claims
  const claimCtrl = new ClaimController(ctx);
  app.get('/items/:id/claims', requireAuth, requireRole('SECURITY', 'ADMIN'), claimCtrl.listForItem);

  // Background cron job: moves items from WAITING_PERIOD to OPEN_FOR_CLAIMS
  if (process.env.NODE_ENV !== 'test' && !cronTask) {
    cronTask = cron.schedule('*/1 * * * *', async () => {
      try {
        const res = await ctx.db.query(
          `SELECT id, status FROM items
           WHERE status = 'WAITING_PERIOD' AND waiting_until <= CURRENT_TIMESTAMP`,
        );
        for (const row of res.rows) {
          ctx.ports.workflow.assertItemTransition('WAITING_PERIOD', 'OPEN_FOR_CLAIMS');
          await ctx.ports.core.setItemStatus(row.id, 'OPEN_FOR_CLAIMS');
          ctx.logger.info(`Promoted item ${row.id} from WAITING_PERIOD to OPEN_FOR_CLAIMS`);
        }
      } catch (err: any) {
        ctx.logger.error(`Cron error moving items to OPEN_FOR_CLAIMS: ${err.message}`);
      }
    });
  }
}
