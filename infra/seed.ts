import fs from 'fs';
import path from 'path';
import { initDb } from '../apps/api/src/kernel/db.js';
import { runMigrations } from '../apps/api/src/kernel/migration-runner.js';
import { logger } from '../apps/api/src/kernel/logger.js';

async function seed() {
  logger.info('Initializing database for seeding...');
  const db = await initDb();

  logger.info('Running migrations before seed...');
  await runMigrations(db, path.resolve(process.cwd(), 'apps/api/db/migrations'));

  const seedPath = path.resolve(process.cwd(), 'contracts/seed-data.json');
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed data file not found at ${seedPath}`);
  }

  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  // 1. Seed Users
  for (const user of seedData.users) {
    const existing = await db.query('SELECT id FROM users WHERE id = $1 OR email = $2', [user.id, user.email]);
    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO users (id, email, password_hash, name, role, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, user.email, user.password_hash, user.name, user.role, user.created_at],
      );
      logger.info(`Seeded user: ${user.email} (${user.role})`);
    }
  }

  // 2. Seed Items
  for (const item of seedData.items) {
    const existing = await db.query('SELECT id FROM items WHERE id = $1', [item.id]);
    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO items (
          id, category, public_description, hidden_description, hidden_attributes,
          found_location_public, found_date, status, risk_level, security_verified,
          finder_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          item.id,
          item.category,
          item.public_description,
          item.hidden_description,
          JSON.stringify(item.hidden_attributes),
          item.found_location_public,
          item.found_date,
          item.status,
          item.risk_level,
          item.security_verified,
          item.finder_id,
          item.created_at,
        ],
      );
      logger.info(`Seeded item: ${item.id} (${item.category})`);
    }
  }

  // 3. Seed Claims
  for (const claim of seedData.claims) {
    const existing = await db.query('SELECT id FROM claims WHERE id = $1', [claim.id]);
    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO claims (
          id, item_id, claimant_id, description, claimed_attributes,
          lost_date, lost_location, structured_score, semantic_score,
          final_score, confidence_label, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          claim.id,
          claim.item_id,
          claim.claimant_id,
          claim.description,
          JSON.stringify(claim.claimed_attributes),
          claim.lost_date,
          claim.lost_location,
          claim.structured_score,
          claim.semantic_score,
          claim.final_score,
          claim.confidence_label,
          claim.status,
          claim.created_at,
        ],
      );
      logger.info(`Seeded claim: ${claim.id}`);
    }
  }

  logger.info('Database seeding completed successfully.');
  await db.close();
}

seed().catch((err) => {
  logger.error(err, 'Seeding failed');
  process.exit(1);
});
