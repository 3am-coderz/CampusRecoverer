import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/kernel/app.js';
import { DatabaseContext } from '../../apps/api/src/kernel/db.js';

describe('Member 5: Security Invariants Verification Suite', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  const CANARY_HIDDEN_DESC = 'CANARY_SECRET_ENGRAVING_773344';
  const CANARY_SERIAL_NUM = 'CANARY_SERIAL_XYZ_9999';
  const CANARY_SECRET_NOTE = 'CANARY_NOTE_CONFIDENTIAL_VAL';

  let studentToken: string;
  let studentId: string;
  let finderToken: string;
  let securityToken: string;
  let canaryItemId: string;
  let canaryClaimId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;

    // Register Users
    const resS = await request(app).post('/auth/register').send({
      email: 'canary_student@campus.edu',
      password: 'password123',
      name: 'Canary Student',
      role: 'STUDENT',
    });
    studentToken = resS.body.token;
    studentId = resS.body.user.id;

    const resF = await request(app).post('/auth/register').send({
      email: 'canary_finder@campus.edu',
      password: 'password123',
      name: 'Canary Finder',
      role: 'FINDER',
    });
    finderToken = resF.body.token;

    const resSec = await request(app).post('/auth/register').send({
      email: 'canary_sec@campus.edu',
      password: 'password123',
      name: 'Canary Officer',
      role: 'SECURITY',
    });
    securityToken = resSec.body.token;

    // Report Item containing canary secrets
    const repRes = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${finderToken}`)
      .send({
        category: 'laptop',
        public_description: 'Dell XPS 15 laptop in black sleeve',
        hidden_description: `Private note: ${CANARY_HIDDEN_DESC}`,
        hidden_attributes: {
          brand: 'Dell',
          serial_number: CANARY_SERIAL_NUM,
          secret_note: CANARY_SECRET_NOTE,
          unique_features: ['Laser engraving on underside: 773344'],
        },
        found_location_public: 'Engineering Atrium',
        found_date: new Date().toISOString(),
      });
    canaryItemId = repRes.body.item.id;
  });

  afterAll(async () => {
    await db.close();
  });

  it('INVARIANT 1: Hidden canary data NEVER appears in public item endpoints', async () => {
    // Transition to open
    await ctx.ports.core.setItemStatus(canaryItemId, 'OPEN_FOR_CLAIMS');

    // 1. Check GET /items list
    const listRes = await request(app).get('/items');
    expect(listRes.status).toBe(200);
    const listText = JSON.stringify(listRes.body);
    expect(listText).not.toContain(CANARY_HIDDEN_DESC);
    expect(listText).not.toContain(CANARY_SERIAL_NUM);
    expect(listText).not.toContain(CANARY_SECRET_NOTE);

    // 2. Check GET /items/:id as anonymous/public
    const getRes = await request(app).get(`/items/${canaryItemId}`);
    expect(getRes.status).toBe(200);
    const getText = JSON.stringify(getRes.body);
    expect(getText).not.toContain(CANARY_HIDDEN_DESC);
    expect(getText).not.toContain(CANARY_SERIAL_NUM);
    expect(getText).not.toContain(CANARY_SECRET_NOTE);
    expect(getRes.body.item.hidden_description).toBeUndefined();
    expect(getRes.body.item.hidden_attributes).toBeUndefined();
  });

  it('INVARIANT 2: Claimant submitting and viewing claims NEVER receives canary hidden data', async () => {
    const clRes = await request(app)
      .post('/claims')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        item_id: canaryItemId,
        description: 'Lost my Dell XPS 15 laptop',
        claimed_attributes: { brand: 'Dell' },
        lost_date: new Date().toISOString(),
        lost_location: 'Engineering Atrium',
      });
    expect(clRes.status).toBe(201);
    canaryClaimId = clRes.body.claim.id;

    const clText = JSON.stringify(clRes.body);
    expect(clText).not.toContain(CANARY_HIDDEN_DESC);
    expect(clText).not.toContain(CANARY_SERIAL_NUM);
    expect(clText).not.toContain(CANARY_SECRET_NOTE);

    // Get claim details
    const getClRes = await request(app)
      .get(`/claims/${canaryClaimId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(getClRes.status).toBe(200);
    const getClText = JSON.stringify(getClRes.body);
    expect(getClText).not.toContain(CANARY_HIDDEN_DESC);
    expect(getClText).not.toContain(CANARY_SERIAL_NUM);
    expect(getClText).not.toContain(CANARY_SECRET_NOTE);
  });

  it('INVARIANT 3: Correct answers to verification questions are NEVER leaked to claimant', async () => {
    const qRes = await request(app)
      .get(`/workflow/claims/${canaryClaimId}/questions`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(qRes.status).toBe(200);

    const qText = JSON.stringify(qRes.body);
    expect(qText).not.toContain(CANARY_HIDDEN_DESC);
    expect(qText).not.toContain(CANARY_SERIAL_NUM);
    expect(qText).not.toContain('773344');

    const ansRes = await request(app)
      .post(`/workflow/claims/${canaryClaimId}/answers`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [{ question_id: qRes.body.questions[0].id, answer: 'test answer' }],
      });
    expect(ansRes.status).toBe(200);
    // Response should be a blind receipt acknowledgment only
    expect(ansRes.body.received).toBe(true);
    expect(ansRes.body.matched).toBeUndefined();
    expect(ansRes.body.score).toBeUndefined();
  });

  it('INVARIANT 4: Highest score NEVER wins automatically without explicit security decision', async () => {
    // Score is 98.0
    await db.query('UPDATE claims SET final_score = 98.0, structured_score = 98.0 WHERE id = $1', [canaryClaimId]);

    // Check item and claim status
    const item = await ctx.ports.core.getItem(canaryItemId);
    const claim = await ctx.ports.core.getClaim(canaryClaimId);

    // Item must remain in OPEN_FOR_CLAIMS or UNDER_REVIEW - NEVER auto-approved or collected!
    expect(item.status).not.toBe('APPROVED_AWAITING_COLLECTION');
    expect(item.status).not.toBe('COLLECTED');
    expect(claim.status).not.toBe('APPROVED');
    expect(claim.status).not.toBe('COLLECTED');
  });

  it('INVARIANT 5: QR tokens and OTPs are stored ONLY as HMAC-SHA256 hashes in the database', async () => {
    // Approve claim
    await request(app).post(`/claims/${canaryClaimId}/approve`).set('Authorization', `Bearer ${securityToken}`);

    const res = await db.query('SELECT qr_token_hash, otp_hash FROM handovers WHERE claim_id = $1', [
      canaryClaimId,
    ]);
    expect(res.rows.length).toBe(1);
    const row = res.rows[0];

    // Must be 64-char hex strings
    expect(row.qr_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.otp_hash).toMatch(/^[a-f0-9]{64}$/);

    // DB table must NOT contain plaintext otp or qr_token columns
    const columnsRes = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'handovers'`,
    );
    const colNames = columnsRes.rows.map((c: any) => c.column_name);
    expect(colNames).not.toContain('otp');
    expect(colNames).not.toContain('qr_token');
    expect(colNames).not.toContain('plaintext_otp');
  });

  it('INVARIANT 6: Audit log is append-only and immutable against UPDATE and DELETE tampering', async () => {
    const chain = await ctx.ports.audit.log({
      actor_id: 'sec_inv',
      action: 'ITEM_VERIFIED',
      item_id: canaryItemId,
      metadata: { invariant_test: true },
    });

    const verifyBefore = await request(app)
      .get('/audit/verify-chain')
      .set('Authorization', `Bearer ${securityToken}`);
    expect(verifyBefore.body.verified).toBe(true);

    // If an external attacker attempts to overwrite a past log entry, verifyChain immediately flags tampering
    const latestLog = await db.query('SELECT seq FROM audit_logs ORDER BY seq DESC LIMIT 1');
    const seq = latestLog.rows[0].seq;

    // Tamper with hash
    await db.query(`UPDATE audit_logs SET row_hash = 'tampered' WHERE seq = $1`, [seq]);
    const verifyAfter = await request(app)
      .get('/audit/verify-chain')
      .set('Authorization', `Bearer ${securityToken}`);

    expect(verifyAfter.body.verified).toBe(false);
    expect(verifyAfter.body.tampered_seqs).toContain(Number(seq));
  });
});
