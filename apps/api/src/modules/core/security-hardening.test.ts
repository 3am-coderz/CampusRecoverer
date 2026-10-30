import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';
import { RiskStub } from '../../kernel/stubs/risk-stub.js';
import { sanitizeAuditMetadata } from '../audit/services/audit-service.js';

describe('Member 4: Block 6 — Comprehensive Security Hardening Tests', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  let adminToken: string;
  let securityToken: string;
  let studentToken: string;
  let studentId: string;
  let finderToken: string;
  let finderId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;

    // Register ADMIN
    const adminRes = await request(app).post('/auth/register').send({
      email: 'admin_b6@campus.edu',
      password: 'password123',
      name: 'Admin Barbara',
      role: 'ADMIN',
    });
    adminToken = adminRes.body.token;

    // Register SECURITY
    const secRes = await request(app).post('/auth/register').send({
      email: 'sec_b6@campus.edu',
      password: 'password123',
      name: 'Officer Jack',
      role: 'SECURITY',
    });
    securityToken = secRes.body.token;

    // Register STUDENT
    const stuRes = await request(app).post('/auth/register').send({
      email: 'stu_b6@campus.edu',
      password: 'password123',
      name: 'Student Tim',
      role: 'STUDENT',
    });
    studentToken = stuRes.body.token;
    studentId = stuRes.body.user.id;

    // Register FINDER
    const finRes = await request(app).post('/auth/register').send({
      email: 'fin_b6@campus.edu',
      password: 'password123',
      name: 'Finder Pam',
      role: 'FINDER',
    });
    finderToken = finRes.body.token;
    finderId = finRes.body.user.id;
  });

  afterAll(async () => {
    await db.close();
  });

  describe('1. Risk Classification & Category Substring Isolation (Section B)', () => {
    const riskClassifier = new RiskStub();

    it('correctly classifies "headphones" as MEDIUM and NOT HIGH (prevents substring match with "phone")', () => {
      // Must not match 'phone'
      expect(riskClassifier.classify('headphones')).toBe('MEDIUM');
      expect(riskClassifier.classify('headphone')).toBe('MEDIUM');
      expect(riskClassifier.classify('wireless headphones')).toBe('MEDIUM');
      expect(riskClassifier.classify('earphones')).toBe('MEDIUM');
      expect(riskClassifier.classify('airpods')).toBe('MEDIUM');
    });

    it('correctly classifies high-risk devices as HIGH', () => {
      expect(riskClassifier.classify('phone')).toBe('HIGH');
      expect(riskClassifier.classify('mobile phone')).toBe('HIGH');
      expect(riskClassifier.classify('smartphone')).toBe('HIGH');
      expect(riskClassifier.classify('laptop')).toBe('HIGH');
      expect(riskClassifier.classify('wallet')).toBe('HIGH');
      expect(riskClassifier.classify('passport')).toBe('HIGH');
      expect(riskClassifier.classify('student id card')).toBe('HIGH');
    });

    it('correctly handles singular/plural for other medium categories', () => {
      expect(riskClassifier.classify('watch')).toBe('MEDIUM');
      expect(riskClassifier.classify('watches')).toBe('MEDIUM');
      expect(riskClassifier.classify('calculator')).toBe('MEDIUM');
      expect(riskClassifier.classify('calculators')).toBe('MEDIUM');
      expect(riskClassifier.classify('backpack')).toBe('MEDIUM');
      expect(riskClassifier.classify('bag')).toBe('MEDIUM');
      expect(riskClassifier.classify('bags')).toBe('MEDIUM');
    });

    it('correctly classifies low-risk items as LOW', () => {
      expect(riskClassifier.classify('umbrella')).toBe('LOW');
      expect(riskClassifier.classify('textbook')).toBe('LOW');
      expect(riskClassifier.classify('water bottle')).toBe('LOW');
      expect(riskClassifier.classify('jacket')).toBe('LOW');
    });

    it('does not falsely classify item as HIGH when hidden_attributes contain "headphones"', () => {
      expect(
        riskClassifier.classify('electronics', {
          brand: 'Sony',
          accessory_type: 'headphones',
        }),
      ).toBe('MEDIUM');
    });

    it('classifies item as HIGH when hidden_attributes contain genuine high-risk device', () => {
      expect(
        riskClassifier.classify('electronics', {
          brand: 'Apple',
          type: 'phone',
        }),
      ).toBe('HIGH');
    });
  });

  describe('2. Handover Transaction Atomicity & Rollback Integrity (Section C)', () => {
    async function createApprovedHandover() {
      const itemId = 'item_tx_' + crypto.randomBytes(4).toString('hex');
      await db.query(
        `INSERT INTO items (
          id, category, public_description, hidden_description, hidden_attributes,
          found_location_public, found_date, status, risk_level, security_verified,
          finder_id, created_at
        ) VALUES ($1, 'electronics', 'Audio Headset', 'Serial #HD992', '{}', 'Gym', CURRENT_TIMESTAMP, 'OPEN_FOR_CLAIMS', 'MEDIUM', TRUE, $2, CURRENT_TIMESTAMP)`,
        [itemId, finderId],
      );

      const claimId = 'claim_tx_' + crypto.randomBytes(4).toString('hex');
      await db.query(
        `INSERT INTO claims (
          id, item_id, claimant_id, description, claimed_attributes,
          lost_date, lost_location, structured_score, semantic_score, final_score,
          confidence_label, status, created_at
        ) VALUES ($1, $2, $3, 'Lost headset', '{}', CURRENT_TIMESTAMP, 'Gym', 90, 90, 90, 'HIGH', 'SCORED', CURRENT_TIMESTAMP)`,
        [claimId, itemId, studentId],
      );

      // Approve claim
      const appRes = await request(app)
        .post(`/claims/${claimId}/approve`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(appRes.status).toBe(200);

      // Retrieve credentials
      const notifRes = await request(app)
        .get('/notifications')
        .set('Authorization', `Bearer ${studentToken}`);
      const notif = notifRes.body.notifications.find((n: any) =>
        n.title.includes('Claim Approved') && n.message.includes('OTP is:'),
      );
      const matchOtp = notif.message.match(/OTP is: (\d{6})/);
      const otp = matchOtp![1];

      const qrRes = await request(app)
        .get(`/handover/claims/${claimId}/qr`)
        .set('Authorization', `Bearer ${studentToken}`);
      const qrToken = qrRes.body.qr_token;

      return { itemId, claimId, qrToken, otp };
    }

    it('atomically rolls back handover, claim, and item if downstream transition fails inside transaction', async () => {
      const { claimId, itemId, qrToken, otp } = await createApprovedHandover();

      // Mock markCollected to fail
      const originalMarkCollected = ctx.ports.core.markCollected;
      ctx.ports.core.markCollected = async () => {
        throw new Error('Simulated database deadlock during status transition');
      };

      try {
        const res = await request(app)
          .post('/handover/verify')
          .set('Authorization', `Bearer ${securityToken}`)
          .send({ qr_token: qrToken, otp, id_verified: true });

        expect(res.status).toBe(500);

        // Verify shared transaction atomicity:
        // 1. Handover MUST NOT be marked collected
        const hoRow = await db.query('SELECT collected_at FROM handovers WHERE claim_id = $1', [claimId]);
        expect(hoRow.rows[0].collected_at).toBeNull();

        // 2. Claim MUST NOT be marked collected (remains APPROVED)
        const claimRow = await db.query('SELECT status FROM claims WHERE id = $1', [claimId]);
        expect(claimRow.rows[0].status).toBe('APPROVED');

        // 3. Item MUST NOT be marked collected (remains APPROVED_AWAITING_COLLECTION)
        const itemRow = await db.query('SELECT status FROM items WHERE id = $1', [itemId]);
        expect(itemRow.rows[0].status).toBe('APPROVED_AWAITING_COLLECTION');

        // 4. Audit events MUST NOT have recorded ITEM_COLLECTED or QR_VERIFIED for this failed attempt
        const auditRows = await db.query(
          `SELECT action FROM audit_logs WHERE claim_id = $1 AND action IN ('QR_VERIFIED', 'ITEM_COLLECTED')`,
          [claimId],
        );
        expect(auditRows.rows.length).toBe(0);
      } finally {
        ctx.ports.core.markCollected = originalMarkCollected;
      }

      // Verify that after resolving the transient failure, verification succeeds completely
      const successRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp, id_verified: true });

      expect(successRes.status).toBe(200);

      const hoFinal = await db.query('SELECT collected_at FROM handovers WHERE claim_id = $1', [claimId]);
      expect(hoFinal.rows[0].collected_at).not.toBeNull();

      const claimFinal = await db.query('SELECT status FROM claims WHERE id = $1', [claimId]);
      expect(claimFinal.rows[0].status).toBe('COLLECTED');

      const itemFinal = await db.query('SELECT status FROM items WHERE id = $1', [itemId]);
      expect(itemFinal.rows[0].status).toBe('COLLECTED');
    });
  });

  describe('3. Audit Metadata Sanitization & Recursive Array Handling (Section D)', () => {
    it('preserves arrays of primitive strings and does not convert them to empty objects', () => {
      const input = {
        tags: ['urgent', 'cafeteria', 'high-value'],
        counts: [1, 2, 3],
      };
      const cleaned = sanitizeAuditMetadata(input);
      expect(cleaned.tags).toEqual(['urgent', 'cafeteria', 'high-value']);
      expect(cleaned.counts).toEqual([1, 2, 3]);
    });

    it('redacts sensitive fields in arrays of objects recursively', () => {
      const input = {
        users: [
          { name: 'Alice', password: 'plain_password', role: 'STUDENT' },
          { name: 'Bob', secret_token: 'xyz123', role: 'SECURITY' },
        ],
      };
      const cleaned = sanitizeAuditMetadata(input);
      expect(cleaned.users[0].password).toBe('[REDACTED]');
      expect(cleaned.users[0].name).toBe('Alice');
      expect(cleaned.users[1].secret_token).toBe('[REDACTED]');
      expect(cleaned.users[1].name).toBe('Bob');
    });

    it('redacts array under sensitive key entirely', () => {
      const input = {
        auth_tokens: ['jwt1', 'jwt2'],
        otp_codes: ['112233', '445566'],
      };
      const cleaned = sanitizeAuditMetadata(input);
      expect(cleaned.auth_tokens).toBe('[REDACTED]');
      expect(cleaned.otp_codes).toBe('[REDACTED]');
    });

    it('completely strips hidden_description and hidden_attributes in nested structures', () => {
      const input = {
        item_details: {
          category: 'phone',
          hidden_description: 'PIN is 1234',
          hidden_attributes: { imei: '99887766' },
        },
      };
      const cleaned = sanitizeAuditMetadata(input);
      expect(cleaned.item_details.category).toBe('phone');
      expect(cleaned.item_details.hidden_description).toBeUndefined();
      expect(cleaned.item_details.hidden_attributes).toBeUndefined();
    });
  });

  describe('4. Privacy, Information Disclosure & Error Sanitization (Sections A, E, F)', () => {
    it('ensures /items public list never leaks hidden_description or hidden_attributes', async () => {
      const res = await request(app).get('/items');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      for (const item of res.body.items) {
        expect(item.hidden_description).toBeUndefined();
        expect(item.hidden_attributes).toBeUndefined();
      }
    });

    it('ensures /admin/users never leaks password_hash', async () => {
      const res = await request(app)
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const user of res.body.users) {
        expect(user.password_hash).toBeUndefined();
        expect(user.password).toBeUndefined();
      }
    });

    it('ensures 500 error responses do not leak internal stack traces to clients', async () => {
      // Trigger a 500 by passing a malformed ID that causes DB error or unexpected exception
      const originalGetItem = ctx.ports.core.getItem;
      ctx.ports.core.getItem = async () => {
        throw new Error('CRITICAL_INTERNAL_DB_DISCONNECTION_AT_PORT_5432_SECRET_CREDENTIALS');
      };

      try {
        const res = await request(app).get('/items/item_test_err');
        expect(res.status).toBe(500);
        expect(res.body.error.message).toBe('Internal Server Error');
        expect(JSON.stringify(res.body)).not.toContain('CRITICAL_INTERNAL_DB_DISCONNECTION');
        expect(JSON.stringify(res.body)).not.toContain('stack');
      } finally {
        ctx.ports.core.getItem = originalGetItem;
      }
    });
  });
});
