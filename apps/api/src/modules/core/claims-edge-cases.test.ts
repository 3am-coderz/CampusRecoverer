import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';

describe('Member 4: Claims Edge Cases & Security Tests', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  let adminToken: string;
  let securityToken: string;
  let securityId: string;
  let finderToken: string;
  let finderId: string;
  let student1Token: string;
  let student1Id: string;
  let student2Token: string;
  let student2Id: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;

    // 1. Admin
    const adminRes = await request(app).post('/auth/register').send({
      email: 'admin_claims@campus.edu',
      password: 'password123',
      name: 'Claims Admin',
      role: 'ADMIN',
    });
    adminToken = adminRes.body.token;

    // 2. Security
    const secRes = await request(app).post('/auth/register').send({
      email: 'sec_claims@campus.edu',
      password: 'password123',
      name: 'Claims Officer',
      role: 'SECURITY',
    });
    securityToken = secRes.body.token;
    securityId = secRes.body.user.id;

    // 3. Finder
    const finderRes = await request(app).post('/auth/register').send({
      email: 'finder_claims@campus.edu',
      password: 'password123',
      name: 'Claims Finder',
      role: 'FINDER',
    });
    finderToken = finderRes.body.token;
    finderId = finderRes.body.user.id;

    // 4. Student 1
    const stu1Res = await request(app).post('/auth/register').send({
      email: 'student1_claims@campus.edu',
      password: 'password123',
      name: 'Claimant One',
      role: 'STUDENT',
    });
    student1Token = stu1Res.body.token;
    student1Id = stu1Res.body.user.id;

    // 5. Student 2 (Unauthorized bystander)
    const stu2Res = await request(app).post('/auth/register').send({
      email: 'student2_claims@campus.edu',
      password: 'password123',
      name: 'Claimant Two',
      role: 'STUDENT',
    });
    student2Token = stu2Res.body.token;
    student2Id = stu2Res.body.user.id;
  });

  afterAll(async () => {
    await db.close();
  });

  async function createItemInStatus(status: string, category = 'calculator', riskLevel = 'MEDIUM') {
    const itemId = 'item_' + Math.random().toString(36).substring(2, 10);
    await db.query(
      `INSERT INTO items (
        id, category, public_description, hidden_description, hidden_attributes,
        found_location_public, found_date, status, risk_level, security_verified,
        finder_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
      [
        itemId,
        category,
        'Found ' + category,
        'Secret hidden data canary',
        JSON.stringify({ serial: 'SN-123' }),
        'Student Center',
        status,
        riskLevel,
        status !== 'PENDING_HANDOVER',
        finderId,
      ],
    );
    return itemId;
  }

  describe('1. Claim Submission Edge Cases', () => {
    it('rejects claim for nonexistent item ID (404 ITEM_NOT_FOUND)', async () => {
      const res = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: 'item_nonexistent_xyz',
          description: 'Claiming nonexistent item',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Student Center',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ITEM_NOT_FOUND');
    });

    it('rejects claim when item status is PENDING_HANDOVER (400 ITEM_NOT_OPEN_FOR_CLAIMS)', async () => {
      const itemId = await createItemInStatus('PENDING_HANDOVER');

      const res = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'Claiming premature item',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Student Center',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ITEM_NOT_OPEN_FOR_CLAIMS');
    });

    it('rejects claim when item status is WAITING_PERIOD (400 ITEM_NOT_OPEN_FOR_CLAIMS)', async () => {
      const itemId = await createItemInStatus('WAITING_PERIOD');

      const res = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'Claiming waiting period item',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Student Center',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ITEM_NOT_OPEN_FOR_CLAIMS');
    });

    it('rejects duplicate claim by the same student on the same item (400 DUPLICATE_CLAIM)', async () => {
      const itemId = await createItemInStatus('OPEN_FOR_CLAIMS');

      // 1st claim -> succeeds
      const firstRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'First valid claim on this calculator',
          claimed_attributes: { brand: 'TI' },
          lost_date: new Date().toISOString(),
          lost_location: 'Student Center',
        });
      expect(firstRes.status).toBe(201);

      // 2nd claim -> rejected
      const secondRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'Duplicate claim attempt on same item',
          claimed_attributes: { brand: 'TI' },
          lost_date: new Date().toISOString(),
          lost_location: 'Student Center',
        });

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.error.code).toBe('DUPLICATE_CLAIM');
    });
  });

  describe('2. Claims Read and Access Controls', () => {
    let testItemId: string;
    let testClaimId: string;

    beforeAll(async () => {
      testItemId = await createItemInStatus('OPEN_FOR_CLAIMS');
      const claimRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: testItemId,
          description: 'Student 1 valid claim',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Student Center',
        });
      testClaimId = claimRes.body.claim.id;
    });

    it('rejects unauthenticated access to /items/:id/claims (401)', async () => {
      const res = await request(app).get(`/items/${testItemId}/claims`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('rejects STUDENT from listing claims for an item (403 FORBIDDEN_ROLE)', async () => {
      const res = await request(app)
        .get(`/items/${testItemId}/claims`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('allows SECURITY officer to view all claims for an item', async () => {
      const res = await request(app)
        .get(`/items/${testItemId}/claims`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.claims)).toBe(true);
      expect(res.body.claims.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects student from viewing another student private claim (403)', async () => {
      const res = await request(app)
        .get(`/claims/${testClaimId}`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(res.status).toBe(403);
    });

    it('allows claimant to view their own claim', async () => {
      const res = await request(app)
        .get(`/claims/${testClaimId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.claim.id).toBe(testClaimId);
    });

    it('allows SECURITY officer to view any claim', async () => {
      const res = await request(app)
        .get(`/claims/${testClaimId}`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(res.status).toBe(200);
      expect(res.body.claim.id).toBe(testClaimId);
    });
  });

  describe('3. Claim Approval Edge Cases', () => {
    it('rejects claim approval by non-staff (403 FORBIDDEN_ROLE)', async () => {
      const itemId = await createItemInStatus('OPEN_FOR_CLAIMS');
      const claimRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'Claim to test unauthorized approval',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Library',
        });

      const res = await request(app)
        .post(`/claims/${claimRes.body.claim.id}/approve`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects approval of HIGH-risk item claim if questions were not answered (400 VERIFICATION_QUESTIONS_REQUIRED)', async () => {
      const itemId = await createItemInStatus('OPEN_FOR_CLAIMS', 'laptop', 'HIGH');
      const claimRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'Claiming high risk laptop',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Science Hall',
        });
      const claimId = claimRes.body.claim.id;

      // Mock verification summary returning 0 questions answered
      const originalSummary = ctx.ports.workflow.verificationSummary;
      ctx.ports.workflow.verificationSummary = async () => ({
        questions_answered: 0,
        matched: 0,
        overall: 0,
        id_required: true,
      });

      try {
        const res = await request(app)
          .post(`/claims/${claimId}/approve`)
          .set('Authorization', `Bearer ${securityToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VERIFICATION_QUESTIONS_REQUIRED');
      } finally {
        ctx.ports.workflow.verificationSummary = originalSummary;
      }
    });

    it('rejects duplicate approval on an already approved claim (400 ALREADY_APPROVED)', async () => {
      const itemId = await createItemInStatus('OPEN_FOR_CLAIMS', 'backpack', 'LOW');
      const claimRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'Backpack claim for duplicate approve test',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Cafeteria',
        });
      const claimId = claimRes.body.claim.id;

      // 1st approval -> succeeds
      const firstRes = await request(app)
        .post(`/claims/${claimId}/approve`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(firstRes.status).toBe(200);

      // 2nd approval -> must be rejected
      const secondRes = await request(app)
        .post(`/claims/${claimId}/approve`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.error.code).toBe('ALREADY_APPROVED');
    });

    it('rejects approval on an already REJECTED claim (400 ILLEGAL_CLAIM_TRANSITION)', async () => {
      const itemId = await createItemInStatus('OPEN_FOR_CLAIMS', 'hat', 'LOW');
      const claimRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'Claim to be rejected first',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Gym',
        });
      const claimId = claimRes.body.claim.id;

      // Reject claim
      const rejectRes = await request(app)
        .post(`/claims/${claimId}/reject`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ reason: 'Incorrect details' });
      expect(rejectRes.status).toBe(200);

      // Attempt to approve rejected claim
      const approveRes = await request(app)
        .post(`/claims/${claimId}/approve`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(approveRes.status).toBe(400);
      expect(approveRes.body.error.code).toBe('ILLEGAL_CLAIM_TRANSITION');
    });
  });

  describe('4. Claim Rejection Edge Cases', () => {
    it('rejects claim rejection by non-staff (403 FORBIDDEN_ROLE)', async () => {
      const itemId = await createItemInStatus('OPEN_FOR_CLAIMS');
      const claimRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'Claim to test unauthorized reject',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Library',
        });

      const res = await request(app)
        .post(`/claims/${claimRes.body.claim.id}/reject`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ reason: 'Unauthorized attempt' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects duplicate rejection on an already rejected claim (400 ALREADY_REJECTED)', async () => {
      const itemId = await createItemInStatus('OPEN_FOR_CLAIMS', 'gloves', 'LOW');
      const claimRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'Claim to test duplicate rejection',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Bus Stop',
        });
      const claimId = claimRes.body.claim.id;

      // 1st rejection -> succeeds
      const firstRes = await request(app)
        .post(`/claims/${claimId}/reject`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ reason: 'Wrong color' });
      expect(firstRes.status).toBe(200);
      expect(firstRes.body.claim.status).toBe('REJECTED');

      // 2nd rejection -> rejected
      const secondRes = await request(app)
        .post(`/claims/${claimId}/reject`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ reason: 'Duplicate rejection' });

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.error.code).toBe('ALREADY_REJECTED');
    });
  });

  describe('5. Claim Status Updates (PATCH /claims/:id/status)', () => {
    it('rejects non-staff from patching claim status (403 FORBIDDEN_ROLE)', async () => {
      const itemId = await createItemInStatus('OPEN_FOR_CLAIMS');
      const claimRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'Status patch test claim',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Library',
        });

      const res = await request(app)
        .patch(`/claims/${claimRes.body.claim.id}/status`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects illegal status transition via PATCH (e.g. SCORED directly to COLLECTED) (400)', async () => {
      const itemId = await createItemInStatus('OPEN_FOR_CLAIMS');
      const claimRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          item_id: itemId,
          description: 'Illegal transition test claim',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Library',
        });

      const res = await request(app)
        .patch(`/claims/${claimRes.body.claim.id}/status`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ status: 'COLLECTED' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ILLEGAL_CLAIM_TRANSITION');
    });
  });
});
