import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';
import { RiskClassifier } from './services/risk-classifier.js';
import { assertItemTransition, assertClaimTransition } from './services/state-machine.js';

describe('Member 4: Workflow & Business Logic Module Tests', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  let securityToken: string;
  let claimantToken1: string;
  let claimantToken2: string;
  let claimantId1: string;
  let claimantId2: string;
  let testItemId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;

    // Register Security
    const secRes = await request(app).post('/auth/register').send({
      email: 'sec_wf@campus.edu',
      password: 'password123',
      name: 'Officer John',
      role: 'SECURITY',
    });
    securityToken = secRes.body.token;

    // Register Claimants
    const c1 = await request(app).post('/auth/register').send({
      email: 'claimant1@campus.edu',
      password: 'password123',
      name: 'Claimant 1',
      role: 'STUDENT',
    });
    claimantToken1 = c1.body.token;
    claimantId1 = c1.body.user.id;

    const c2 = await request(app).post('/auth/register').send({
      email: 'claimant2@campus.edu',
      password: 'password123',
      name: 'Claimant 2',
      role: 'STUDENT',
    });
    claimantToken2 = c2.body.token;
    claimantId2 = c2.body.user.id;
  });

  afterAll(async () => {
    await db.close();
  });

  it('Risk Classifier correctly categorizes HIGH, MEDIUM, and LOW risk assets', () => {
    const classifier = new RiskClassifier();

    expect(classifier.classify('iPhone 15 Pro')).toBe('HIGH');
    expect(classifier.classify('MacBook Air M2')).toBe('HIGH');
    expect(classifier.classify('Leather Wallet')).toBe('HIGH');
    expect(classifier.classify('Passport')).toBe('HIGH');
    expect(classifier.classify('Student ID Card')).toBe('HIGH');

    expect(classifier.classify('Sony WH-1000XM4')).toBe('MEDIUM');
    expect(classifier.classify('Backpack with books')).toBe('MEDIUM');
    expect(classifier.classify('Apple Watch')).toBe('MEDIUM');
    expect(classifier.classify('Graphing Calculator')).toBe('MEDIUM');

    expect(classifier.classify('Hydro Flask Bottle')).toBe('LOW');
    expect(classifier.classify('Notebook and pens')).toBe('LOW');
    expect(classifier.classify('Umbrella')).toBe('LOW');

    // Classification via hidden_attributes keyword fallback
    expect(classifier.classify('Miscellaneous pouch', { contents: ['driver license', 'credit card'] })).toBe('HIGH');
  });

  it('State Machine enforces legal transitions and rejects illegal moves', () => {
    // Legal moves
    expect(() => assertItemTransition('PENDING_HANDOVER', 'WAITING_PERIOD')).not.toThrow();
    expect(() => assertItemTransition('WAITING_PERIOD', 'OPEN_FOR_CLAIMS')).not.toThrow();
    expect(() => assertItemTransition('OPEN_FOR_CLAIMS', 'APPROVED_AWAITING_COLLECTION')).not.toThrow();
    expect(() => assertItemTransition('APPROVED_AWAITING_COLLECTION', 'COLLECTED')).not.toThrow();

    // Illegal moves
    expect(() => assertItemTransition('PENDING_HANDOVER', 'COLLECTED')).toThrow('Illegal item transition');
    expect(() => assertItemTransition('COLLECTED', 'OPEN_FOR_CLAIMS')).toThrow('Illegal item transition');
    expect(() => assertItemTransition('EXPIRED', 'WAITING_PERIOD')).toThrow('Illegal item transition');

    // Claim transitions
    expect(() => assertClaimTransition('SUBMITTED', 'SCORED')).not.toThrow();
    expect(() => assertClaimTransition('SCORED', 'APPROVED')).not.toThrow();
    expect(() => assertClaimTransition('APPROVED', 'COLLECTED')).not.toThrow();
    expect(() => assertClaimTransition('REJECTED', 'APPROVED')).toThrow('Illegal claim transition');
  });

  it('Custody: Physical desk check-in logs RECEIVED_BY_SECURITY and STORED events', async () => {
    // Register separate finder
    const finderRes = await request(app).post('/auth/register').send({
      email: 'finder_wf@campus.edu',
      password: 'password123',
      name: 'Item Finder',
      role: 'FINDER',
    });
    const finderId = finderRes.body.user.id;

    testItemId = 'item_wf_custody_1';
    await db.query(
      `INSERT INTO items (
        id, category, public_description, hidden_description, hidden_attributes,
        found_location_public, found_date, status, risk_level, security_verified,
        finder_id, created_at
      ) VALUES ($1, 'laptop', 'MacBook Pro', 'Space gray with stickers', '{"brand":"Apple","serial_number":"C02XYZ1234","unique_features":["python sticker"]}', 'Library', CURRENT_TIMESTAMP, 'PENDING_HANDOVER', 'HIGH', FALSE, $2, CURRENT_TIMESTAMP)`,
      [testItemId, finderId],
    );

    const receiveRes = await request(app)
      .post(`/workflow/items/${testItemId}/receive`)
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ storage_location: 'Bin A-14 Shelf 2' });

    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body.success).toBe(true);

    const custodyRes = await request(app)
      .get(`/workflow/items/${testItemId}/custody`)
      .set('Authorization', `Bearer ${securityToken}`);

    expect(custodyRes.status).toBe(200);
    expect(custodyRes.body.custody_events.length).toBeGreaterThanOrEqual(2);
    const events = custodyRes.body.custody_events.map((e: any) => e.event);
    expect(events).toContain('RECEIVED_BY_SECURITY');
    expect(events).toContain('STORED');
  });

  it('Multi-claim dispute rule: 91 vs 89 forces all involved claims to MANUAL_REVIEW and item to UNDER_REVIEW', async () => {
    // Move item to OPEN_FOR_CLAIMS
    await ctx.ports.core.setItemStatus(testItemId, 'OPEN_FOR_CLAIMS');

    // Claimant 1 submits claim
    const c1Res = await request(app)
      .post('/claims')
      .set('Authorization', `Bearer ${claimantToken1}`)
      .send({
        item_id: testItemId,
        description: 'My MacBook Pro 14 space gray with python sticker',
        claimed_attributes: { brand: 'Apple', serial_number: 'C02XYZ1234', unique_features: ['python sticker'] },
        lost_date: new Date().toISOString(),
        lost_location: 'Library',
      });
    expect(c1Res.status).toBe(201);
    const claim1Id = c1Res.body.claim.id;

    // Manually set claim 1 score to 91
    await db.query('UPDATE claims SET final_score = 91.0, structured_score = 92.0, status = $1 WHERE id = $2', [
      'SCORED',
      claim1Id,
    ]);

    // Claimant 2 submits competing claim
    const c2Res = await request(app)
      .post('/claims')
      .set('Authorization', `Bearer ${claimantToken2}`)
      .send({
        item_id: testItemId,
        description: 'Lost my Apple laptop in library with stickers',
        claimed_attributes: { brand: 'Apple', unique_features: ['python sticker'] },
        lost_date: new Date().toISOString(),
        lost_location: 'Library',
      });
    expect(c2Res.status).toBe(201);
    const claim2Id = c2Res.body.claim.id;

    // Manually set claim 2 score to 89
    await db.query('UPDATE claims SET final_score = 89.0, structured_score = 90.0, status = $1 WHERE id = $2', [
      'SCORED',
      claim2Id,
    ]);

    // Call resolveClaims
    const resolution = await ctx.ports.workflow.resolveClaims(testItemId);
    expect(resolution.multi_high_confidence).toBe(true);
    expect(resolution.item_status).toBe('UNDER_REVIEW');
    expect(resolution.claim_updates.length).toBe(2);

    // Apply updates
    await ctx.ports.core.setItemStatus(testItemId, resolution.item_status);
    for (const u of resolution.claim_updates) {
      await ctx.ports.core.setClaimStatus(u.claim_id, u.status);
    }

    const item = await ctx.ports.core.getItem(testItemId);
    const cl1 = await ctx.ports.core.getClaim(claim1Id);
    const cl2 = await ctx.ports.core.getClaim(claim2Id);

    expect(item.status).toBe('UNDER_REVIEW');
    expect(cl1.status).toBe('MANUAL_REVIEW');
    expect(cl2.status).toBe('MANUAL_REVIEW');
  });

  it('Ownership verification questions: dynamically generated and answers never leak to claimant', async () => {
    // Fetch claims for claimant 1
    const claimsRes = await request(app)
      .get('/claims/mine')
      .set('Authorization', `Bearer ${claimantToken1}`);
    const claimId = claimsRes.body.claims[0].id;

    // 1. Get questions
    const qRes = await request(app)
      .get(`/workflow/claims/${claimId}/questions`)
      .set('Authorization', `Bearer ${claimantToken1}`);

    expect(qRes.status).toBe(200);
    expect(qRes.body.questions.length).toBeGreaterThan(0);

    // Verify questions NEVER leak expected values
    const rawQuestionsText = JSON.stringify(qRes.body);
    expect(rawQuestionsText).not.toContain('C02XYZ1234');
    expect(rawQuestionsText).not.toContain('python sticker');

    // 2. Submit answers
    const ansRes = await request(app)
      .post(`/workflow/claims/${claimId}/answers`)
      .set('Authorization', `Bearer ${claimantToken1}`)
      .send({
        answers: [
          { question_id: qRes.body.questions[0].id, answer: 'It has a python logo sticker on it' },
        ],
      });

    expect(ansRes.status).toBe(200);
    expect(ansRes.body.received).toBe(true);
    // Invariant: claimant is NEVER told their score or correctness!
    expect(ansRes.body.matched).toBeUndefined();
    expect(ansRes.body.score).toBeUndefined();

    // 3. Inspect answers table: only similarity/matched stored, NEVER the expected answer!
    const ansDb = await db.query('SELECT * FROM claim_answers WHERE claim_id = $1', [claimId]);
    expect(ansDb.rows.length).toBeGreaterThan(0);
    const row = ansDb.rows[0];
    expect(row.matched).toBeDefined();
    expect(row.similarity).toBeDefined();
    expect(row.expected_answer).toBeUndefined();
  });

  it('Disposition workflow: only allowed for EXPIRED items', async () => {
    // Attempting disposition while item is UNDER_REVIEW fails
    const failRes = await request(app)
      .post(`/workflow/items/${testItemId}/disposition`)
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ disposition: 'DONATE', notes: 'Campus charity' });

    expect(failRes.status).toBe(400);
    expect(failRes.body.error.code).toBe('ITEM_NOT_EXPIRED');

    // Move item to EXPIRED
    await ctx.ports.core.setItemStatus(testItemId, 'EXPIRED');

    // Disposition now succeeds
    const successRes = await request(app)
      .post(`/workflow/items/${testItemId}/disposition`)
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ disposition: 'DONATE', notes: 'Donated to student tech fund' });

    expect(successRes.status).toBe(200);
    expect(successRes.body.item_status).toBe('DONATED');

    const item = await ctx.ports.core.getItem(testItemId);
    expect(item.status).toBe('DONATED');
  });

  it('Audited HIDDEN_DATA_VIEWED: security viewing hidden attributes writes audit record', async () => {
    const hiddenRes = await request(app)
      .get(`/workflow/items/${testItemId}/hidden`)
      .set('Authorization', `Bearer ${securityToken}`);

    expect(hiddenRes.status).toBe(200);
    expect(hiddenRes.body.hidden_description).toBeDefined();

    // Check audit log for HIDDEN_DATA_VIEWED
    const auditRes = await db.query(
      `SELECT * FROM audit_logs WHERE item_id = $1 AND action = 'HIDDEN_DATA_VIEWED'`,
      [testItemId],
    );
    expect(auditRes.rows.length).toBeGreaterThan(0);
  });
});
