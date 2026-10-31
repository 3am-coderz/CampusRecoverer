import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';

describe('Member 2: Core Module Tests', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  let finderToken: string;
  let finderId: string;
  let studentToken: string;
  let studentId: string;
  let securityToken: string;
  let securityId: string;
  let reportedItemId: string;

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

  it('registers users and logs them in', async () => {
    // 1. Register Finder
    const res1 = await request(app).post('/auth/register').send({
      email: 'finder@campus.edu',
      password: 'password123',
      name: 'Jordan Finder',
      role: 'FINDER',
    });
    expect(res1.status).toBe(201);
    expect(res1.body.user.email).toBe('finder@campus.edu');
    expect(res1.body.token).toBeDefined();
    finderToken = res1.body.token;
    finderId = res1.body.user.id;

    // 2. Register Student
    const res2 = await request(app).post('/auth/register').send({
      email: 'student@campus.edu',
      password: 'password123',
      name: 'Alex Student',
      role: 'STUDENT',
    });
    expect(res2.status).toBe(201);
    studentToken = res2.body.token;
    studentId = res2.body.user.id;

    // 3. Register Security
    const res3 = await request(app).post('/auth/register').send({
      email: 'security@campus.edu',
      password: 'password123',
      name: 'Officer Sarah',
      role: 'SECURITY',
    });
    expect(res3.status).toBe(201);
    securityToken = res3.body.token;
    securityId = res3.body.user.id;

    // 4. Test /auth/me
    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${finderToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(finderId);
  });

  it('finder reports an item; starts PENDING_HANDOVER, security_verified=false', async () => {
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${finderToken}`)
      .send({
        category: 'laptop',
        public_description: 'Silver 14-inch laptop with code stickers',
        hidden_description: 'Space gray MacBook Pro M2, serial SN-CANARY-9876, secret dent on corner',
        hidden_attributes: {
          serial_number: 'SN-CANARY-9876',
          brand: 'Apple',
          unique_features: ['secret dent on corner'],
        },
        found_location_public: 'Science Hall 101',
        found_date: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.item.status).toBe('PENDING_HANDOVER');
    expect(res.body.item.security_verified).toBe(false);
    reportedItemId = res.body.item.id;
  });

  it('SECURITY INVARIANT: Public projection NEVER contains hidden_description, hidden_attributes, or finder_id', async () => {
    // 1. Public list
    const listRes = await request(app).get('/items');
    if (listRes.status !== 200) console.error('GET /items failed with:', listRes.body);
    expect(listRes.status).toBe(200);
    const itemInList = listRes.body.items.find((i: any) => i.id === reportedItemId);
    expect(itemInList).toBeUndefined(); // PENDING_HANDOVER not visible to public

    // 2. Fetch directly as unauthenticated / public
    const getRes = await request(app).get(`/items/${reportedItemId}`);
    expect(getRes.status).toBe(404); // Not visible while PENDING_HANDOVER
  });

  it('verifies item only after physical desk receipt has been logged', async () => {
    // Without receipt -> fails
    const failRes = await request(app)
      .post(`/items/${reportedItemId}/verify`)
      .set('Authorization', `Bearer ${securityToken}`);
    expect(failRes.status).toBe(400);
    expect(failRes.body.error.code).toBe('MISSING_PHYSICAL_RECEIPT');

    // Simulate physical desk receipt logged via WorkflowPort
    await ctx.ports.workflow.recordCustody({
      item_id: reportedItemId,
      event: 'RECEIVED_BY_SECURITY',
      actor_id: securityId,
    });

    // Verify again -> succeeds
    const successRes = await request(app)
      .post(`/items/${reportedItemId}/verify`)
      .set('Authorization', `Bearer ${securityToken}`);
    expect(successRes.status).toBe(200);
    expect(successRes.body.item.status).toBe('WAITING_PERIOD');
    expect(successRes.body.item.security_verified).toBe(true);
  });

  it('promotes item to OPEN_FOR_CLAIMS and allows public projection without hidden data', async () => {
    // Manually transition to OPEN_FOR_CLAIMS
    await ctx.ports.core.setItemStatus(reportedItemId, 'OPEN_FOR_CLAIMS');

    const res = await request(app).get(`/items/${reportedItemId}`);
    expect(res.status).toBe(200);
    expect(res.body.item.public_description).toBeDefined();

    // Verify CANARY hidden data NEVER leaks
    expect(res.body.item.hidden_description).toBeUndefined();
    expect(res.body.item.hidden_attributes).toBeUndefined();
    expect(res.body.item.finder_id).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('SN-CANARY-9876');
    expect(JSON.stringify(res.body)).not.toContain('secret dent');
  });

  it('INVARIANT: 403 Forbidden when finder attempts to claim their own item', async () => {
    const res = await request(app)
      .post('/claims')
      .set('Authorization', `Bearer ${finderToken}`)
      .send({
        item_id: reportedItemId,
        description: 'Trying to claim my own reported item',
        claimed_attributes: {},
        lost_date: new Date().toISOString(),
        lost_location: 'Science Hall',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FINDER_CANNOT_CLAIM_OWN_ITEM');
  });

  it('student can submit a valid claim and matching scores are recorded', async () => {
    const res = await request(app)
      .post('/claims')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        item_id: reportedItemId,
        description: 'Lost my silver Apple laptop in science hall',
        claimed_attributes: {
          brand: 'Apple',
        },
        lost_date: new Date().toISOString(),
        lost_location: 'Science Hall',
      });

    expect(res.status).toBe(201);
    expect(res.body.claim.claimant_id).toBe(studentId);
    expect(res.body.claim.status).toBe('SCORED');
    expect(res.body.claim.structured_score).toBeGreaterThan(0);
  });
});
