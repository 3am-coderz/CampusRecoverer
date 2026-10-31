import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';
import { AuditService } from './services/audit-service.js';

describe('Member 5: Audit Logging Module Tests', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;
  let auditService: AuditService;
  let adminToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;
    auditService = new AuditService(db);

    // Register Admin
    const adminRes = await request(app).post('/auth/register').send({
      email: 'admin_audit@campus.edu',
      password: 'password123',
      name: 'Chief Admin',
      role: 'ADMIN',
    });
    adminToken = adminRes.body.token;
  });

  afterAll(async () => {
    await db.close();
  });

  it('records audit events with cryptographic hash chaining', async () => {
    await auditService.log({
      actor_id: 'usr_1',
      action: 'ITEM_REPORTED',
      item_id: 'item_101',
      metadata: {
        category: 'laptop',
        hidden_serial: 'CANARY_SERIAL_DO_NOT_STORE',
        otp: '123456',
        public_note: 'Verified custody checkin',
      },
    });

    await auditService.log({
      actor_id: 'sec_1',
      action: 'ITEM_VERIFIED',
      item_id: 'item_101',
      metadata: { risk_level: 'HIGH' },
    });

    const res = await db.query('SELECT * FROM audit_logs ORDER BY seq ASC');
    expect(res.rows.length).toBeGreaterThanOrEqual(2);

    const first = res.rows[0];
    const second = res.rows[1];

    expect(first.prev_hash).toBe('0'.repeat(64));
    expect(first.row_hash).toBeDefined();
    expect(first.row_hash.length).toBe(64);

    expect(second.prev_hash).toBe(first.row_hash);
    expect(second.row_hash).toBeDefined();
    expect(second.row_hash.length).toBe(64);
  });

  it('SECURITY INVARIANT: Metadata sanitizer strips sensitive keys before storing', async () => {
    const res = await db.query('SELECT metadata FROM audit_logs WHERE action = $1', ['ITEM_REPORTED']);
    expect(res.rows.length).toBeGreaterThan(0);

    const meta = typeof res.rows[0].metadata === 'string'
      ? JSON.parse(res.rows[0].metadata)
      : res.rows[0].metadata;

    expect(meta.public_note).toBe('Verified custody checkin');
    expect(meta.hidden_serial).toBeUndefined();
    expect(meta.otp).toBeUndefined();
    expect(JSON.stringify(meta)).not.toContain('CANARY_SERIAL_DO_NOT_STORE');
    expect(JSON.stringify(meta)).not.toContain('123456');
  });

  it('verifyChain confirms intact cryptographic chain', async () => {
    const check = await auditService.verifyChain();
    expect(check.verified).toBe(true);
    expect(check.tampered_seqs).toHaveLength(0);
    expect(check.total_entries).toBeGreaterThanOrEqual(2);
  });

  it('detects tampering when an entry row_hash is corrupted', async () => {
    // Tamper with second row
    await db.query(`UPDATE audit_logs SET row_hash = 'tampered_hash_value_1234567890abcdef' WHERE seq = 2`);

    const check = await auditService.verifyChain();
    expect(check.verified).toBe(false);
    expect(check.tampered_seqs).toContain(2);
  });

  it('admin can query audit logs and check chain integrity via REST endpoints', async () => {
    const logsRes = await request(app)
      .get('/audit')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(logsRes.status).toBe(200);
    expect(logsRes.body.logs).toBeDefined();
    expect(logsRes.body.total).toBeGreaterThan(0);

    const chainRes = await request(app)
      .get('/audit/verify-chain')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(chainRes.status).toBe(200);
    expect(chainRes.body.verified).toBeDefined();
  });
});
