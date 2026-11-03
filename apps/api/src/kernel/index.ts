import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

// Dev test accounts seeded into pg-mem so quick-login always works
// All passwords: password123
const DEV_SEED_USERS = [
  { id: 'usr_student_1',  email: 'student1@campus.edu', name: 'Alex Rivera',              role: 'STUDENT',  password_hash: '$2b$10$GB.WIS8vjTC2UmNsxeE.5eid4UJhXr90kJmkf/Kvj3rmOWPhGPJvG', created_at: '2026-10-20T08:00:00Z' },
  { id: 'usr_finder_1',   email: 'finder1@campus.edu',  name: 'Jordan Lee',                role: 'FINDER',   password_hash: '$2b$10$GB.WIS8vjTC2UmNsxeE.5eid4UJhXr90kJmkf/Kvj3rmOWPhGPJvG', created_at: '2026-10-20T08:15:00Z' },
  { id: 'usr_security_1', email: 'security@campus.edu', name: 'Officer Sarah Miller',      role: 'SECURITY', password_hash: '$2b$10$GB.WIS8vjTC2UmNsxeE.5eid4UJhXr90kJmkf/Kvj3rmOWPhGPJvG', created_at: '2026-10-15T09:00:00Z' },
  { id: 'usr_admin_1',    email: 'admin@campus.edu',    name: 'Chief Security Admin Chen', role: 'ADMIN',    password_hash: '$2b$10$GB.WIS8vjTC2UmNsxeE.5eid4UJhXr90kJmkf/Kvj3rmOWPhGPJvG', created_at: '2026-10-10T09:00:00Z' },
  { id: 'usr_claimant_2', email: 'student2@campus.edu', name: 'Taylor Morgan',             role: 'STUDENT',  password_hash: '$2b$10$GB.WIS8vjTC2UmNsxeE.5eid4UJhXr90kJmkf/Kvj3rmOWPhGPJvG', created_at: '2026-10-21T10:00:00Z' },
];

async function main() {
  const { app, ctx } = await createApp();

  // When running with pg-mem (no real DB), seed dev test accounts automatically
  if (ctx.db.isMemory) {
    for (const u of DEV_SEED_USERS) {
      try {
        const exists = await ctx.db.query('SELECT id FROM users WHERE id = $1', [u.id]);
        if (exists.rows.length === 0) {
          await ctx.db.query(
            `INSERT INTO users (id, email, password_hash, name, role, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [u.id, u.email, u.password_hash, u.name, u.role, u.created_at],
          );
          logger.info(`Dev seed: created user ${u.email} (${u.role})`);
        }
      } catch (err: any) {
        logger.warn(`Dev seed: skipped ${u.email} — ${err.message}`);
      }
    }
  }

  app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Campus Recoverer API listening on port ${config.port} (${config.nodeEnv})`);
  });
}

main().catch((err) => {
  logger.error(err, 'Failed to start API server');
  process.exit(1);
});
