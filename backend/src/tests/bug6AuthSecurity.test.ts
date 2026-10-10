/**
 * bug6AuthSecurity.test.ts
 * Tests for Bug 6 — Auth Session Staleness, Destructive 401 Handling,
 * OAuth Token Leak & Signup Races.
 *
 * Sections A–G mirror the spec in Section 11 of the Bug 6 prompt.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../config/database';
import { env, assertProductionConfig } from '../config/env';
import { isAllowedOrigin } from '../app';
import {
  createExchangeCode,
  consumeExchangeCode,
} from '../services/auth/exchangeCodeService';
import { findOrCreateUser } from '../services/auth/googleAuthService';
import { demoLogin, getMe } from '../controllers/authController';

function createMockRes() {
  const state = { statusCode: 200, data: null as any };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: any) {
      state.data = payload;
      return res;
    },
  };
  return { res: res as any, state };
}

// ─────────────────────────────────────────────────
// A. Exchange code lifecycle
// ─────────────────────────────────────────────────
test('A. Exchange code lifecycle: single-use and expiration', () => {
  const testToken = 'jwt-token-xyz-123';

  // 1. Create and consume once → returns original token
  const code1 = createExchangeCode(testToken);
  const token1 = consumeExchangeCode(code1);
  assert.equal(token1, testToken, 'first consume must return original token');

  // 2. Consume same code again → returns null (single-use)
  const token2 = consumeExchangeCode(code1);
  assert.equal(token2, null, 'subsequent consume must return null (single-use)');

  // 3. Expired code → returns null
  const expiredCode = createExchangeCode(testToken, -1000);
  const tokenExpired = consumeExchangeCode(expiredCode);
  assert.equal(tokenExpired, null, 'expired code must return null');

  // 4. Non-existent code → returns null
  assert.equal(consumeExchangeCode('non-existent-uuid'), null, 'unknown code must return null');
});

// ─────────────────────────────────────────────────
// B. CORS origin whitelist
// ─────────────────────────────────────────────────
test('B. CORS origin whitelist handles undefined and multi-origin', () => {
  // No origin (curl, same-origin, server-to-server) is allowed unconditionally
  assert.equal(isAllowedOrigin(undefined), true, 'undefined origin must be allowed');

  // Single origin config
  assert.equal(isAllowedOrigin('http://localhost:5173', 'http://localhost:5173'), true);
  assert.equal(isAllowedOrigin('https://evil.example.com', 'http://localhost:5173'), false);

  // Multi-origin config (comma-separated list)
  const multiConfig = 'https://app.example.com, https://staging.example.com';
  assert.equal(isAllowedOrigin('https://app.example.com', multiConfig), true);
  assert.equal(isAllowedOrigin('https://staging.example.com', multiConfig), true);
  assert.equal(isAllowedOrigin('https://evil.example.com', multiConfig), false);
});

// ─────────────────────────────────────────────────
// C. Production misconfiguration guard
// ─────────────────────────────────────────────────
test('C. Production misconfiguration guard fails loudly on localhost default in prod', () => {
  // Production with localhost default → throws loudly
  assert.throws(
    () => {
      assertProductionConfig({
        ...env,
        isProd: true,
        FRONTEND_URL: 'http://localhost:5173',
      });
    },
    /FRONTEND_URL is not configured for production/,
    'should throw when production uses localhost default'
  );

  // Production with valid deployed URL → does not throw
  assert.doesNotThrow(() => {
    assertProductionConfig({
      ...env,
      isProd: true,
      FRONTEND_URL: 'https://app.example.com',
    });
  });

  // Production with multi-origin deployed URLs → does not throw
  assert.doesNotThrow(() => {
    assertProductionConfig({
      ...env,
      isProd: true,
      FRONTEND_URL: 'https://app.example.com,https://staging.example.com',
    });
  });

  // Development with localhost default → does not throw
  assert.doesNotThrow(() => {
    assertProductionConfig({
      ...env,
      isProd: false,
      FRONTEND_URL: 'http://localhost:5173',
    });
  });
});

// ─────────────────────────────────────────────────
// D. findOrCreateUser concurrent first-time signup race
// ─────────────────────────────────────────────────
test('D. findOrCreateUser race-safety on concurrent first-time signup', async () => {
  const googleId = `race-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `${googleId}@test.local`;

  try {
    const [user1, user2] = await Promise.all([
      findOrCreateUser({
        sub: googleId,
        email,
        name: 'Concurrent User 1',
        picture: 'https://example.com/pic1.jpg',
      }),
      findOrCreateUser({
        sub: googleId,
        email,
        name: 'Concurrent User 2',
        picture: 'https://example.com/pic2.jpg',
      }),
    ]);

    // Assert both resolved to the same user ID
    assert.equal(user1.id, user2.id, 'both concurrent signup calls must resolve to the same user id');

    // Assert exactly one row was created in the database
    const count = await prisma.user.count({ where: { googleId } });
    assert.equal(count, 1, 'exactly one user row must exist for this googleId');
  } finally {
    await prisma.user.deleteMany({ where: { googleId } });
  }
});

// ─────────────────────────────────────────────────
// E. findOrCreateUser email conflict on profile refresh
// ─────────────────────────────────────────────────
test('E. findOrCreateUser degrades gracefully on email conflict during profile refresh', async () => {
  const idA = `userA-${Date.now()}`;
  const idB = `userB-${Date.now()}`;
  const emailA = `${idA}@test.local`;
  const emailB = `${idB}@test.local`;

  try {
    // Seed user A and user B
    const userA = await prisma.user.create({
      data: { googleId: idA, email: emailA, name: 'User A', coins: 10 },
    });
    const userB = await prisma.user.create({
      data: { googleId: idB, email: emailB, name: 'User B', coins: 20 },
    });

    // Call findOrCreateUser for user A with an email that conflicts with user B's email
    const refreshedA = await findOrCreateUser({
      sub: idA,
      email: emailB, // Collides with user B
      name: 'User A Updated Name',
      picture: 'https://example.com/newpic.jpg',
    });

    // Assert it returns user A's record, does not throw, and preserves user A's original email
    assert.equal(refreshedA.id, userA.id, 'must return user A record');
    assert.equal(refreshedA.email, emailA, 'email must remain original emailA to avoid P2002 collision');

    // Assert user B's record was not mutated
    const currentB = await prisma.user.findUnique({ where: { id: userB.id } });
    assert.equal(currentB?.email, emailB, 'user B must remain untouched');
  } finally {
    await prisma.user.deleteMany({ where: { googleId: { in: [idA, idB] } } });
  }
});

// ─────────────────────────────────────────────────
// F. demoLogin concurrent race
// ─────────────────────────────────────────────────
test('F. demoLogin race-safety on concurrent calls', async () => {
  const DEMO_GOOGLE_ID = 'demo-student-id';
  // Ensure clean starting state for demo account
  await prisma.user.deleteMany({ where: { googleId: DEMO_GOOGLE_ID } });

  try {
    const mock1 = createMockRes();
    const mock2 = createMockRes();

    await Promise.all([
      demoLogin({} as any, mock1.res, (err) => { if (err) throw err; }),
      demoLogin({} as any, mock2.res, (err) => { if (err) throw err; }),
    ]);

    assert.equal(mock1.state.statusCode, 200);
    assert.equal(mock2.state.statusCode, 200);
    assert.ok(mock1.state.data.data.token, 'mock1 must receive token');
    assert.ok(mock2.state.data.data.token, 'mock2 must receive token');

    const demoCount = await prisma.user.count({ where: { googleId: DEMO_GOOGLE_ID } });
    assert.equal(demoCount, 1, 'exactly one demo user row must exist');
  } finally {
    // Leave demo user available
  }
});

// ─────────────────────────────────────────────────
// G. getMe returns fresh coins, bypassing cache staleness
// ─────────────────────────────────────────────────
test('G. getMe returns fresh DB coins, bypassing cached figure', async () => {
  const googleId = `getme-${Date.now()}`;
  const email = `${googleId}@test.local`;

  const user = await prisma.user.create({
    data: { googleId, email, name: 'GetMe User', coins: 50 },
  });

  try {
    // Update DB directly to 125 coins (simulating a background mutation or concurrent solve)
    await prisma.user.update({
      where: { id: user.id },
      data: { coins: 125 },
    });

    // Provide a req with stale cached user data (coins: 50)
    const staleReq = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: null,
        coins: 50, // STALE!
        timezone: 'Asia/Kolkata',
      },
    } as any;

    const mock = createMockRes();
    await getMe(staleReq, mock.res, (err) => { if (err) throw err; });

    assert.equal(mock.state.statusCode, 200);
    assert.equal(mock.state.data.data.coins, 125, 'getMe must return fresh coins (125) from DB, not stale cached (50)');
  } finally {
    await prisma.user.deleteMany({ where: { id: user.id } });
  }
});
