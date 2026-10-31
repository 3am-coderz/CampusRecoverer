import { Express } from 'express';
import cron from 'node-cron';
import { AppContext } from '../../kernel/app.js';
import { AppPorts } from '../../kernel/ports.js';
import { RiskClassifier } from './services/risk-classifier.js';
import { WorkflowService } from './services/workflow-service.js';
import { createWorkflowRouter } from './routes/workflow-routes.js';

let expiryCronTask: cron.ScheduledTask | null = null;

export function providePorts(ctx: AppContext): Partial<AppPorts> {
  return {
    risk: new RiskClassifier(),
    workflow: new WorkflowService(ctx),
  };
}

export function register(app: Express, ctx: AppContext): void {
  const router = createWorkflowRouter(ctx);
  app.use('/workflow', router);

  // Background retention cron job: moves unclaimed items to EXPIRED
  if (process.env.NODE_ENV !== 'test' && !expiryCronTask) {
    expiryCronTask = cron.schedule('*/5 * * * *', async () => {
      try {
        const retentionDays = ctx.config.retentionPeriodDays;
        const res = await ctx.db.query(
          `SELECT id, status FROM items
           WHERE status IN ('OPEN_FOR_CLAIMS', 'UNDER_REVIEW')
             AND created_at <= (CURRENT_TIMESTAMP - INTERVAL '${retentionDays} days')`,
        );

        for (const row of res.rows) {
          ctx.ports.workflow.assertItemTransition(row.status, 'EXPIRED');
          await ctx.ports.core.setItemStatus(row.id, 'EXPIRED');
          await ctx.ports.audit.log({
            actor_id: 'system:cron',
            action: 'ITEM_EXPIRED',
            item_id: row.id,
            metadata: { retention_days: retentionDays },
          });
          ctx.logger.info(`Retention window elapsed. Marked item ${row.id} as EXPIRED.`);
        }
      } catch (err: any) {
        ctx.logger.error(`Retention cron error: ${err.message}`);
      }
    });
  }
}
