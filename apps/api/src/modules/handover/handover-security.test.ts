import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';
import { HandoverService } from './services/handover-service.js';

describe('Member 4: Block 5 — Handover Security, CSPRNG, Lockout & Audit Tests', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  let adminToken: string;
  let securityToken: string;
  let securityId: string;
  let claimantToken: string;
  let claimantId: string;
  let otherStudentToken: string;
  let finderToken: string;
  let finderId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;

    // 1. Admin
    const adminRes = await request(app).post('/auth/register').send({
      email: 'admin_sec_b5@campus.edu',
      password: 'password123',
      name: 'Admin Angela',
      role: 'ADMIN',
    });
    adminToken = adminRes.body.token;

    // 2. Security officer
    const secRes = await request(app).post('/auth/register').send({
      email: 'sec_b5@campus.edu',
      password: 'password123',
      name: 'Officer Steve',
      role: 'SECURITY',
    });
    securityToken = secRes.body.token;
    securityId = secRes.body.user.id;

    // 3. Claimant student
    const claimantRes = await request(app).post('/auth/register').send({
      email: 'claimant_b5@campus.edu',
      password: 'password123',
      name: 'Student Sam',
      role: 'STUDENT',
    });
    claimantToken = claimantRes.body.token;
    claimantId = claimantRes.body.user.id;

    // 4. Other student
    const otherRes = await request(app).post('/auth/register').send({
      email: 'other_b5@campus.edu',
      password: 'password123',
      name: 'Student Zoe',
      role: 'STUDENT',
    });
    otherStudentToken = otherRes.body.token;

    // 5. Finder
    const finderRes = await request(app).post('/auth/register').send({
      email: 'finder_b5@campus.edu',
      password: 'password123',
      name: 'Finder Frank',
      role: 'FINDER',
    });
    finderToken = finderRes.body.token;
    finderId = finderRes.body.user.id;
  });

  afterAll(async () => {
    await db.close();
  });

  // Helper to create an approved claim and handover
  async function createScenario(options: { risk_level?: string; claimant?: string } = {}) {
    const risk = options.risk_level || 'LOW';
    const cid = options.claimant || claimantId;
    const itemId = 'item_b5_' + crypto.randomBytes(4).toString('hex');

    await db.query(
      `INSERT INTO items (
        id, category, public_description, hidden_description, hidden_attributes,
        found_location_public, found_date, status, risk_level, security_verified,
        finder_id, created_at
      ) VALUES ($1, 'electronics', 'Silver Laptop', 'Serial SN-99881', '{}', 'Library', CURRENT_TIMESTAMP, 'OPEN_FOR_CLAIMS', $2, TRUE, $3, CURRENT_TIMESTAMP)`,
      [itemId, risk, finderId],
    );

    const claimId = 'claim_b5_' + crypto.randomBytes(4).toString('hex');
    await db.query(
      `INSERT INTO claims (
        id, item_id, claimant_id, description, claimed_attributes,
        lost_date, lost_location, structured_score, semantic_score, final_score,
        confidence_label, status, created_at
      ) VALUES ($1, $2, $3, 'Lost laptop', '{}', CURRENT_TIMESTAMP, 'Library', 95, 95, 95, 'HIGH', 'SCORED', CURRENT_TIMESTAMP)`,
      [claimId, itemId, cid],
    );

    // Approve claim via security
    const approveRes = await request(app)
      .post(`/claims/${claimId}/approve`)
      .set('Authorization', `Bearer ${securityToken}`);
    expect(approveRes.status).toBe(200);

    // Get OTP from notification
    const notifRes = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${claimantToken}`);
    const notif = notifRes.body.notifications.find((n: any) =>
      n.title.includes('Claim Approved') && n.message.includes('OTP is:'),
    );
    expect(notif).toBeDefined();
    const matchOtp = notif.message.match(/OTP is: (\d{6})/);
    const otp = matchOtp![1];

    // Get QR token from handover API
    const qrRes = await request(app)
      .get(`/handover/claims/${claimId}/qr`)
      .set('Authorization', `Bearer ${claimantToken}`);
    expect(qrRes.status).toBe(200);
    const qrToken = qrRes.body.qr_token;

    return { itemId, claimId, qrToken, otp };
  }

  describe('1. CSPRNG Entropy & Cryptographic Credential Protection', () => {
    it('generates secure 6-digit OTPs using CSPRNG across multiple issuances', async () => {
      const otps: string[] = [];
      const service = new HandoverService(ctx);

      for (let i = 0; i < 5; i++) {
        const dummyClaimId = 'claim_csprng_' + i + '_' + crypto.randomBytes(4).toString('hex');
        const dummyItemId = 'item_csprng_' + i + '_' + crypto.randomBytes(4).toString('hex');

        await db.query(
          `INSERT INTO items (id, category, public_description, hidden_description, found_location_public, found_date, status, risk_level, finder_id)
           VALUES ($1, 'book', 'Notebook', 'Blue spiral notebook', 'Desk', CURRENT_TIMESTAMP, 'APPROVED_AWAITING_COLLECTION', 'LOW', $2)`,
          [dummyItemId, finderId],
        );
        await db.query(
          `INSERT INTO claims (id, item_id, claimant_id, description, lost_date, lost_location, confidence_label, status)
           VALUES ($1, $2, $3, 'Notebook claim', CURRENT_TIMESTAMP, 'Desk', 'HIGH', 'APPROVED')`,
          [dummyClaimId, dummyItemId, claimantId],
        );

        const result = await service.issue(dummyClaimId);
        expect(result.otp).toBeDefined();
        expect(result.otp).toMatch(/^\d{6}$/);
        const otpNum = parseInt(result.otp!, 10);
        expect(otpNum).toBeGreaterThanOrEqual(100000);
        expect(otpNum).toBeLessThan(1000000);
        otps.push(result.otp!);
      }

      // Verify that issued OTPs are not static or trivial
      const uniqueOtps = new Set(otps);
      expect(uniqueOtps.size).toBe(otps.length);
    });

    it('stores strictly HMAC-SHA256 hashes in the database and never stores raw tokens', async () => {
      const { claimId, qrToken, otp } = await createScenario();

      const dbRows = await db.query(
        'SELECT qr_token_hash, otp_hash FROM handovers WHERE claim_id = $1',
        [claimId],
      );
      expect(dbRows.rows.length).toBe(1);
      const row = dbRows.rows[0];

      // Must be 64-character hexadecimal SHA256 hashes
      expect(row.qr_token_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(row.otp_hash).toMatch(/^[a-f0-9]{64}$/);

      // Must not be the raw credentials
      expect(row.qr_token_hash).not.toBe(qrToken);
      expect(row.otp_hash).not.toBe(otp);
    });
  });

  describe('2. Authentication & Authorization Enforcement', () => {
    it('allows ADMIN to verify and release item handover', async () => {
      const { qrToken, otp, itemId, claimId } = await createScenario();

      const res = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ qr_token: qrToken, otp, id_verified: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const item = await ctx.ports.core.getItem(itemId);
      const claim = await ctx.ports.core.getClaim(claimId);
      expect(item.status).toBe('COLLECTED');
      expect(claim.status).toBe('COLLECTED');
    });

    it('allows SECURITY to verify and release item handover', async () => {
      const { qrToken, otp, itemId, claimId } = await createScenario();

      const res = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp, id_verified: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const item = await ctx.ports.core.getItem(itemId);
      expect(item.status).toBe('COLLECTED');
    });

    it('blocks STUDENT role from invoking verification (403 FORBIDDEN_ROLE)', async () => {
      const { qrToken, otp } = await createScenario();

      const res = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${claimantToken}`)
        .send({ qr_token: qrToken, otp, id_verified: true });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('blocks unauthenticated requests to verification (401 AUTH_REQUIRED)', async () => {
      const res = await request(app)
        .post('/handover/verify')
        .send({ qr_token: 'dummy', otp: '123456', id_verified: true });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('blocks unauthenticated requests to QR retrieval (401 AUTH_REQUIRED)', async () => {
      const { claimId } = await createScenario();

      const res = await request(app).get(`/handover/claims/${claimId}/qr`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('prevents non-owner student from retrieving claimant QR (400 UNAUTHORIZED_CLAIMANT)', async () => {
      const { claimId } = await createScenario();

      const res = await request(app)
        .get(`/handover/claims/${claimId}/qr`)
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNAUTHORIZED_CLAIMANT');
    });
  });

  describe('3. Input Validation, Tampering & Whitespace Trimming', () => {
    it('rejects malformed or empty QR token (400)', async () => {
      const res = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: '', otp: '123456', id_verified: true });

      expect(res.status).toBe(400);
    });

    it('rejects invalid OTP length < 4 or > 8 digits (400)', async () => {
      const resShort = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: 'dummy_token', otp: '12', id_verified: true });

      expect(resShort.status).toBe(400);

      const resLong = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: 'dummy_token', otp: '123456789', id_verified: true });

      expect(resLong.status).toBe(400);
    });

    it('rejects tampered QR token that has invalid HMAC hash (400 INVALID_QR_TOKEN)', async () => {
      const { otp } = await createScenario();

      const res = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: 'tampered_qr_signature_abcdef123456', otp, id_verified: true });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_QR_TOKEN');
    });

    it('trims whitespace around submitted QR token and OTP before processing', async () => {
      const { qrToken, otp, itemId } = await createScenario();

      const res = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          qr_token: `  ${qrToken}  `,
          otp: `  ${otp}  `,
          id_verified: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const item = await ctx.ports.core.getItem(itemId);
      expect(item.status).toBe('COLLECTED');
    });
  });

  describe('4. Atomic Lockout & Concurrency Protections', () => {
    it('atomically enforces 5-attempt limit under concurrent failed requests and locks record', async () => {
      const { claimId, qrToken, otp } = await createScenario();

      // Launch 5 concurrent failed requests with wrong OTP
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/handover/verify')
          .set('Authorization', `Bearer ${securityToken}`)
          .send({ qr_token: qrToken, otp: '000000', id_verified: true }),
      );

      const responses = await Promise.all(promises);

      // All 5 must have failed with 400
      for (const res of responses) {
        expect(res.status).toBe(400);
        expect(['INVALID_OTP', 'MAX_ATTEMPTS_EXCEEDED']).toContain(res.body.error.code);
      }

      // Exactly one request must have triggered MAX_ATTEMPTS_EXCEEDED
      const maxAttemptRes = responses.find((r) => r.body.error.code === 'MAX_ATTEMPTS_EXCEEDED');
      expect(maxAttemptRes).toBeDefined();

      // Database state must be locked with 5 attempts
      const dbRow = await db.query(
        'SELECT attempts, locked FROM handovers WHERE claim_id = $1',
        [claimId],
      );
      expect(dbRow.rows[0].attempts).toBe(5);
      expect(dbRow.rows[0].locked).toBe(true);

      // Attempt 6 with the CORRECT OTP must be rejected because it is locked
      const postLockRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp, id_verified: true });

      expect(postLockRes.status).toBe(400);
      expect(postLockRes.body.error.code).toBe('HANDOVER_LOCKED');

      // Audit log must contain DISPUTE_FLAGGED
      const auditRes = await db.query(
        `SELECT * FROM audit_logs WHERE claim_id = $1 AND action = 'DISPUTE_FLAGGED'`,
        [claimId],
      );
      expect(auditRes.rows.length).toBe(1);
    });

    it('prevents replay of already collected item (400 ALREADY_COLLECTED)', async () => {
      const { qrToken, otp } = await createScenario();

      // Collect once
      const firstRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp, id_verified: true });
      expect(firstRes.status).toBe(200);

      // Collect second time
      const secondRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp, id_verified: true });

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.error.code).toBe('ALREADY_COLLECTED');
    });

    it('prevents duplicate issuance for already collected claim', async () => {
      const { claimId, qrToken, otp } = await createScenario();

      // Complete handover
      const verifyRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp, id_verified: true });
      expect(verifyRes.status).toBe(200);

      // Attempt direct re-issuance on already collected claim
      const service = new HandoverService(ctx);
      await expect(service.issue(claimId)).rejects.toThrowError(
        'Item has already been collected for this claim',
      );
    });
  });

  describe('5. HIGH-Risk Verification & Rollback Guarantees', () => {
    it('enforces physical photo ID verification for HIGH-risk items and permits LOW-risk without it', async () => {
      // 1. High risk without id_verified -> fails
      const highScenario = await createScenario({ risk_level: 'HIGH' });
      const failHighRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: highScenario.qrToken, otp: highScenario.otp, id_verified: false });

      expect(failHighRes.status).toBe(400);
      expect(failHighRes.body.error.code).toBe('PHOTO_ID_VERIFICATION_REQUIRED');

      // 2. High risk with id_verified -> succeeds
      const succHighRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: highScenario.qrToken, otp: highScenario.otp, id_verified: true });

      expect(succHighRes.status).toBe(200);

      // 3. Low risk with id_verified: false -> succeeds
      const lowScenario = await createScenario({ risk_level: 'LOW' });
      const succLowRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: lowScenario.qrToken, otp: lowScenario.otp, id_verified: false });

      expect(succLowRes.status).toBe(200);
    });

    it('rolls back handover collected_at if markCollected throws a failure', async () => {
      const { claimId, qrToken, otp } = await createScenario();

      // Mock markCollected to throw
      const originalMarkCollected = ctx.ports.core.markCollected;
      ctx.ports.core.markCollected = async () => {
        throw new Error('Database connection failure during status transition');
      };

      try {
        const res = await request(app)
          .post('/handover/verify')
          .set('Authorization', `Bearer ${securityToken}`)
          .send({ qr_token: qrToken, otp, id_verified: true });

        // Must fail
        expect(res.status).toBe(500);

        // Handover record must have been rolled back to collected_at = NULL
        const dbRow = await db.query(
          'SELECT collected_at, security_id FROM handovers WHERE claim_id = $1',
          [claimId],
        );
        expect(dbRow.rows[0].collected_at).toBeNull();
        expect(dbRow.rows[0].security_id).toBeNull();
      } finally {
        ctx.ports.core.markCollected = originalMarkCollected;
      }
    });
  });

  describe('6. Audit Logging & Sensitive Data Redaction', () => {
    it('records QR_VERIFIED and ITEM_COLLECTED audit events without leaking raw credentials', async () => {
      const { claimId, qrToken, otp } = await createScenario();

      const verifyRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp, id_verified: true });
      expect(verifyRes.status).toBe(200);

      // Query audit logs for this claim
      const logs = await db.query(
        'SELECT action, metadata FROM audit_logs WHERE claim_id = $1 ORDER BY created_at ASC',
        [claimId],
      );

      const actions = logs.rows.map((r: any) => r.action);
      expect(actions).toContain('QR_GENERATED');
      expect(actions).toContain('CLAIM_APPROVED');
      expect(actions).toContain('QR_VERIFIED');
      expect(actions).toContain('ITEM_COLLECTED');

      // Check all metadata objects for secret leakage
      for (const row of logs.rows) {
        const metaStr = JSON.stringify(row.metadata || {});
        expect(metaStr).not.toContain(qrToken);
        expect(metaStr).not.toContain(otp);
        expect(metaStr).not.toContain(ctx.config.handoverSecret);
      }
    });
  });
});
