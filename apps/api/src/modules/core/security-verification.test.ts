import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';

describe('Member 4: Security Verification Component Tests', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  let adminToken: string;
  let adminId: string;
  let securityToken: string;
  let securityId: string;
  let finderToken: string;
  let finderId: string;
  let studentToken: string;
  let studentId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;

    // 1. Admin user
    const adminRes = await request(app).post('/auth/register').send({
      email: 'admin@campus.edu',
      password: 'password123',
      name: 'Admin Chief',
      role: 'ADMIN',
    });
    expect(adminRes.status).toBe(201);
    adminToken = adminRes.body.token;
    adminId = adminRes.body.user.id;

    // 2. Security officer
    const secRes = await request(app).post('/auth/register').send({
      email: 'security.officer@campus.edu',
      password: 'password123',
      name: 'Officer Jack',
      role: 'SECURITY',
    });
    expect(secRes.status).toBe(201);
    securityToken = secRes.body.token;
    securityId = secRes.body.user.id;

    // 3. Finder user
    const finderRes = await request(app).post('/auth/register').send({
      email: 'finder.m4@campus.edu',
      password: 'password123',
      name: 'Morgan Finder',
      role: 'FINDER',
    });
    expect(finderRes.status).toBe(201);
    finderToken = finderRes.body.token;
    finderId = finderRes.body.user.id;

    // 4. Student user
    const studentRes = await request(app).post('/auth/register').send({
      email: 'student.m4@campus.edu',
      password: 'password123',
      name: 'Sam Student',
      role: 'STUDENT',
    });
    expect(studentRes.status).toBe(201);
    studentToken = studentRes.body.token;
    studentId = studentRes.body.user.id;
  });

  afterAll(async () => {
    await db.close();
  });

  // Helper to create a reported item
  async function createTestItem(overrides: Partial<any> = {}) {
    const defaultData = {
      category: 'notebook',
      public_description: 'Blue spiral notebook found in library',
      hidden_description: 'Has secret canary notes on page 42 and ID badge taped inside',
      hidden_attributes: { notes: 'canary-page-42' },
      found_location_public: 'Main Library 2nd Floor',
      found_date: new Date().toISOString(),
      ...overrides,
    };

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${finderToken}`)
      .send(defaultData);

    expect(res.status).toBe(201);
    return res.body.item;
  }

  describe('1. Authentication and Authorization Controls', () => {
    it('rejects verification if no token is provided (401 AUTH_REQUIRED)', async () => {
      const item = await createTestItem();

      const res = await request(app).post(`/items/${item.id}/verify`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('rejects verification if invalid token is provided (401 INVALID_TOKEN)', async () => {
      const item = await createTestItem();

      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', 'Bearer invalid-garbage-token');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects verification when invoked by a STUDENT (403 FORBIDDEN_ROLE)', async () => {
      const item = await createTestItem();

      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects verification when invoked by FINDER who reported the item (403 FORBIDDEN_ROLE)', async () => {
      const item = await createTestItem();

      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${finderToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('allows verification by SECURITY officer', async () => {
      const item = await createTestItem();

      // Log custody receipt first
      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(200);
      expect(res.body.item.status).toBe('WAITING_PERIOD');
      expect(res.body.item.security_verified).toBe(true);
    });

    it('allows verification by ADMIN role', async () => {
      const item = await createTestItem();

      // Log custody receipt first
      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: adminId,
      });

      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.item.status).toBe('WAITING_PERIOD');
      expect(res.body.item.security_verified).toBe(true);
    });
  });

  describe('2. Validation of Item Existence and Custody Requirements', () => {
    it('returns 404 ITEM_NOT_FOUND when verifying nonexistent item ID', async () => {
      const res = await request(app)
        .post('/items/item_nonexistent_xyz999/verify')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ITEM_NOT_FOUND');
    });

    it('rejects verification when physical custody receipt is missing (400 MISSING_PHYSICAL_RECEIPT)', async () => {
      const item = await createTestItem();

      // Without physical receipt logged
      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_PHYSICAL_RECEIPT');
    });
  });

  describe('3. Duplicate Verification and Status Transition Invariants', () => {
    it('rejects duplicate verification on an already verified item (400 ALREADY_VERIFIED)', async () => {
      const item = await createTestItem();

      // Log physical receipt
      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      // 1st verification -> succeeds
      const firstRes = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(firstRes.status).toBe(200);
      expect(firstRes.body.item.security_verified).toBe(true);

      // Fetch waiting_until from DB
      const dbRow1 = await ctx.ports.core.getItem(item.id);
      const originalWaitingUntil = dbRow1.waiting_until;

      // 2nd verification attempt -> must be rejected
      const secondRes = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.error.code).toBe('ALREADY_VERIFIED');

      // Verify that DB record was NOT modified/corrupted
      const dbRow2 = await ctx.ports.core.getItem(item.id);
      expect(dbRow2.security_verified).toBe(true);
      expect(dbRow2.status).toBe('WAITING_PERIOD');
      expect(dbRow2.waiting_until).toBe(originalWaitingUntil);
    });

    it('rejects verification if item has already transitioned to OPEN_FOR_CLAIMS (400 ILLEGAL_ITEM_TRANSITION)', async () => {
      const item = await createTestItem();

      // Manually advance item to OPEN_FOR_CLAIMS with security_verified=false
      await ctx.db.query(
        `UPDATE items SET status = 'OPEN_FOR_CLAIMS', security_verified = FALSE WHERE id = $1`,
        [item.id],
      );

      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ILLEGAL_ITEM_TRANSITION');
    });

    it('rejects verification if item is in a terminal state (COLLECTED or DISPOSED)', async () => {
      const item = await createTestItem();

      await ctx.db.query(
        `UPDATE items SET status = 'COLLECTED', security_verified = FALSE WHERE id = $1`,
        [item.id],
      );

      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ILLEGAL_ITEM_TRANSITION');
    });
  });

  describe('4. High-Risk Item Verification Requirements', () => {
    it('correctly classifies laptop as HIGH risk with 72-hour waiting period', async () => {
      const item = await createTestItem({
        category: 'laptop',
        public_description: 'Dell XPS 15 laptop in black sleeve',
        hidden_description: 'Service tag SN-DELL-5520, stickers on lid',
        hidden_attributes: { service_tag: 'SN-DELL-5520' },
      });

      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      const beforeVerify = Date.now();
      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(200);
      expect(res.body.item.risk_level).toBe('HIGH');
      expect(res.body.item.security_verified).toBe(true);

      // Verify 72-hour waiting period in DB
      const dbRow = await ctx.ports.core.getItem(item.id);
      expect(dbRow.risk_level).toBe('HIGH');
      const waitingDate = new Date(dbRow.waiting_until).getTime();
      const expectedWaitingMin = beforeVerify + 71.9 * 3600 * 1000;
      const expectedWaitingMax = beforeVerify + 72.1 * 3600 * 1000;
      expect(waitingDate).toBeGreaterThanOrEqual(expectedWaitingMin);
      expect(waitingDate).toBeLessThanOrEqual(expectedWaitingMax);
    });

    it('correctly classifies phone and wallet as HIGH risk', async () => {
      const phoneItem = await createTestItem({
        category: 'phone',
        public_description: 'iPhone 15 in clear case',
        hidden_description: 'IMEI 354678901234567, cracked screen protector',
      });

      await ctx.ports.workflow.recordCustody({
        item_id: phoneItem.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      const res = await request(app)
        .post(`/items/${phoneItem.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(200);
      expect(res.body.item.risk_level).toBe('HIGH');
    });

    it('rejects attempt to downgrade HIGH-risk item to LOW (400 CANNOT_DOWNGRADE_HIGH_RISK)', async () => {
      const item = await createTestItem({
        category: 'wallet',
        public_description: 'Black leather wallet with cards',
        hidden_description: 'Driver license inside',
      });

      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ risk_level: 'LOW' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_DOWNGRADE_HIGH_RISK');
    });

    it('allows security officer to manually escalate LOW-risk item to HIGH with 72h period', async () => {
      const item = await createTestItem({
        category: 'umbrella',
        public_description: 'Black folding umbrella',
        hidden_description: 'Contains antique silver handle with high value',
      });

      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      const beforeVerify = Date.now();
      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ risk_level: 'HIGH' });

      expect(res.status).toBe(200);
      expect(res.body.item.risk_level).toBe('HIGH');

      const dbRow = await ctx.ports.core.getItem(item.id);
      expect(dbRow.risk_level).toBe('HIGH');
      const waitingDate = new Date(dbRow.waiting_until).getTime();
      expect(waitingDate).toBeGreaterThan(beforeVerify + 71 * 3600 * 1000);
    });

    it('correctly classifies watches as MEDIUM risk with 48-hour waiting period', async () => {
      const item = await createTestItem({
        category: 'watches',
        public_description: 'Seiko 5 automatic watch with steel bracelet',
        hidden_description: 'Engraving on back case: Class of 2024',
      });

      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      const beforeVerify = Date.now();
      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(200);
      expect(res.body.item.risk_level).toBe('MEDIUM');

      const dbRow = await ctx.ports.core.getItem(item.id);
      expect(dbRow.risk_level).toBe('MEDIUM');
      const waitingDate = new Date(dbRow.waiting_until).getTime();
      expect(waitingDate).toBeGreaterThan(beforeVerify + 47 * 3600 * 1000);
      expect(waitingDate).toBeLessThan(beforeVerify + 49 * 3600 * 1000);
    });

    it('correctly verifies LOW risk item with 24-hour waiting period', async () => {
      const item = await createTestItem({
        category: 'textbook',
        public_description: 'Calculus Early Transcendentals',
        hidden_description: 'Name written on page 10',
      });

      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      const beforeVerify = Date.now();
      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(200);
      expect(res.body.item.risk_level).toBe('LOW');

      const dbRow = await ctx.ports.core.getItem(item.id);
      expect(dbRow.risk_level).toBe('LOW');
      const waitingDate = new Date(dbRow.waiting_until).getTime();
      expect(waitingDate).toBeGreaterThan(beforeVerify + 23 * 3600 * 1000);
      expect(waitingDate).toBeLessThan(beforeVerify + 25 * 3600 * 1000);
    });
  });

  describe('5. Public/Private Data Projections and Privacy Invariants', () => {
    it('verify response NEVER leaks hidden_description, hidden_attributes, or finder_id', async () => {
      const item = await createTestItem({
        category: 'water bottle',
        public_description: 'Stainless steel Hydro Flask 32oz',
        hidden_description: 'SECRET_CANARY_INTERNAL_ENGRAVING_12345',
        hidden_attributes: { secret_engraving: 'SECRET_CANARY_INTERNAL_ENGRAVING_12345' },
      });

      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      const res = await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(200);
      expect(res.body.item.hidden_description).toBeUndefined();
      expect(res.body.item.hidden_attributes).toBeUndefined();
      expect(res.body.item.finder_id).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('SECRET_CANARY_INTERNAL_ENGRAVING_12345');
    });

    it('verified item in WAITING_PERIOD remains inaccessible to public and students', async () => {
      const item = await createTestItem();

      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      // Unauthenticated GET
      const pubRes = await request(app).get(`/items/${item.id}`);
      expect(pubRes.status).toBe(404);

      // Student GET
      const studentRes = await request(app)
        .get(`/items/${item.id}`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(studentRes.status).toBe(404);

      // Public list excludes WAITING_PERIOD items
      const listRes = await request(app).get('/items');
      const found = listRes.body.items.find((i: any) => i.id === item.id);
      expect(found).toBeUndefined();
    });
  });

  describe('6. Concurrency and Race Condition Safety', () => {
    it('prevents concurrent verification races: exactly one request succeeds, others are rejected', async () => {
      const item = await createTestItem();

      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      // Fire 2 simultaneous verification requests
      const [res1, res2] = await Promise.all([
        request(app).post(`/items/${item.id}/verify`).set('Authorization', `Bearer ${securityToken}`),
        request(app).post(`/items/${item.id}/verify`).set('Authorization', `Bearer ${adminToken}`),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 400]);

      const errorRes = res1.status === 400 ? res1 : res2;
      expect(errorRes.body.error.code).toBe('ALREADY_VERIFIED');

      // Verify DB record is consistently in WAITING_PERIOD and security_verified=true
      const dbRow = await ctx.ports.core.getItem(item.id);
      expect(dbRow.security_verified).toBe(true);
      expect(dbRow.status).toBe('WAITING_PERIOD');
    });
  });

  describe('7. Item Modification Authorization Controls', () => {
    it('rejects unauthorized users from updating items via PATCH /items/:id (403)', async () => {
      const item = await createTestItem();

      const res = await request(app)
        .patch(`/items/${item.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ public_description: 'Tampered description by student' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_RESOURCE');
    });

    it('rejects finders from changing item status via PATCH /items/:id (403)', async () => {
      const item = await createTestItem();

      const res = await request(app)
        .patch(`/items/${item.id}`)
        .set('Authorization', `Bearer ${finderToken}`)
        .send({ status: 'OPEN_FOR_CLAIMS' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('allows finder to update public description before verification', async () => {
      const item = await createTestItem();

      const res = await request(app)
        .patch(`/items/${item.id}`)
        .set('Authorization', `Bearer ${finderToken}`)
        .send({ public_description: 'Updated blue spiral notebook with sticker' });

      expect(res.status).toBe(200);
      expect(res.body.item.public_description).toBe('Updated blue spiral notebook with sticker');
    });

    it('rejects finder from modifying item after it has been verified (400 ITEM_LOCKED)', async () => {
      const item = await createTestItem();

      await ctx.ports.workflow.recordCustody({
        item_id: item.id,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      await request(app)
        .post(`/items/${item.id}/verify`)
        .set('Authorization', `Bearer ${securityToken}`);

      const res = await request(app)
        .patch(`/items/${item.id}`)
        .set('Authorization', `Bearer ${finderToken}`)
        .send({ public_description: 'Attempting to change after verification' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ITEM_LOCKED');
    });

    it('rejects STUDENT from deleting an item via DELETE /items/:id (403 FORBIDDEN_ROLE)', async () => {
      const item = await createTestItem();

      const res = await request(app)
        .delete(`/items/${item.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects FINDER from deleting an item via DELETE /items/:id (403 FORBIDDEN_ROLE)', async () => {
      const item = await createTestItem();

      const res = await request(app)
        .delete(`/items/${item.id}`)
        .set('Authorization', `Bearer ${finderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('returns 404 ITEM_NOT_FOUND when deleting nonexistent item', async () => {
      const res = await request(app)
        .delete('/items/item_ghost_nonexistent_xyz')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ITEM_NOT_FOUND');
    });

    it('allows SECURITY officer to delete an item', async () => {
      const item = await createTestItem();

      const res = await request(app)
        .delete(`/items/${item.id}`)
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify item no longer exists
      const checkRes = await request(app)
        .get(`/items/${item.id}`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(checkRes.status).toBe(404);
    });
  });
});
