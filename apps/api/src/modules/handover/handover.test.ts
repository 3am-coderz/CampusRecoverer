import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';

describe('Member 2: Handover Module Tests', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  let studentToken: string;
  let studentId: string;
  let securityToken: string;
  let itemId: string;
  let claimId: string;
  let issuedQrToken: string;
  let issuedOtp: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;

    // Register Student
    const stuRes = await request(app).post('/auth/register').send({
      email: 'student_ho@campus.edu',
      password: 'password123',
      name: 'Claimant Alice',
      role: 'STUDENT',
    });
    studentToken = stuRes.body.token;
    studentId = stuRes.body.user.id;

    // Register Security
    const secRes = await request(app).post('/auth/register').send({
      email: 'sec_ho@campus.edu',
      password: 'password123',
      name: 'Officer Bob',
      role: 'SECURITY',
    });
    securityToken = secRes.body.token;

    // Create item & claim
    itemId = 'item_ho_test';
    await db.query(
      `INSERT INTO items (
        id, category, public_description, hidden_description, hidden_attributes,
        found_location_public, found_date, status, risk_level, security_verified,
        finder_id, created_at
      ) VALUES ($1, 'wallet', 'Brown leather wallet', 'Fossil wallet with license', '{}', 'Cafeteria', CURRENT_TIMESTAMP, 'OPEN_FOR_CLAIMS', 'HIGH', TRUE, $2, CURRENT_TIMESTAMP)`,
      [itemId, studentId],
    );

    claimId = 'claim_ho_test';
    await db.query(
      `INSERT INTO claims (
        id, item_id, claimant_id, description, claimed_attributes,
        lost_date, lost_location, structured_score, semantic_score, final_score,
        confidence_label, status, created_at
      ) VALUES ($1, $2, $3, 'My wallet', '{}', CURRENT_TIMESTAMP, 'Cafeteria', 90, 90, 90, 'HIGH', 'SCORED', CURRENT_TIMESTAMP)`,
      [claimId, itemId, studentId],
    );

    // Answer ownership verification questions required for HIGH-risk item claim approval
    const qRes = await request(app)
      .get(`/workflow/claims/${claimId}/questions`)
      .set('Authorization', `Bearer ${studentToken}`);

    await request(app)
      .post(`/workflow/claims/${claimId}/answers`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { question_id: qRes.body.questions[0].id, answer: 'Fossil wallet with license' },
        ],
      });
  });

  afterAll(async () => {
    await db.close();
  });

  it('approving a claim issues a handover record with ONLY hashed credentials in DB', async () => {
    const approveRes = await request(app)
      .post(`/claims/${claimId}/approve`)
      .set('Authorization', `Bearer ${securityToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.handover_id).toBeDefined();

    // Inspect database row directly: verify QR and OTP are ONLY stored as HMAC-SHA256 hashes!
    const dbRows = await db.query('SELECT * FROM handovers WHERE claim_id = $1', [claimId]);
    expect(dbRows.rows.length).toBe(1);
    const ho = dbRows.rows[0];

    expect(ho.qr_token_hash).toBeDefined();
    expect(ho.otp_hash).toBeDefined();
    expect(ho.qr_token_hash.length).toBe(64); // 64 hex characters = SHA256
    expect(ho.otp_hash.length).toBe(64);

    // Retrieve notification sent to claimant to get the OTP
    const notifRes = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(notifRes.status).toBe(200);
    const notif = notifRes.body.notifications.find((n: any) => n.title.includes('Claim Approved'));
    expect(notif).toBeDefined();
    const matchOtp = notif.message.match(/OTP is: (\d{6})/);
    expect(matchOtp).not.toBeNull();
    issuedOtp = matchOtp![1];
  });

  it('claimant can retrieve their QR code and token', async () => {
    const qrRes = await request(app)
      .get(`/handover/claims/${claimId}/qr`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(qrRes.status).toBe(200);
    expect(qrRes.body.qr_token).toBeDefined();
    expect(qrRes.body.qr_png_base64).toContain('data:image/png;base64');
    issuedQrToken = qrRes.body.qr_token;
  });

  it('fails verification if wrong OTP is provided and increments attempt count', async () => {
    const failRes = await request(app)
      .post('/handover/verify')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        qr_token: issuedQrToken,
        otp: '999999', // wrong OTP
        id_verified: true,
      });

    expect(failRes.status).toBe(400);
    expect(failRes.body.error.code).toBe('INVALID_OTP');

    // Check attempts in DB
    const dbRows = await db.query('SELECT attempts, locked FROM handovers WHERE claim_id = $1', [claimId]);
    expect(dbRows.rows[0].attempts).toBe(1);
    expect(dbRows.rows[0].locked).toBe(false);
  });

  it('HIGH risk item releases only when id_verified is true', async () => {
    // Missing id_verified -> fails
    const failRes = await request(app)
      .post('/handover/verify')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        qr_token: issuedQrToken,
        otp: issuedOtp,
        id_verified: false,
      });

    expect(failRes.status).toBe(400);
    expect(failRes.body.error.code).toBe('PHOTO_ID_VERIFICATION_REQUIRED');

    // With id_verified -> releases successfully
    const successRes = await request(app)
      .post('/handover/verify')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        qr_token: issuedQrToken,
        otp: issuedOtp,
        id_verified: true,
      });

    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);

    // Verify item and claim are marked COLLECTED
    const item = await ctx.ports.core.getItem(itemId);
    const claim = await ctx.ports.core.getClaim(claimId);
    expect(item.status).toBe('COLLECTED');
    expect(claim.status).toBe('COLLECTED');
  });

  it('re-verifying already collected item fails (single use)', async () => {
    const replayRes = await request(app)
      .post('/handover/verify')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        qr_token: issuedQrToken,
        otp: issuedOtp,
        id_verified: true,
      });

    expect(replayRes.status).toBe(400);
    expect(replayRes.body.error.code).toBe('ALREADY_COLLECTED');
  });
});
