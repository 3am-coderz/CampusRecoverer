import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/kernel/app.js';
import { DatabaseContext } from '../../apps/api/src/kernel/db.js';

describe('Member 5: End-to-End Integration Journey', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  let finderToken: string;
  let securityToken: string;
  let studentToken1: string;
  let studentToken2: string;
  let studentId1: string;
  let studentId2: string;

  let itemId: string;
  let claim1Id: string;
  let qrToken: string;
  let otpCode: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;
  });

  afterAll(async () => {
    await db.close();
  });

  it('Step 1: User Registration and Authentication for all personas', async () => {
    // 1. Finder
    const resFinder = await request(app).post('/auth/register').send({
      email: 'e2e_finder@campus.edu',
      password: 'password123',
      name: 'E2E Finder',
      role: 'FINDER',
    });
    expect(resFinder.status).toBe(201);
    finderToken = resFinder.body.token;

    // 2. Security Desk
    const resSec = await request(app).post('/auth/register').send({
      email: 'e2e_security@campus.edu',
      password: 'password123',
      name: 'Desk Officer Dave',
      role: 'SECURITY',
    });
    expect(resSec.status).toBe(201);
    securityToken = resSec.body.token;

    // 3. Student 1 (True Owner)
    const resStu1 = await request(app).post('/auth/register').send({
      email: 'e2e_owner@campus.edu',
      password: 'password123',
      name: 'E2E Alex Owner',
      role: 'STUDENT',
    });
    expect(resStu1.status).toBe(201);
    studentToken1 = resStu1.body.token;
    studentId1 = resStu1.body.user.id;

    // 4. Student 2 (Competing Claimant)
    const resStu2 = await request(app).post('/auth/register').send({
      email: 'e2e_competitor@campus.edu',
      password: 'password123',
      name: 'E2E Taylor Competitor',
      role: 'STUDENT',
    });
    expect(resStu2.status).toBe(201);
    studentToken2 = resStu2.body.token;
    studentId2 = resStu2.body.user.id;
  });

  it('Step 2: Finder reports found asset; starts PENDING_HANDOVER and non-public', async () => {
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${finderToken}`)
      .send({
        category: 'phone',
        public_description: 'Black smartphone with clear bumper case',
        hidden_description: 'iPhone 15 Pro, black titanium, small chip on bottom left speaker grill, wallpaper of Golden Gate Bridge',
        hidden_attributes: {
          brand: 'Apple',
          model: 'iPhone 15 Pro',
          color: 'Black Titanium',
          serial_number: 'SN-E2E-IPHONE-9988',
          unique_features: ['chip on bottom left speaker grill', 'Golden Gate bridge wallpaper'],
        },
        found_location_public: 'Student Center Cafeteria',
        found_date: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.item.status).toBe('PENDING_HANDOVER');
    expect(res.body.item.security_verified).toBe(false);
    expect(res.body.item.risk_level).toBe('HIGH');
    itemId = res.body.item.id;

    // Verify item is NOT visible in public browse
    const listRes = await request(app).get('/items');
    expect(listRes.body.items.some((i: any) => i.id === itemId)).toBe(false);
  });

  it('Step 3: Security receives physical item, logs custody, and verifies it into WAITING_PERIOD', async () => {
    // Check in at desk
    const receiveRes = await request(app)
      .post(`/workflow/items/${itemId}/receive`)
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ storage_location: 'Secure Locker 14B' });
    expect(receiveRes.status).toBe(200);

    // Verify item into holding period
    const verifyRes = await request(app)
      .post(`/items/${itemId}/verify`)
      .set('Authorization', `Bearer ${securityToken}`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.item.status).toBe('WAITING_PERIOD');
    expect(verifyRes.body.item.security_verified).toBe(true);
  });

  it('Step 4: Holding period elapses; item transitions to OPEN_FOR_CLAIMS and appears publicly', async () => {
    await ctx.ports.core.setItemStatus(itemId, 'OPEN_FOR_CLAIMS');

    const publicRes = await request(app).get(`/items/${itemId}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.item.status).toBe('OPEN_FOR_CLAIMS');
    expect(publicRes.body.item.public_description).toContain('Black smartphone');
    expect(publicRes.body.item.hidden_description).toBeUndefined();
    expect(publicRes.body.item.hidden_attributes).toBeUndefined();
  });

  it('Step 5: Owner submits claim, receives verification questions, and answers them', async () => {
    const claimRes = await request(app)
      .post('/claims')
      .set('Authorization', `Bearer ${studentToken1}`)
      .send({
        item_id: itemId,
        description: 'I lost my black iPhone 15 Pro during lunch. It has a chip on the lower speaker grill.',
        claimed_attributes: {
          brand: 'Apple',
          model: 'iPhone 15 Pro',
          color: 'Black Titanium',
          serial_number: 'SN-E2E-IPHONE-9988',
          unique_features: ['chip on bottom left speaker grill'],
        },
        lost_date: new Date().toISOString(),
        lost_location: 'Student Center Cafeteria',
      });

    expect(claimRes.status).toBe(201);
    expect(claimRes.body.claim.status).toBe('SCORED');
    claim1Id = claimRes.body.claim.id;

    // Fetch questions
    const qRes = await request(app)
      .get(`/workflow/claims/${claim1Id}/questions`)
      .set('Authorization', `Bearer ${studentToken1}`);
    expect(qRes.status).toBe(200);
    expect(qRes.body.questions.length).toBeGreaterThan(0);

    // Answer questions
    const ansRes = await request(app)
      .post(`/workflow/claims/${claim1Id}/answers`)
      .set('Authorization', `Bearer ${studentToken1}`)
      .send({
        answers: [
          { question_id: qRes.body.questions[0].id, answer: 'small chip on speaker grill and golden gate bridge wallpaper' },
        ],
      });
    expect(ansRes.status).toBe(200);
    expect(ansRes.body.received).toBe(true);
  });

  it('Step 6: Security reviews claim, approves it, issuing handover QR and sending OTP to owner', async () => {
    const approveRes = await request(app)
      .post(`/claims/${claim1Id}/approve`)
      .set('Authorization', `Bearer ${securityToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.handover_id).toBeDefined();

    // Owner fetches QR token and QR image
    const qrRes = await request(app)
      .get(`/handover/claims/${claim1Id}/qr`)
      .set('Authorization', `Bearer ${studentToken1}`);
    expect(qrRes.status).toBe(200);
    qrToken = qrRes.body.qr_token;
    expect(qrRes.body.qr_png_base64).toContain('data:image/png;base64');

    // Owner checks private notifications for one-time OTP
    const notifRes = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${studentToken1}`);
    expect(notifRes.status).toBe(200);

    const match = notifRes.body.notifications[0].message.match(/OTP is: (\d{6})/);
    expect(match).not.toBeNull();
    otpCode = match![1];
  });

  it('Step 7: Physical desk verification with QR token, OTP, and photo ID releases item to COLLECTED', async () => {
    const verifyRes = await request(app)
      .post('/handover/verify')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        qr_token: qrToken,
        otp: otpCode,
        id_verified: true, // Required for HIGH-risk phone
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);

    const finalItem = await ctx.ports.core.getItem(itemId);
    const finalClaim = await ctx.ports.core.getClaim(claim1Id);
    expect(finalItem.status).toBe('COLLECTED');
    expect(finalClaim.status).toBe('COLLECTED');
  });

  it('Step 8: Cryptographic Audit Trail is completely intact across all lifecycle steps', async () => {
    const chainRes = await request(app)
      .get('/audit/verify-chain')
      .set('Authorization', `Bearer ${securityToken}`);

    expect(chainRes.status).toBe(200);
    expect(chainRes.body.verified).toBe(true);
    expect(chainRes.body.tampered_seqs).toHaveLength(0);
    expect(chainRes.body.total_entries).toBeGreaterThanOrEqual(5);

    // Verify audit contains all expected actions
    const logsRes = await request(app)
      .get(`/audit?item_id=${itemId}`)
      .set('Authorization', `Bearer ${securityToken}`);
    const actions = logsRes.body.logs.map((l: any) => l.action);

    expect(actions).toContain('ITEM_REPORTED');
    expect(actions).toContain('ITEM_RECEIVED');
    expect(actions).toContain('ITEM_VERIFIED');
    expect(actions).toContain('CLAIM_CREATED');
    expect(actions).toContain('CLAIM_APPROVED');
    expect(actions).toContain('QR_GENERATED');
    expect(actions).toContain('QR_VERIFIED');
    expect(actions).toContain('ITEM_COLLECTED');
  });

  it('Step 9: Two-claimant conflict scenario forces MANUAL_REVIEW and UNDER_REVIEW', async () => {
    // Create new open item
    const newItemRes = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${finderToken}`)
      .send({
        category: 'calculator',
        public_description: 'TI-84 Graphing Calculator',
        hidden_description: 'TI-84 Plus CE, black, name sticker on back',
        hidden_attributes: { brand: 'Texas Instruments', model: 'TI-84 Plus CE' },
        found_location_public: 'Math Hall 202',
        found_date: new Date().toISOString(),
      });
    const calcId = newItemRes.body.item.id;
    await ctx.ports.core.setItemStatus(calcId, 'OPEN_FOR_CLAIMS');

    // Claim 1
    const cl1 = await request(app)
      .post('/claims')
      .set('Authorization', `Bearer ${studentToken1}`)
      .send({
        item_id: calcId,
        description: 'My TI-84 Plus CE calculator',
        claimed_attributes: { brand: 'Texas Instruments', model: 'TI-84 Plus CE' },
        lost_date: new Date().toISOString(),
        lost_location: 'Math Hall',
      });
    expect(cl1.status).toBe(201);
    await db.query('UPDATE claims SET final_score = 92.0 WHERE id = $1', [cl1.body.claim.id]);

    // Claim 2
    const cl2 = await request(app)
      .post('/claims')
      .set('Authorization', `Bearer ${studentToken2}`)
      .send({
        item_id: calcId,
        description: 'Lost TI-84 Plus in math hall',
        claimed_attributes: { brand: 'Texas Instruments', model: 'TI-84 Plus CE' },
        lost_date: new Date().toISOString(),
        lost_location: 'Math Hall',
      });
    expect(cl2.status).toBe(201);
    await db.query('UPDATE claims SET final_score = 88.0 WHERE id = $1', [cl2.body.claim.id]);

    // Resolve
    const res = await ctx.ports.workflow.resolveClaims(calcId);
    expect(res.multi_high_confidence).toBe(true);
    expect(res.item_status).toBe('UNDER_REVIEW');
  });
});
