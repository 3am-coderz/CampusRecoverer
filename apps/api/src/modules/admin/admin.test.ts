import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';

describe('Member 4: Admin Dashboard API Tests (Block 4)', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  let adminToken: string;
  let adminId: string;
  let securityToken: string;
  let securityId: string;
  let studentToken: string;
  let studentId: string;
  let finderToken: string;
  let finderId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;

    // 1. Register ADMIN
    const adminRes = await request(app).post('/auth/register').send({
      email: 'admin_dashboard@campus.edu',
      password: 'password123',
      name: 'System Administrator',
      role: 'ADMIN',
    });
    expect(adminRes.status).toBe(201);
    adminToken = adminRes.body.token;
    adminId = adminRes.body.user.id;

    // 2. Register SECURITY
    const secRes = await request(app).post('/auth/register').send({
      email: 'security_dashboard@campus.edu',
      password: 'password123',
      name: 'Campus Guard',
      role: 'SECURITY',
    });
    expect(secRes.status).toBe(201);
    securityToken = secRes.body.token;
    securityId = secRes.body.user.id;

    // 3. Register STUDENT
    const stuRes = await request(app).post('/auth/register').send({
      email: 'student_dashboard@campus.edu',
      password: 'password123',
      name: 'Student Sarah',
      role: 'STUDENT',
    });
    expect(stuRes.status).toBe(201);
    studentToken = stuRes.body.token;
    studentId = stuRes.body.user.id;

    // 4. Register FINDER
    const findRes = await request(app).post('/auth/register').send({
      email: 'finder_dashboard@campus.edu',
      password: 'password123',
      name: 'Finder Fred',
      role: 'FINDER',
    });
    expect(findRes.status).toBe(201);
    finderToken = findRes.body.token;
    finderId = findRes.body.user.id;

    // 5. Seed items for dashboard and listing tests
    await db.query(
      `INSERT INTO items (
        id, category, public_description, hidden_description, hidden_attributes,
        found_location_public, found_date, status, risk_level, security_verified,
        finder_id, created_at
      ) VALUES
      ('item_dash_1', 'electronics', 'MacBook Air M2', 'Silver with apple sticker', '{"serial": "C02XYZ123"}', 'Library 3F', CURRENT_TIMESTAMP, 'OPEN_FOR_CLAIMS', 'HIGH', TRUE, $1, CURRENT_TIMESTAMP),
      ('item_dash_2', 'clothing', 'Black Columbia jacket', 'Size M with red zip', '{"brand": "Columbia"}', 'Student Center', CURRENT_TIMESTAMP, 'PENDING_HANDOVER', 'LOW', FALSE, $1, CURRENT_TIMESTAMP),
      ('item_dash_3', 'wallets', 'Leather bifold wallet', 'Contains student ID and cards', '{"color": "brown"}', 'Cafeteria', CURRENT_TIMESTAMP, 'UNDER_REVIEW', 'HIGH', TRUE, $1, CURRENT_TIMESTAMP),
      ('item_dash_4', 'keys', 'Keychain with dorm key', 'Blue carabiner', '{}', 'Gym Lockers', CURRENT_TIMESTAMP, 'COLLECTED', 'LOW', TRUE, $1, CURRENT_TIMESTAMP)
      `,
      [finderId],
    );

    // 6. Seed claims
    await db.query(
      `INSERT INTO claims (
        id, item_id, claimant_id, description, claimed_attributes,
        lost_date, lost_location, structured_score, semantic_score, final_score,
        confidence_label, status, created_at
      ) VALUES
      ('claim_dash_1', 'item_dash_1', $1, 'My lost MacBook Air', '{"serial": "C02XYZ123"}', CURRENT_TIMESTAMP, 'Library 3F', 95, 95, 95, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP),
      ('claim_dash_2', 'item_dash_3', $1, 'Lost my brown wallet', '{"color": "brown"}', CURRENT_TIMESTAMP, 'Cafeteria', 80, 75, 78, 'MEDIUM', 'SUBMITTED', CURRENT_TIMESTAMP),
      ('claim_dash_3', 'item_dash_4', $1, 'Dorm keys with carabiner', '{}', CURRENT_TIMESTAMP, 'Gym', 40, 30, 35, 'LOW', 'REJECTED', CURRENT_TIMESTAMP)
      `,
      [studentId],
    );

    // 7. Seed handover
    await db.query(
      `INSERT INTO handovers (
        id, item_id, claim_id, claimant_id, security_id, qr_token_hash, otp_hash,
        issued_at, expires_at, collected_at, attempts, locked
      ) VALUES
      ('ho_dash_1', 'item_dash_4', 'claim_dash_3', $1, $2, 'hash_qr_dummy', 'hash_otp_dummy',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP, 1, FALSE)
      `,
      [studentId, securityId],
    );
  });

  describe('A. Administrative Authorization Controls', () => {
    it('rejects unauthenticated requests to /admin/dashboard with 401', async () => {
      const res = await request(app).get('/admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('rejects STUDENT requests to /admin/dashboard with 403', async () => {
      const res = await request(app)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects FINDER requests to /admin/dashboard with 403', async () => {
      const res = await request(app)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${finderToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects SECURITY requests to /admin/dashboard with 403 (admin-only)', async () => {
      const res = await request(app)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${securityToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('allows ADMIN to access /admin/dashboard with 200', async () => {
      const res = await request(app)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('rejects non-ADMIN users from /admin/items, /admin/claims, and /admin/users', async () => {
      const itemsRes = await request(app)
        .get('/admin/items')
        .set('Authorization', `Bearer ${securityToken}`);
      expect(itemsRes.status).toBe(403);

      const claimsRes = await request(app)
        .get('/admin/claims')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(claimsRes.status).toBe(403);

      const usersRes = await request(app)
        .get('/admin/users')
        .set('Authorization', `Bearer ${finderToken}`);
      expect(usersRes.status).toBe(403);
    });
  });

  describe('B. Dashboard Summary Endpoint (GET /admin/dashboard)', () => {
    it('returns accurate summary counts and grouped statistics', async () => {
      const res = await request(app)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      const data = res.body;

      // 1. Items metrics
      expect(data).toHaveProperty('items');
      expect(data.items.total_reported).toBeGreaterThanOrEqual(4);
      expect(data.items.total_found).toBe(data.items.total_reported);
      expect(data.items.awaiting_verification).toBeGreaterThanOrEqual(1);
      expect(data.items.available_for_claims).toBeGreaterThanOrEqual(1);
      expect(data.items.by_status).toBeDefined();
      expect(data.items.by_status.OPEN_FOR_CLAIMS).toBeGreaterThanOrEqual(1);
      expect(data.items.by_status.PENDING_HANDOVER).toBeGreaterThanOrEqual(1);
      expect(data.items.by_risk_level.HIGH).toBeGreaterThanOrEqual(2);
      expect(data.items.by_risk_level.LOW).toBeGreaterThanOrEqual(2);

      // 2. Claims metrics
      expect(data).toHaveProperty('claims');
      expect(data.claims.total).toBeGreaterThanOrEqual(3);
      expect(data.claims.total_lost).toBe(data.claims.total);
      expect(data.claims.pending).toBeGreaterThanOrEqual(1);
      expect(data.claims.approved).toBeGreaterThanOrEqual(1);
      expect(data.claims.rejected).toBeGreaterThanOrEqual(1);
      expect(data.claims.by_status.APPROVED).toBeGreaterThanOrEqual(1);
      expect(data.claims.by_status.SUBMITTED).toBeGreaterThanOrEqual(1);

      // 3. Handover metrics
      expect(data).toHaveProperty('handovers');
      expect(data.handovers.total).toBeGreaterThanOrEqual(1);
      expect(data.handovers.completed).toBeGreaterThanOrEqual(1);
      expect(data.handovers.locked).toBe(0);

      // 4. Users metrics
      expect(data).toHaveProperty('users');
      expect(data.users.total).toBeGreaterThanOrEqual(4);
      expect(data.users.by_role.ADMIN).toBeGreaterThanOrEqual(1);
      expect(data.users.by_role.SECURITY).toBeGreaterThanOrEqual(1);
      expect(data.users.by_role.STUDENT).toBeGreaterThanOrEqual(1);
      expect(data.users.by_role.FINDER).toBeGreaterThanOrEqual(1);

      // 5. Recent activity
      expect(data).toHaveProperty('recent_activity');
      expect(data.recent_activity.items_last_24h).toBeGreaterThanOrEqual(4);
      expect(data.recent_activity.claims_last_24h).toBeGreaterThanOrEqual(3);
      expect(typeof data.recent_activity.audit_events_last_24h).toBe('number');
    });

    it('correctly handles empty tables without crashing or producing NaN', async () => {
      const emptyMockDb = {
        query: async () => ({ rows: [], rowCount: 0 }),
        getClient: async () => ({} as any),
        transaction: async () => ({} as any),
        close: async () => {},
        isMemory: true,
      } as unknown as DatabaseContext;

      const { AdminService } = await import('./services/admin-service.js');
      const adminSvc = new AdminService(emptyMockDb);
      const summary = await adminSvc.getDashboardSummary();

      expect(summary.items.total_reported).toBe(0);
      expect(summary.items.total_found).toBe(0);
      expect(summary.items.awaiting_verification).toBe(0);
      expect(summary.items.available_for_claims).toBe(0);
      expect(summary.items.by_status).toEqual({});
      expect(summary.claims.total).toBe(0);
      expect(summary.claims.pending).toBe(0);
      expect(summary.claims.approved).toBe(0);
      expect(summary.claims.rejected).toBe(0);
      expect(summary.claims.by_status).toEqual({});
      expect(summary.handovers.total).toBe(0);
      expect(summary.handovers.completed).toBe(0);
      expect(summary.users.total).toBe(0);
      expect(summary.users.by_role).toEqual({});
      expect(summary.recent_activity.items_last_24h).toBe(0);
      expect(summary.recent_activity.claims_last_24h).toBe(0);
      expect(summary.recent_activity.audit_events_last_24h).toBe(0);
    });
  });

  describe('C. Administrative Item Listing (GET /admin/items)', () => {
    it('returns default bounded pagination (limit 50, offset 0)', async () => {
      const res = await request(app)
        .get('/admin/items')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination.limit).toBe(50);
      expect(res.body.pagination.offset).toBe(0);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(4);
    });

    it('supports custom limit and offset', async () => {
      const res = await request(app)
        .get('/admin/items?limit=2&offset=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.offset).toBe(1);
      expect(res.body.items.length).toBe(2);
    });

    it('enforces maximum limit of 100 and rejects invalid pagination', async () => {
      const okRes = await request(app)
        .get('/admin/items?limit=100')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(okRes.status).toBe(200);

      const overRes = await request(app)
        .get('/admin/items?limit=101')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(overRes.status).toBe(400);
      expect(overRes.body.error.code).toBe('INVALID_PAGINATION');

      const negRes = await request(app)
        .get('/admin/items?offset=-1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(negRes.status).toBe(400);

      const nanRes = await request(app)
        .get('/admin/items?limit=invalid')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(nanRes.status).toBe(400);
    });

    it('filters items by status and risk level', async () => {
      const statusRes = await request(app)
        .get('/admin/items?status=OPEN_FOR_CLAIMS')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.items.length).toBeGreaterThan(0);
      expect(statusRes.body.items.every((i: any) => i.status === 'OPEN_FOR_CLAIMS')).toBe(true);

      const riskRes = await request(app)
        .get('/admin/items?risk_level=HIGH')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(riskRes.status).toBe(200);
      expect(riskRes.body.items.length).toBeGreaterThan(0);
      expect(riskRes.body.items.every((i: any) => i.risk_level === 'HIGH')).toBe(true);
    });

    it('rejects invalid status and risk level filters with 400', async () => {
      const badStatus = await request(app)
        .get('/admin/items?status=NONEXISTENT_STATUS')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(badStatus.status).toBe(400);
      expect(badStatus.body.error.code).toBe('INVALID_FILTER');

      const badRisk = await request(app)
        .get('/admin/items?risk_level=CRITICAL')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(badRisk.status).toBe(400);
      expect(badRisk.body.error.code).toBe('INVALID_FILTER');
    });

    it('searches items by keyword across description, category, and location', async () => {
      const res = await request(app)
        .get('/admin/items?search=MacBook')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].public_description).toContain('MacBook');
    });

    it('supports allowlisted sorting and protects against SQL injection in sort parameters', async () => {
      const sortRes = await request(app)
        .get('/admin/items?sort_by=category&sort_order=ASC')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(sortRes.status).toBe(200);

      // SQL injection attempt in sort_by falls back safely to default allowlist
      const sqliRes = await request(app)
        .get('/admin/items?sort_by=created_at;DROP+TABLE+items;--')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(sqliRes.status).toBe(200);
    });

    it('strictly excludes hidden_description and hidden_attributes from response', async () => {
      const res = await request(app)
        .get('/admin/items?search=MacBook')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);

      const item = res.body.items[0];
      expect(item).not.toHaveProperty('hidden_description');
      expect(item).not.toHaveProperty('hidden_attributes');
      expect(item.public_description).toBe('MacBook Air M2');

      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('Silver with apple sticker');
      expect(raw).not.toContain('C02XYZ123');
    });
  });

  describe('D. Administrative Claim Listing (GET /admin/claims)', () => {
    it('returns default bounded pagination and claim details', async () => {
      const res = await request(app)
        .get('/admin/claims')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('claims');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination.limit).toBe(50);
      expect(res.body.pagination.offset).toBe(0);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
    });

    it('filters claims by status and item_id', async () => {
      const statusRes = await request(app)
        .get('/admin/claims?status=APPROVED')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.claims.length).toBe(1);
      expect(statusRes.body.claims[0].status).toBe('APPROVED');

      const itemRes = await request(app)
        .get('/admin/claims?item_id=item_dash_1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(itemRes.status).toBe(200);
      expect(itemRes.body.claims.length).toBe(1);
      expect(itemRes.body.claims[0].item_id).toBe('item_dash_1');
    });

    it('rejects invalid claim status with 400 INVALID_FILTER', async () => {
      const res = await request(app)
        .get('/admin/claims?status=BOGUS_STATUS')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILTER');
    });

    it('filters claims by date range and validates timestamps', async () => {
      const past = new Date(Date.now() - 3600000).toISOString();
      const future = new Date(Date.now() + 3600000).toISOString();

      const okRes = await request(app)
        .get(`/admin/claims?start_date=${encodeURIComponent(past)}&end_date=${encodeURIComponent(future)}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(okRes.status).toBe(200);
      expect(okRes.body.claims.length).toBeGreaterThanOrEqual(1);

      const invalidDateRes = await request(app)
        .get('/admin/claims?start_date=not-a-date')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(invalidDateRes.status).toBe(400);
      expect(invalidDateRes.body.error.code).toBe('INVALID_DATE');

      const rangeRes = await request(app)
        .get(`/admin/claims?start_date=${encodeURIComponent(future)}&end_date=${encodeURIComponent(past)}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(rangeRes.status).toBe(400);
      expect(rangeRes.body.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('does not leak user credentials, password hashes, or session tokens', async () => {
      const res = await request(app)
        .get('/admin/claims')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('password_hash');
      expect(raw).not.toContain('jwt');
      expect(raw).not.toContain('qr_token_hash');
    });
  });

  describe('E. Administrative User Overview (GET /admin/users)', () => {
    it('returns paginated users list', async () => {
      const res = await request(app)
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(4);
    });

    it('filters users by role', async () => {
      const res = await request(app)
        .get('/admin/users?role=SECURITY')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.users.length).toBeGreaterThanOrEqual(1);
      expect(res.body.users.every((u: any) => u.role === 'SECURITY')).toBe(true);
    });

    it('rejects invalid role filter with 400 INVALID_FILTER', async () => {
      const res = await request(app)
        .get('/admin/users?role=SUPERUSER')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILTER');
    });

    it('searches users by email or name', async () => {
      const res = await request(app)
        .get('/admin/users?search=Sarah')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.users.length).toBe(1);
      expect(res.body.users[0].name).toContain('Sarah');
    });

    it('never exposes password_hash or credentials in user overview', async () => {
      const res = await request(app)
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      for (const u of res.body.users) {
        expect(u).not.toHaveProperty('password_hash');
        expect(u).not.toHaveProperty('password');
        expect(u).toHaveProperty('id');
        expect(u).toHaveProperty('email');
        expect(u).toHaveProperty('name');
        expect(u).toHaveProperty('role');
        expect(u).toHaveProperty('created_at');
      }

      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('password_hash');
      expect(raw).not.toContain('$2a$');
      expect(raw).not.toContain('$2b$');
    });
  });

  describe('F. Audit Log Access & Integration', () => {
    it('allows ADMIN to access the existing GET /audit endpoint', async () => {
      const res = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
      expect(res.body).toHaveProperty('pagination');
    });

    it('preserves existing SECURITY officer access to GET /audit', async () => {
      const res = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${securityToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
    });

    it('denies STUDENT and FINDER from accessing GET /audit', async () => {
      const stuRes = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(stuRes.status).toBe(403);

      const findRes = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${finderToken}`);
      expect(findRes.status).toBe(403);
    });
  });
});
