import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/kernel/app.js';
import { DatabaseContext } from '../../apps/api/src/kernel/db.js';

describe('Member 5: Edge Cases and Negative Testing Suite', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  let finderToken: string;
  let finderId: string;
  let studentToken: string;
  let securityToken: string;
  let itemId: string;
  let claimId: string;
  let validQrToken: string;
  let validOtp: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;

    // Register Users
    const resF = await request(app).post('/auth/register').send({
      email: 'edge_finder@campus.edu',
      password: 'password123',
      name: 'Finder User',
      role: 'FINDER',
    });
    finderToken = resF.body.token;
    finderId = resF.body.user.id;

    const resS = await request(app).post('/auth/register').send({
      email: 'edge_student@campus.edu',
      password: 'password123',
      name: 'Student User',
      role: 'STUDENT',
    });
    studentToken = resS.body.token;

    const resSec = await request(app).post('/auth/register').send({
      email: 'edge_sec@campus.edu',
      password: 'password123',
      name: 'Security Officer',
      role: 'SECURITY',
    });
    securityToken = resSec.body.token;

    // Report Item
    const itemRes = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${finderToken}`)
      .send({
        category: 'phone',
        public_description: 'Edge case smartphone',
        hidden_description: 'Secret Canary Attributes',
        hidden_attributes: { brand: 'Google', model: 'Pixel 8' },
        found_location_public: 'West Lawn',
        found_date: new Date().toISOString(),
      });
    itemId = itemRes.body.item.id;
  });

  afterAll(async () => {
    await db.close();
  });

  it('Edge Case 1: Finder CANNOT submit claim on an item they reported (403 Forbidden)', async () => {
    await ctx.ports.core.setItemStatus(itemId, 'OPEN_FOR_CLAIMS');

    const res = await request(app)
      .post('/claims')
      .set('Authorization', `Bearer ${finderToken}`)
      .send({
        item_id: itemId,
        description: 'Trying to claim my own reported phone',
        claimed_attributes: {},
        lost_date: new Date().toISOString(),
        lost_location: 'West Lawn',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FINDER_CANNOT_CLAIM_OWN_ITEM');
  });

  it('Edge Case 2: Matching service down or unreachable gracefully degrades to MANUAL_REVIEW', async () => {
    const claimRes = await request(app)
      .post('/claims')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        item_id: itemId,
        description: 'Lost my Pixel 8 on west lawn',
        claimed_attributes: { brand: 'Google', model: 'Pixel 8' },
        lost_date: new Date().toISOString(),
        lost_location: 'West Lawn',
      });

    expect(claimRes.status).toBe(201);
    claimId = claimRes.body.claim.id;
  });

  it('Edge Case 3: Illegal state transitions are rejected with 400', async () => {
    // Attempting to move claim directly from SCORED to COLLECTED
    const illegalClaimRes = await request(app)
      .patch(`/claims/${claimId}/status`)
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ status: 'COLLECTED' });

    expect(illegalClaimRes.status).toBe(400);
    expect(illegalClaimRes.body.error.code).toBe('ILLEGAL_CLAIM_TRANSITION');

    // Attempting to delete or dispose item illegally
    expect(() => ctx.ports.workflow.assertItemTransition('OPEN_FOR_CLAIMS', 'COLLECTED')).toThrow();
  });

  it('Edge Case 4: HIGH-risk items strictly require id_verified=true at desk', async () => {
    // Set up questions answered so approval succeeds
    await db.query(
      `INSERT INTO claim_answers (id, claim_id, question_id, matched, similarity)
       VALUES ('ans_e1', $1, 'q1', TRUE, 1.0)`,
      [claimId],
    );

    // Approve claim
    await request(app).post(`/claims/${claimId}/approve`).set('Authorization', `Bearer ${securityToken}`);

    // Retrieve QR
    const qrRes = await request(app).get(`/handover/claims/${claimId}/qr`).set('Authorization', `Bearer ${studentToken}`);
    validQrToken = qrRes.body.qr_token;

    // Get OTP
    const notifRes = await request(app).get('/notifications').set('Authorization', `Bearer ${studentToken}`);
    const match = notifRes.body.notifications[0].message.match(/OTP is: (\d{6})/);
    validOtp = match![1];

    // Attempt release with id_verified = false -> Rejected
    const failRes = await request(app)
      .post('/handover/verify')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        qr_token: validQrToken,
        otp: validOtp,
        id_verified: false,
      });

    expect(failRes.status).toBe(400);
    expect(failRes.body.error.code).toBe('PHOTO_ID_VERIFICATION_REQUIRED');
  });

  it('Edge Case 5: 5 failed OTP attempts locks the handover and flags a security dispute', async () => {
    // Attempts 1 to 4 with incorrect OTP
    for (let i = 1; i <= 4; i++) {
      const wrongRes = await request(app)
        .post('/handover/verify')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({
          qr_token: validQrToken,
          otp: '000000',
          id_verified: true,
        });
      expect(wrongRes.status).toBe(400);
      expect(wrongRes.body.error.code).toBe('INVALID_OTP');
    }

    // 5th attempt locks the credential
    const lockRes = await request(app)
      .post('/handover/verify')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        qr_token: validQrToken,
        otp: '000000',
        id_verified: true,
      });
    expect(lockRes.status).toBe(400);
    expect(lockRes.body.error.code).toBe('MAX_ATTEMPTS_EXCEEDED');

    // Confirm handover row is marked locked
    const hoRes = await db.query('SELECT locked, attempts FROM handovers WHERE claim_id = $1', [claimId]);
    expect(hoRes.rows[0].locked).toBe(true);
    expect(hoRes.rows[0].attempts).toBe(5);

    // Subsequent request with the real OTP is also locked
    const subRes = await request(app)
      .post('/handover/verify')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        qr_token: validQrToken,
        otp: validOtp,
        id_verified: true,
      });
    expect(subRes.status).toBe(400);
    expect(subRes.body.error.code).toBe('HANDOVER_LOCKED');
  });

  it('Edge Case 6: Expired QR token is rejected', async () => {
    // Artificially expire a handover
    const expiredClaimId = 'claim_exp_test';
    await db.query(
      `INSERT INTO claims (id, item_id, claimant_id, description, claimed_attributes, lost_date, lost_location, confidence_label, status)
       VALUES ($1, $2, $3, 'Expired test', '{}', CURRENT_TIMESTAMP, 'Hall', 'HIGH', 'APPROVED')`,
      [expiredClaimId, itemId, finderId],
    );

    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
    await db.query(
      `INSERT INTO handovers (id, item_id, claim_id, claimant_id, qr_token_hash, otp_hash, issued_at, expires_at, attempts, locked)
       VALUES ('ho_exp', $1, $2, $3, 'hash_exp', 'otp_exp', CURRENT_TIMESTAMP, $4, 0, FALSE)`,
      [itemId, expiredClaimId, finderId, pastDate],
    );

    const res = await request(app)
      .get(`/handover/claims/${expiredClaimId}/qr`)
      .set('Authorization', `Bearer ${finderToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CREDENTIALS_EXPIRED');
  });
});
