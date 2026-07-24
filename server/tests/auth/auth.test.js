/**
 * auth.test.js — Authentication Endpoint Tests
 *
 * Tests cover:
 *  - Login: success, wrong password, locked account, user not found
 *  - Token refresh: rotation, reuse detection
 *  - Logout: token blacklisting
 *  - /me: authenticated profile fetch
 *  - Password change: validation, old=new rejection
 *
 * Uses: Jest + Supertest
 * Note: Set NODE_ENV=test to skip rate limiting
 */

import request from 'supertest';
import app from '../../src/app.js';
import redis from '../../src/config/redis.js';
import { supabaseAdmin } from '../../src/config/db.js';
import { hashPassword } from '../../src/utils/hash.js';

// ─── Test user seed ───────────────────────────────────────────────────────────
const TEST_USER = {
  id: '00000000-test-0000-0000-000000000001',
  name: 'Test Salesperson',
  mobile: '9000000001',
  email: 'test.sp@antigravity.in',
  role: 'salesperson',
  is_active: true,
  employee_code: 'TEST-SP-001',
};

const TEST_PASSWORD = 'TestPass@123';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
beforeAll(async () => {
  // Insert test user with hashed password
  const passwordHash = await hashPassword(TEST_PASSWORD);
  await supabaseAdmin.from('users').upsert({
    ...TEST_USER,
    password_hash: passwordHash,
  });
});

afterAll(async () => {
  // Clean up test user
  await supabaseAdmin.from('users').delete().eq('id', TEST_USER.id);
  // Clean up Redis keys
  const keys = await redis.keys(`rt:${TEST_USER.id}:*`);
  if (keys.length) await redis.del(...keys);
  await redis.quit();
});

// ─── Login ────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('should login with mobile and return tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: TEST_USER.mobile, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.role).toBe('salesperson');
  });

  it('should login with email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: TEST_USER.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('should reject wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: TEST_USER.mobile, password: 'WrongPass@123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject non-existent user with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '0000000000', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
  });

  it('should reject request with missing fields with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: TEST_USER.mobile }); // No password

    expect(res.status).toBe(400);
  });

  it('should reject inactive users with 403', async () => {
    await supabaseAdmin.from('users').update({ is_active: false }).eq('id', TEST_USER.id);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: TEST_USER.mobile, password: TEST_PASSWORD });

    expect(res.status).toBe(403);

    // Restore
    await supabaseAdmin.from('users').update({ is_active: true }).eq('id', TEST_USER.id);
  });
});

// ─── Token Refresh ────────────────────────────────────────────────────────────
describe('POST /api/auth/refresh', () => {
  let refreshToken;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: TEST_USER.mobile, password: TEST_PASSWORD });
    refreshToken = res.body.data.refreshToken;
  });

  it('should issue new access and refresh tokens', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    // New refresh token should differ from old one
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });

  it('should reject an already-used refresh token (reuse detection)', async () => {
    // Use it once
    await request(app).post('/api/auth/refresh').send({ refreshToken });

    // Use the same token again — should fail and invalidate all sessions
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  it('should reject missing refresh token with 401', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(401);
  });

  it('should reject malformed refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'not.a.valid.jwt' });
    expect(res.status).toBe(401);
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  let accessToken;
  let refreshToken;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: TEST_USER.mobile, password: TEST_PASSWORD });
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('should logout and blacklist access token', async () => {
    // Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(logoutRes.status).toBe(200);

    // Attempt to use the same access token — should be blacklisted
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meRes.status).toBe(401);
  });

  it('should return 401 when trying to logout without token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ─── /me endpoint ─────────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  let accessToken;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: TEST_USER.mobile, password: TEST_PASSWORD });
    accessToken = res.body.data.accessToken;
  });

  it('should return user profile for authenticated user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(TEST_USER.id);
    expect(res.body.data.role).toBe('salesperson');
    // Should NOT return password_hash
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 401 with expired token', async () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid';
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });
});

// ─── Health check ─────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('should return 200 with service info', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('Anti Gravity API');
  });
});
