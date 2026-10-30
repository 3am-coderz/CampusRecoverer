import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';

describe('Member 4: Handover Edge Cases & Concurrency Tests', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

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

    // 1. Security officer
    const secRes = await request(app).post('/auth/register').send({
      email: 'sec_edge@campus.edu',
      password: 'password123',
      name: 'Officer Davis',
      role: 'SECURITY',
    });
    securityToken = secRes.body.token;
    securityId = secRes.body.user.id;

    // 2. Claimant student
    const claimantRes = await request(app).post('/auth/register').send({
      email: 'claimant_edge@campus.edu',
      password: 'password123',
      name: 'Claimant Carol',
      role: 'STUDENT',
    });
    claimantToken = claimantRes.body.token;
    claimantId = claimantRes.body.user.id;

    // 3. Other student
    const otherRes = await request(app).post('/auth/register').send({
      email: 'other_edge@campus.edu',
      password: 'password123',
      name: 'Bystander Dan',
      role: 'STUDENT',
    });
    otherStudentToken = otherRes.body.token;

    // 4. Finder
    const finderRes = await request(app).post('/auth/register').send({
      email: 'finder_edge@campus.edu',
      password: 'password123',
      name: 'Finder Eve',
      role: 'FINDER',
    });
    finderToken = finderRes.body.token;
    finderId = finderRes.body.user.id;
  });

  afterAll(async () => {
    await db.close();
  });

  // Helper to setup an approved claim with issued handover
  async function createApprovedHandoverScenario(options: { risk_level?: string } = {}) {
    const risk = options.risk_level || 'LOW';
    const itemId = 'item_ho_' + Math.random().toString(36).substring(2, 10);
    await db.query(
      `INSERT INTO items (
        id, category, public_description, hidden_description, hidden_attributes,
        found_location_public, found_date, status, risk_level, security_verified,
        finder_id, created_at
      ) VALUES ($1, 'jacket', 'Winter jacket', 'Keys in left pocket', '{}', 'Gym', CURRENT_TIMESTAMP, 'OPEN_FOR_CLAIMS', $2, TRUE, $3, CURRENT_TIMESTAMP)`,
      [itemId, risk, finderId],
    );

    const claimId = 'claim_ho_' + Math.random().toString(36).substring(2, 10);
    await db.query(
      `INSERT INTO claims (
        id, item_id, claimant_id, description, claimed_attributes,
        lost_date, lost_location, structured_score, semantic_score, final_score,
        confidence_label, status, created_at
      ) VALUES ($1, $2, $3, 'My jacket', '{}', CURRENT_TIMESTAMP, 'Gym', 90, 90, 90, 'HIGH', 'SCORED', CURRENT_TIMESTAMP)`,
      [claimId, itemId, claimantId],
    );

    // Approve claim to issue handover
    const approveRes = await request(app)
      .post(`/claims/${claimId}/approve`)
      .set('Authorization', `Bearer ${securityToken}`);
    expect(approveRes.status).toBe(200);

    // Retrieve notification to obtain issued OTP
    const notifRes = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${claimantToken}`);
    const notif = notifRes.body.notifications.find((n: any) => n.title.includes('Claim Approved'));
    const matchOtp = notif.message.match(/OTP is: (\d{6})/);
    const otp = matchOtp![1];

    // Retrieve QR token
    const qrRes = await request(app)
      .get(`/handover/claims/${claimId}/qr`)
      .set('Authorization', `Bearer ${claimantToken}`);
    const qrToken = qrRes.body.qr_token;

    return { itemId, claimId, qrToken, otp };
  }

  describe('1. Handover Authorization & QR Retrieval Controls', () => {
    it('rejects unauthenticated handover verify request (401 AUTH_REQUIRED)', async () => {
      const res = await request(app)
        .post('/handover/verify')
        .send({ qr_token: 'fake', otp: '123456', id_verified: true });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('rejects STUDENT role from invoking handover verify (403 FORBIDDEN_ROLE)', async () => {
      const res = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${claimantToken}`)
        .send({ qr_token: 'fake', otp: '123456', id_verified: true });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects FINDER role from invoking handover verify (403 FORBIDDEN_ROLE)', async () => {
      const res = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${finderToken}`)
        .send({ qr_token: 'fake', otp: '123456', id_verified: true });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects QR retrieval by another student who is not the approved claimant (400 UNAUTHORIZED_CLAIMANT)', async () => {
      const { claimId } = await createApprovedHandoverScenario();

      const res = await request(app)
        .get(`/handover/claims/${claimId}/qr`)
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNAUTHORIZED_CLAIMANT');
    });

    it('rejects QR retrieval when claim is NOT approved (400 CLAIM_NOT_APPROVED)', async () => {
      const itemId = 'item_unapproved_' + Math.random().toString(36).substring(2, 8);
      await db.query(
        `INSERT INTO items (id, category, public_description, hidden_description, found_location_public, found_date, status, risk_level, finder_id)
         VALUES ($1, 'keys', 'Set of keys', 'Car key', 'Lot A', CURRENT_TIMESTAMP, 'OPEN_FOR_CLAIMS', 'LOW', $2)`,
        [itemId, finderId],
      );

      const unapprovedClaimId = 'claim_unapproved_' + Math.random().toString(36).substring(2, 8);
      await db.query(
        `INSERT INTO claims (id, item_id, claimant_id, description, lost_date, lost_location, status, confidence_label)
         VALUES ($1, $2, $3, 'Keys', CURRENT_TIMESTAMP, 'Lot A', 'SCORED', 'MEDIUM')`,
        [unapprovedClaimId, itemId, claimantId],
      );

      const res = await request(app)
        .get(`/handover/claims/${unapprovedClaimId}/qr`)
        .set('Authorization', `Bearer ${claimantToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CLAIM_NOT_APPROVED');
    });
  });

  describe('2. Credential Validation & Lockout Invariants', () => {
    it('rejects verification with completely invalid QR token (400 INVALID_QR_TOKEN)', async () => {
      const res = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          qr_token: 'invalid_unrecognized_qr_token_hex_string_xyz',
          otp: '123456',
          id_verified: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_QR_TOKEN');
    });

    it('enforces lockout after 5 consecutive failed OTP attempts and blocks subsequent use', async () => {
      const { claimId, qrToken, otp } = await createApprovedHandoverScenario();

      // Attempts 1 to 4: increments count and reports attempts
      for (let attempt = 1; attempt <= 4; attempt++) {
        const failRes = await request(app)
          .post('/handover/verify')
          .set('Authorization', `Bearer ${securityToken}`)
          .send({ qr_token: qrToken, otp: '000000', id_verified: true });

        expect(failRes.status).toBe(400);
        expect(failRes.body.error.code).toBe('INVALID_OTP');
        expect(failRes.body.error.message).toContain(`Attempt ${attempt} of 5`);
      }

      // 5th failed attempt: triggers MAX_ATTEMPTS_EXCEEDED and locks handover
      const lockRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp: '000000', id_verified: true });

      expect(lockRes.status).toBe(400);
      expect(lockRes.body.error.code).toBe('MAX_ATTEMPTS_EXCEEDED');

      // Verify in DB that handover is locked
      const dbRow = await db.query('SELECT attempts, locked FROM handovers WHERE claim_id = $1', [claimId]);
      expect(dbRow.rows[0].attempts).toBe(5);
      expect(dbRow.rows[0].locked).toBe(true);

      // 6th attempt with the CORRECT OTP must be rejected because it is locked
      const lockedRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp: otp, id_verified: true });

      expect(lockedRes.status).toBe(400);
      expect(lockedRes.body.error.code).toBe('HANDOVER_LOCKED');

      // Claimant attempting to retrieve QR on locked handover also gets HANDOVER_LOCKED
      const claimantQrRes = await request(app)
        .get(`/handover/claims/${claimId}/qr`)
        .set('Authorization', `Bearer ${claimantToken}`);

      expect(claimantQrRes.status).toBe(400);
      expect(claimantQrRes.body.error.code).toBe('HANDOVER_LOCKED');
    });

    it('rejects expired handover credentials (400 CREDENTIALS_EXPIRED)', async () => {
      const { claimId, qrToken, otp } = await createApprovedHandoverScenario();

      // Manually set expires_at in the past
      const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
      await db.query('UPDATE handovers SET expires_at = $1 WHERE claim_id = $2', [pastDate, claimId]);

      // Claimant fetching QR gets CREDENTIALS_EXPIRED
      const qrRes = await request(app)
        .get(`/handover/claims/${claimId}/qr`)
        .set('Authorization', `Bearer ${claimantToken}`);
      expect(qrRes.status).toBe(400);
      expect(qrRes.body.error.code).toBe('CREDENTIALS_EXPIRED');

      // Security officer verifying gets CREDENTIALS_EXPIRED
      const verifyRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp: otp, id_verified: true });
      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.error.code).toBe('CREDENTIALS_EXPIRED');
    });
  });

  describe('3. Resource State Mismatch & Concurrency Protection', () => {
    it('rejects handover verify if claim status is not APPROVED (400 INVALID_CLAIM_STATE)', async () => {
      const { claimId, qrToken, otp } = await createApprovedHandoverScenario();

      // Manually modify claim status to WITHDRAWN
      await db.query(`UPDATE claims SET status = 'WITHDRAWN' WHERE id = $1`, [claimId]);

      const res = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp: otp, id_verified: true });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CLAIM_STATE');
    });

    it('rejects handover verify if item status is not APPROVED_AWAITING_COLLECTION (400 INVALID_ITEM_STATE)', async () => {
      const { itemId, qrToken, otp } = await createApprovedHandoverScenario();

      // Manually modify item status to EXPIRED
      await db.query(`UPDATE items SET status = 'EXPIRED' WHERE id = $1`, [itemId]);

      const res = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ qr_token: qrToken, otp: otp, id_verified: true });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ITEM_STATE');
    });

    it('safely handles concurrent handover verification: exactly one succeeds and second is rejected (400 ALREADY_COLLECTED)', async () => {
      const { qrToken, otp, itemId, claimId } = await createApprovedHandoverScenario();

      // Fire 2 concurrent verification calls simultaneously
      const [res1, res2] = await Promise.all([
        request(app).post('/handover/verify').set('Authorization', `Bearer ${securityToken}`).send({
          qr_token: qrToken,
          otp: otp,
          id_verified: true,
        }),
        request(app).post('/handover/verify').set('Authorization', `Bearer ${securityToken}`).send({
          qr_token: qrToken,
          otp: otp,
          id_verified: true,
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 400]);

      const errorRes = res1.status === 400 ? res1 : res2;
      expect(errorRes.body.error.code).toBe('ALREADY_COLLECTED');

      // Verify item and claim are marked COLLECTED exactly once
      const item = await ctx.ports.core.getItem(itemId);
      const claim = await ctx.ports.core.getClaim(claimId);
      expect(item.status).toBe('COLLECTED');
      expect(claim.status).toBe('COLLECTED');
    });
  });
});
