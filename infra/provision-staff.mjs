import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { STAFF_EMAIL, STAFF_NAME, STAFF_PASSWORD, STAFF_ROLE } = process.env;
if (!STAFF_EMAIL || !STAFF_NAME || !STAFF_PASSWORD || !['SECURITY', 'ADMIN'].includes(STAFF_ROLE)) {
  throw new Error('Set STAFF_EMAIL, STAFF_NAME, STAFF_PASSWORD, and STAFF_ROLE (SECURITY or ADMIN).');
}
if (STAFF_PASSWORD.length < 12) {
  throw new Error('Staff passwords must be at least 12 characters long.');
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/campus_recoverer',
});

try {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [STAFF_EMAIL]);
  if (existing.rowCount) {
    throw new Error('That email already has an account. Use an existing administrator to manage its role.');
  }

  const id = `usr_${crypto.randomBytes(12).toString('hex')}`;
  const passwordHash = await bcrypt.hash(STAFF_PASSWORD, 12);
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, STAFF_EMAIL, passwordHash, STAFF_NAME, STAFF_ROLE],
  );
  process.stdout.write(`Created ${STAFF_ROLE} account ${STAFF_EMAIL}.\n`);
} finally {
  await pool.end();
}
