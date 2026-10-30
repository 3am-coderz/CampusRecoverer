import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../kernel/app.js';
import { DatabaseContext } from '../../kernel/db.js';

describe('Member 4: Auth & Notification Edge Cases & Security Tests', () => {
  let app: any;
  let ctx: any;
  let db: DatabaseContext;

  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const setup = await createApp({ forceMemoryDb: true });
    app = setup.app;
    ctx = setup.ctx;
    db = setup.ctx.db;

    const res1 = await request(app).post('/auth/register').send({
      email: 'user1_edge@campus.edu',
      password: 'password123',
      name: 'User One',
      role: 'STUDENT',
    });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    const res2 = await request(app).post('/auth/register').send({
      email: 'user2_edge@campus.edu',
      password: 'password123',
      name: 'User Two',
      role: 'STUDENT',
    });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;
  });

  afterAll(async () => {
    await db.close();
  });

  describe('1. Authentication Validation & Edge Cases', () => {
    it('rejects registration with invalid email format (400)', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'not-an-email',
        password: 'password123',
        name: 'Bad Email User',
      });
      expect(res.status).toBe(400);
    });

    it('rejects registration with short password (400)', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'shortpass@campus.edu',
        password: '123',
        name: 'Short Pass User',
      });
      expect(res.status).toBe(400);
    });

    it('rejects duplicate user registration with same email (400 EMAIL_TAKEN)', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'user1_edge@campus.edu',
        password: 'differentpassword',
        name: 'Duplicate User',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('rejects login with nonexistent email (401 INVALID_CREDENTIALS)', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'ghost_user@campus.edu',
        password: 'password123',
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects login with wrong password (401 INVALID_CREDENTIALS)', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'user1_edge@campus.edu',
        password: 'wrong_password_xyz',
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects /auth/me when unauthenticated (401 AUTH_REQUIRED)', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns user profile for valid /auth/me request', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${user1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user1Id);
      expect(res.body.user.email).toBe('user1_edge@campus.edu');
    });
  });

  describe('2. Notification Privacy & Access Controls', () => {
    let notif1Id: string;

    beforeAll(async () => {
      // Create a private notification for user1
      await ctx.ports.core.createNotification({
        user_id: user1Id,
        title: 'Confidential Alert',
        message: 'Your personal notification content',
      });

      const listRes = await request(app)
        .get('/notifications')
        .set('Authorization', `Bearer ${user1Token}`);
      expect(listRes.status).toBe(200);
      notif1Id = listRes.body.notifications[0].id;
    });

    it('rejects unauthenticated access to /notifications (401)', async () => {
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(401);
    });

    it('ensures user2 cannot see user1 notifications', async () => {
      const res = await request(app)
        .get('/notifications')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      const found = res.body.notifications.find((n: any) => n.id === notif1Id);
      expect(found).toBeUndefined();
    });

    it('rejects user2 from marking user1 notification as read (404 NOT_FOUND)', async () => {
      const res = await request(app)
        .patch(`/notifications/${notif1Id}/read`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(404);
    });

    it('allows owner user1 to mark their own notification as read', async () => {
      const res = await request(app)
        .patch(`/notifications/${notif1Id}/read`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.notification.read).toBe(true);
    });
  });
});
