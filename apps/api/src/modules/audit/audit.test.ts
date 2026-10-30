import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';
import { AuditService, sanitizeAuditMetadata } from './services/audit-service.js';

describe('Member 4: Persistent Audit Logging Tests (Block 3)', () => {
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
      email: 'audit_admin@campus.edu',
      password: 'password123',
      name: 'Audit Administrator',
      role: 'ADMIN',
    });
    expect(adminRes.status).toBe(201);
    adminToken = adminRes.body.token;
    adminId = adminRes.body.user.id;

    // 2. Register SECURITY
    const secRes = await request(app).post('/auth/register').send({
      email: 'audit_security@campus.edu',
      password: 'password123',
      name: 'Security Officer Pete',
      role: 'SECURITY',
    });
    expect(secRes.status).toBe(201);
    securityToken = secRes.body.token;
    securityId = secRes.body.user.id;

    // 3. Register STUDENT
    const stuRes = await request(app).post('/auth/register').send({
      email: 'audit_student@campus.edu',
      password: 'password123',
      name: 'Student Sam',
      role: 'STUDENT',
    });
    expect(stuRes.status).toBe(201);
    studentToken = stuRes.body.token;
    studentId = stuRes.body.user.id;

    // 4. Register FINDER
    const findRes = await request(app).post('/auth/register').send({
      email: 'audit_finder@campus.edu',
      password: 'password123',
      name: 'Finder Fiona',
      role: 'FINDER',
    });
    expect(findRes.status).toBe(201);
    finderToken = findRes.body.token;
    finderId = findRes.body.user.id;
  });

  describe('A. Persistent Storage', () => {
    it('stores a valid audit event in the audit_logs table', async () => {
      const auditSvc = new AuditService(db);
      await auditSvc.log({
        actor_id: securityId,
        action: 'ITEM_VERIFIED',
        item_id: 'item_test_storage_1',
        metadata: { note: 'Verified successfully' },
      });

      const res = await db.query(
        'SELECT * FROM audit_logs WHERE item_id = $1',
        ['item_test_storage_1'],
      );
      expect(res.rows.length).toBe(1);
      const row = res.rows[0];
      expect(row.actor_id).toBe(securityId);
      expect(row.action).toBe('ITEM_VERIFIED');
      expect(row.entity_type).toBe('item');
      expect(row.entity_id).toBe('item_test_storage_1');
      expect(row.item_id).toBe('item_test_storage_1');
      expect(row.claim_id).toBeNull();

      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      expect(meta.note).toBe('Verified successfully');
      expect(row.created_at).toBeDefined();
    });

    it('correctly retrieves stored events via queryLogs with intact fields', async () => {
      const auditSvc = new AuditService(db);
      await auditSvc.log({
        actor_id: 'system:matching',
        action: 'CLAIM_SCORED',
        item_id: 'item_test_storage_2',
        claim_id: 'claim_test_storage_2',
        metadata: { score: 95.5, confidence: 'HIGH' },
      });

      const result = await auditSvc.queryLogs({ claim_id: 'claim_test_storage_2' });
      expect(result.events.length).toBe(1);
      const ev = result.events[0];
      expect(ev.actor_id).toBe('system:matching');
      expect(ev.action).toBe('CLAIM_SCORED');
      expect(ev.event_type).toBe('CLAIM_SCORED');
      expect(ev.entity_type).toBe('claim');
      expect(ev.entity_id).toBe('claim_test_storage_2');
      expect(ev.item_id).toBe('item_test_storage_2');
      expect(ev.claim_id).toBe('claim_test_storage_2');
      expect(ev.metadata.score).toBe(95.5);
      expect(ev.metadata.confidence).toBe('HIGH');
    });

    it('handles nullable and optional fields cleanly', async () => {
      const auditSvc = new AuditService(db);
      await auditSvc.log({
        actor_id: adminId,
        action: 'DISPOSITION_DECIDED',
      });

      const result = await auditSvc.queryLogs({ action: 'DISPOSITION_DECIDED' });
      expect(result.events.length).toBeGreaterThanOrEqual(1);
      const ev = result.events[0];
      expect(ev.item_id).toBeNull();
      expect(ev.claim_id).toBeNull();
      expect(ev.entity_type).toBeNull();
      expect(ev.entity_id).toBeNull();
      expect(ev.metadata).toEqual({});
    });

    it('verifies audit schema migration table and indexes exist', async () => {
      const tableCheck = await db.query(
        'SELECT 1 FROM audit_logs LIMIT 1',
      );
      expect(tableCheck).toBeDefined();

      const migCheck = await db.query(
        "SELECT * FROM schema_migrations WHERE module = 'audit'",
      );
      expect(migCheck.rows.length).toBeGreaterThanOrEqual(1);
      expect(migCheck.rows[0].filename).toBe('001_audit_schema.sql');
    });

    it('fails closed on database error without silently swallowing', async () => {
      const badDb = {
        query: async () => {
          throw new Error('Database connection failed');
        },
        close: async () => {},
        isMemory: true,
      } as unknown as DatabaseContext;

      const failingAudit = new AuditService(badDb);
      await expect(
        failingAudit.log({
          actor_id: securityId,
          action: 'ITEM_VERIFIED',
        }),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('B. Authorization and Access Control', () => {
    it('rejects unauthenticated requests to GET /audit with 401', async () => {
      const res = await request(app).get('/audit');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('rejects STUDENT requests to GET /audit with 403', async () => {
      const res = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects FINDER requests to GET /audit with 403', async () => {
      const res = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${finderToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('allows SECURITY officer to read GET /audit with 200', async () => {
      const res = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${securityToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.events)).toBe(true);
    });

    it('allows ADMIN to read GET /audit with 200', async () => {
      const res = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.events)).toBe(true);
    });

    it('prevents non-GET modification methods on /audit (append-only API)', async () => {
      const postRes = await request(app)
        .post('/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'MALICIOUS_LOG' });
      expect([404, 405]).toContain(postRes.status);

      const deleteRes = await request(app)
        .delete('/audit/any-id')
        .set('Authorization', `Bearer ${adminToken}`);
      expect([404, 405]).toContain(deleteRes.status);

      const patchRes = await request(app)
        .patch('/audit/any-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'TAMPERED' });
      expect([404, 405]).toContain(patchRes.status);
    });
  });

  describe('C. Pagination and Filters', () => {
    beforeAll(async () => {
      // Seed a set of distinctive audit events for filtering tests
      const auditSvc = new AuditService(db);
      for (let i = 1; i <= 15; i++) {
        await auditSvc.log({
          actor_id: i % 2 === 0 ? securityId : adminId,
          action: i % 3 === 0 ? 'ITEM_REPORTED' : 'ITEM_VERIFIED',
          item_id: `filter_test_item_${i}`,
          claim_id: i > 10 ? `filter_test_claim_${i}` : undefined,
          metadata: { seq: i },
        });
      }
    });

    it('returns default bounded pagination (limit 50, offset 0)', async () => {
      const res = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(50);
      expect(res.body.pagination.offset).toBe(0);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(15);
      expect(res.body.events.length).toBeLessThanOrEqual(50);
    });

    it('respects custom limit and offset', async () => {
      const res = await request(app)
        .get('/audit?limit=5&offset=2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.pagination.offset).toBe(2);
      expect(res.body.events.length).toBe(5);
    });

    it('enforces maximum page size of 100', async () => {
      const okRes = await request(app)
        .get('/audit?limit=100')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(okRes.status).toBe(200);
      expect(okRes.body.pagination.limit).toBe(100);

      const overRes = await request(app)
        .get('/audit?limit=101')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(overRes.status).toBe(400);
      expect(overRes.body.error.code).toBe('INVALID_PAGINATION');
    });

    it('rejects invalid limit values (negative, zero, non-integer)', async () => {
      const zeroRes = await request(app)
        .get('/audit?limit=0')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(zeroRes.status).toBe(400);

      const negRes = await request(app)
        .get('/audit?limit=-10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(negRes.status).toBe(400);

      const nanRes = await request(app)
        .get('/audit?limit=abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(nanRes.status).toBe(400);
    });

    it('rejects invalid offset values (negative, non-integer)', async () => {
      const negRes = await request(app)
        .get('/audit?offset=-1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(negRes.status).toBe(400);
      expect(negRes.body.error.code).toBe('INVALID_PAGINATION');

      const nanRes = await request(app)
        .get('/audit?offset=xyz')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(nanRes.status).toBe(400);
    });

    it('filters by action / event_type', async () => {
      const res = await request(app)
        .get('/audit?action=ITEM_REPORTED')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeGreaterThan(0);
      expect(res.body.events.every((e: any) => e.action === 'ITEM_REPORTED')).toBe(true);
    });

    it('filters by actor_id', async () => {
      const res = await request(app)
        .get(`/audit?actor_id=${securityId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeGreaterThan(0);
      expect(res.body.events.every((e: any) => e.actor_id === securityId)).toBe(true);
    });

    it('filters by entity_type and entity_id', async () => {
      const res = await request(app)
        .get(`/audit?entity_type=item&item_id=filter_test_item_3`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].item_id).toBe('filter_test_item_3');
      expect(res.body.events[0].entity_type).toBe('item');
    });

    it('filters by date range', async () => {
      const past = new Date(Date.now() - 3600000).toISOString();
      const future = new Date(Date.now() + 3600000).toISOString();

      const res = await request(app)
        .get(`/audit?start_time=${encodeURIComponent(past)}&end_time=${encodeURIComponent(future)}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeGreaterThan(0);
    });

    it('rejects invalid date strings with 400 INVALID_DATE', async () => {
      const res = await request(app)
        .get('/audit?start_time=not-a-valid-date')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DATE');
    });

    it('rejects invalid date range (start > end) with 400 INVALID_DATE_RANGE', async () => {
      const start = '2026-10-15T00:00:00.000Z';
      const end = '2026-10-10T00:00:00.000Z';
      const res = await request(app)
        .get(`/audit?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('safely handles SQL injection attempts in filter parameters', async () => {
      const sqli = "ITEM_REPORTED' OR 1=1 --";
      const res = await request(app)
        .get(`/audit?action=${encodeURIComponent(sqli)}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(0);
    });
  });

  describe('D. Sensitive Data Protection', () => {
    it('redacts raw QR tokens and OTPs from audit metadata', async () => {
      const rawSecret = 'raw_qr_token_abc_123';
      const rawOtp = '876543';

      await ctx.ports.audit.log({
        actor_id: securityId,
        action: 'QR_VERIFIED',
        item_id: 'item_sensitive_test_1',
        metadata: {
          qr_token: rawSecret,
          otp: rawOtp,
          id_verified: true,
        },
      });

      const res = await request(app)
        .get('/audit?item_id=item_sensitive_test_1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(1);

      const ev = res.body.events[0];
      expect(ev.metadata.qr_token).toBe('[REDACTED]');
      expect(ev.metadata.otp).toBe('[REDACTED]');
      expect(ev.metadata.id_verified).toBe(true);

      // Verify raw values never appear in the payload or response
      const rawBody = JSON.stringify(res.body);
      expect(rawBody).not.toContain(rawSecret);
      expect(rawBody).not.toContain(rawOtp);
    });

    it('redacts passwords, password hashes, and secrets', async () => {
      const secretPassword = 'MySecretPassword!';
      const secretHash = '$2a$10$abcdefghijklmnopqrstuvwxyz123456';
      const secretKey = 'super_secret_jwt_key';

      await ctx.ports.audit.log({
        actor_id: adminId,
        action: 'ITEM_VERIFIED',
        item_id: 'item_sensitive_test_2',
        metadata: {
          password: secretPassword,
          password_hash: secretHash,
          jwt_secret: secretKey,
          safe_fact: 'Verification passed',
        },
      });

      const res = await request(app)
        .get('/audit?item_id=item_sensitive_test_2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const ev = res.body.events[0];

      expect(ev.metadata.password).toBe('[REDACTED]');
      expect(ev.metadata.password_hash).toBe('[REDACTED]');
      expect(ev.metadata.jwt_secret).toBe('[REDACTED]');
      expect(ev.metadata.safe_fact).toBe('Verification passed');

      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(secretPassword);
      expect(raw).not.toContain(secretHash);
      expect(raw).not.toContain(secretKey);
    });

    it('excludes hidden item descriptions and hidden attributes completely', async () => {
      await ctx.ports.audit.log({
        actor_id: securityId,
        action: 'ITEM_REPORTED',
        item_id: 'item_sensitive_test_3',
        metadata: {
          category: 'phone',
          hidden_description: 'Has serial number SN-9988-CONFIDENTIAL',
          hidden_attributes: { imei: '990000862471854' },
          public_info: 'Blue iPhone 13',
        },
      });

      const res = await request(app)
        .get('/audit?item_id=item_sensitive_test_3')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const ev = res.body.events[0];

      expect(ev.metadata).not.toHaveProperty('hidden_description');
      expect(ev.metadata).not.toHaveProperty('hidden_attributes');
      expect(ev.metadata.category).toBe('phone');
      expect(ev.metadata.public_info).toBe('Blue iPhone 13');

      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('SN-9988-CONFIDENTIAL');
      expect(raw).not.toContain('990000862471854');
    });

    it('redacts sensitive values within nested objects recursively', () => {
      const nested = {
        outer: {
          safe: 'hello',
          credentials: {
            auth_token: 'bearer-token-12345',
            otp_code: '654321',
          },
        },
      };

      const sanitized = sanitizeAuditMetadata(nested);
      expect(sanitized.outer.safe).toBe('hello');
      expect(sanitized.outer.credentials.auth_token).toBe('[REDACTED]');
      expect(sanitized.outer.credentials.otp_code).toBe('[REDACTED]');
    });
  });

  describe('E. Integration with Existing Operations', () => {
    it('records ITEM_REPORTED in audit_logs when POST /items is called', async () => {
      const res = await request(app)
        .post('/items')
        .set('Authorization', `Bearer ${finderToken}`)
        .send({
          category: 'books',
          public_description: 'Calculus textbook with blue cover',
          hidden_description: 'Name Tejas written on page 42',
          hidden_attributes: { edition: '8th' },
          found_location_public: 'Science Library 2nd Floor',
          found_date: new Date().toISOString(),
        });
      expect(res.status).toBe(201);
      const itemId = res.body.item.id;

      const auditRes = await request(app)
        .get(`/audit?action=ITEM_REPORTED&item_id=${itemId}`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.events.length).toBe(1);
      expect(auditRes.body.events[0].actor_id).toBe(finderId);
      expect(auditRes.body.events[0].item_id).toBe(itemId);
      expect(auditRes.body.events[0].metadata.category).toBe('books');
    });

    it('records ITEM_VERIFIED in audit_logs when POST /items/:id/verify is called', async () => {
      // 1. Create item in PENDING_HANDOVER
      const createRes = await request(app)
        .post('/items')
        .set('Authorization', `Bearer ${finderToken}`)
        .send({
          category: 'clothing',
          public_description: 'Navy blue campus hoodie',
          hidden_description: 'Size L with initials on tag',
          hidden_attributes: { size: 'L' },
          found_location_public: 'Student Center',
          found_date: new Date().toISOString(),
        });
      const itemId = createRes.body.item.id;

      // 2. Log physical custody receipt before verification
      await ctx.ports.workflow.recordCustody({
        item_id: itemId,
        event: 'RECEIVED_BY_SECURITY',
        actor_id: securityId,
      });

      // 3. Security verifies item
      const verifyRes = await request(app)
        .post(`/items/${itemId}/verify`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ risk_level: 'LOW' });
      expect(verifyRes.status).toBe(200);

      // 3. Confirm audit trail
      const auditRes = await request(app)
        .get(`/audit?action=ITEM_VERIFIED&item_id=${itemId}`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.events.length).toBe(1);
      expect(auditRes.body.events[0].actor_id).toBe(securityId);
      expect(auditRes.body.events[0].item_id).toBe(itemId);
      expect(auditRes.body.events[0].metadata.risk_level).toBe('LOW');
    });

    it('records CLAIM_CREATED and CLAIM_SCORED in audit_logs when POST /claims is called', async () => {
      // 1. Create and verify item so it is ready for claims
      const itemRes = await request(app)
        .post('/items')
        .set('Authorization', `Bearer ${finderToken}`)
        .send({
          category: 'stationery',
          public_description: 'Black titanium fountain pen',
          hidden_description: 'Engraved initials on clip',
          hidden_attributes: {},
          found_location_public: 'Room 301',
          found_date: new Date().toISOString(),
        });
      const itemId = itemRes.body.item.id;

      // Move directly to OPEN_FOR_CLAIMS in DB for claim test
      await db.query(
        "UPDATE items SET status = 'OPEN_FOR_CLAIMS', security_verified = TRUE WHERE id = $1",
        [itemId],
      );

      // 2. Submit claim
      const claimRes = await request(app)
        .post('/claims')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          item_id: itemId,
          description: 'My lost titanium fountain pen',
          claimed_attributes: {},
          lost_date: new Date().toISOString(),
          lost_location: 'Room 301',
        });
      expect(claimRes.status).toBe(201);
      const claimId = claimRes.body.claim.id;

      // 3. Verify CLAIM_CREATED and CLAIM_SCORED in audit trail
      const createdRes = await request(app)
        .get(`/audit?action=CLAIM_CREATED&claim_id=${claimId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(createdRes.status).toBe(200);
      expect(createdRes.body.events.length).toBe(1);
      expect(createdRes.body.events[0].actor_id).toBe(studentId);

      const scoredRes = await request(app)
        .get(`/audit?action=CLAIM_SCORED&claim_id=${claimId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(scoredRes.status).toBe(200);
      expect(scoredRes.body.events.length).toBe(1);
      expect(scoredRes.body.events[0].actor_id).toBe('system:matching');
    });

    it('records CLAIM_APPROVED in audit_logs when POST /claims/:id/approve is called', async () => {
      // Seed item & claim
      const itemId = 'item_audit_approve_test';
      const claimId = 'claim_audit_approve_test';

      await db.query(
        `INSERT INTO items (
          id, category, public_description, hidden_description, hidden_attributes,
          found_location_public, found_date, status, risk_level, security_verified,
          finder_id, created_at
        ) VALUES ($1, 'electronics', 'Apple iPad Mini', 'Silver with cracked corner', '{}', 'Lab 4', CURRENT_TIMESTAMP, 'OPEN_FOR_CLAIMS', 'HIGH', TRUE, $2, CURRENT_TIMESTAMP)`,
        [itemId, finderId],
      );

      await db.query(
        `INSERT INTO claims (
          id, item_id, claimant_id, description, claimed_attributes,
          lost_date, lost_location, structured_score, semantic_score, final_score,
          confidence_label, status, created_at
        ) VALUES ($1, $2, $3, 'Lost iPad Mini', '{}', CURRENT_TIMESTAMP, 'Lab 4', 90, 90, 90, 'HIGH', 'SCORED', CURRENT_TIMESTAMP)`,
        [claimId, itemId, studentId],
      );

      const approveRes = await request(app)
        .post(`/claims/${claimId}/approve`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(approveRes.status).toBe(200);

      const auditRes = await request(app)
        .get(`/audit?action=CLAIM_APPROVED&claim_id=${claimId}`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.events.length).toBe(1);
      expect(auditRes.body.events[0].actor_id).toBe(securityId);
      expect(auditRes.body.events[0].claim_id).toBe(claimId);
      expect(auditRes.body.events[0].item_id).toBe(itemId);
      expect(auditRes.body.events[0].metadata).toHaveProperty('handover_id');
    });

    it('records CLAIM_REJECTED in audit_logs when POST /claims/:id/reject is called', async () => {
      const itemId = 'item_audit_reject_test';
      const claimId = 'claim_audit_reject_test';

      await db.query(
        `INSERT INTO items (
          id, category, public_description, hidden_description, hidden_attributes,
          found_location_public, found_date, status, risk_level, security_verified,
          finder_id, created_at
        ) VALUES ($1, 'stationery', 'Notebook', 'Red spiral notebook', '{}', 'Library', CURRENT_TIMESTAMP, 'OPEN_FOR_CLAIMS', 'LOW', TRUE, $2, CURRENT_TIMESTAMP)`,
        [itemId, finderId],
      );

      await db.query(
        `INSERT INTO claims (
          id, item_id, claimant_id, description, claimed_attributes,
          lost_date, lost_location, structured_score, semantic_score, final_score,
          confidence_label, status, created_at
        ) VALUES ($1, $2, $3, 'Red notebook', '{}', CURRENT_TIMESTAMP, 'Library', 30, 30, 30, 'LOW', 'SCORED', CURRENT_TIMESTAMP)`,
        [claimId, itemId, studentId],
      );

      const rejectRes = await request(app)
        .post(`/claims/${claimId}/reject`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ reason: 'Description did not match item details' });
      expect(rejectRes.status).toBe(200);

      const auditRes = await request(app)
        .get(`/audit?action=CLAIM_REJECTED&claim_id=${claimId}`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.events.length).toBe(1);
      expect(auditRes.body.events[0].actor_id).toBe(securityId);
      expect(auditRes.body.events[0].metadata.reason).toBe('Description did not match item details');
    });

    it('does not emit audit events on failed operations', async () => {
      const invalidItemId = 'item_nonexistent_999';

      const verifyRes = await request(app)
        .post(`/items/${invalidItemId}/verify`)
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ risk_level: 'LOW' });
      expect(verifyRes.status).toBe(404);

      const auditRes = await request(app)
        .get(`/audit?item_id=${invalidItemId}`)
        .set('Authorization', `Bearer ${securityToken}`);
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.events.length).toBe(0);
    });
  });
});
