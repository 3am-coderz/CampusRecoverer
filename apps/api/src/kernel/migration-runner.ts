import fs from 'fs';
import path from 'path';
import { DatabaseContext } from './db.js';
import { logger } from './logger.js';

export const MIGRATION_ORDER = ['core', 'audit', 'handover', 'workflow'] as const;

export async function runMigrations(
  db: DatabaseContext,
  migrationsBaseDir?: string,
): Promise<{ applied: Array<{ module: string; filename: string }> }> {
  const baseDir =
    migrationsBaseDir ||
    path.resolve(process.cwd(), 'db/migrations');

  // Ensure migrations tracking table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      module VARCHAR(50) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (module, filename)
    );
  `);

  const appliedList: Array<{ module: string; filename: string }> = [];

  for (const mod of MIGRATION_ORDER) {
    const modDir = path.join(baseDir, mod);
    if (!fs.existsSync(modDir)) {
      continue;
    }

    const files = fs
      .readdirSync(modDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const alreadyApplied = await db.query(
        `SELECT 1 FROM schema_migrations WHERE module = $1 AND filename = $2`,
        [mod, file],
      );

      if (alreadyApplied.rows.length === 0) {
        const filePath = path.join(modDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        // Execute migration
        logger.info(`Applying migration: [${mod}] ${file}`);
        try {
          await db.query(sql);
        } catch (execErr: any) {
          if (db.isMemory) {
            const statements = sql
              .split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            for (const stmt of statements) {
              try {
                await db.query(stmt);
              } catch (stmtErr: any) {
                logger.warn(`pg-mem notice for [${mod}] ${file}: skipped unsupported statement (${stmtErr.message.slice(0, 80)})`);
              }
            }
          } else {
            throw execErr;
          }
        }

        await db.query(
          `INSERT INTO schema_migrations (module, filename) VALUES ($1, $2)`,
          [mod, file],
        );

        appliedList.push({ module: mod, filename: file });
      }
    }
  }

  return { applied: appliedList };
}
