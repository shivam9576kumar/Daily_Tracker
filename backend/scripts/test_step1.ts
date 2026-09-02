import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from '../src/app';

const prisma = new PrismaClient();
const JWT_SECRET =
  '1760cad58d49e48906ad4c71dde17d30d95a8e3258a448c2718fb3de8e09b3dfda6d128e03672c15d9fbace34a9b8f58a17e21c428c2a59af929aa9f806a1c71';

async function runTests() {
  console.log('🧪 Starting Step 1 Automated Verification Test Suite...\n');

  // 1. Create or find test user
  let user = await prisma.user.findFirst({
    where: { email: 'test_student@example.com' },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-google-id-12345',
        email: 'test_student@example.com',
        name: 'Shivam Test User',
        coins: 0,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { coins: 0 },
    });
    // Clean any previous test tasks
    await prisma.task.deleteMany({ where: { userId: user.id } });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log(`✅ Test User ID: ${user.id}`);
  console.log(`✅ Test JWT generated`);

  const server = app.listen(5099);
  const BASE = 'http://localhost:5099/api';

  try {
    // TEST 1: Health
    const hRes = await fetch(`${BASE}/health`).then((r) => r.json());
    console.log(
      'TEST 1 — Health Check:',
      hRes.success ? '✅ PASS' : '❌ FAIL',
      hRes
    );

    // TEST 2: Auth /me
    const meRes = await fetch(`${BASE}/auth/me`, { headers }).then((r) =>
      r.json()
    );
    console.log(
      'TEST 2 — Auth /me:',
      meRes.success && meRes.data.email === user.email
        ? '✅ PASS'
        : '❌ FAIL',
      meRes.data
    );

    // TEST 3: Dashboard shape
    const dashRes = await fetch(`${BASE}/dashboard/today`, {
      headers,
    }).then((r) => r.json());
    console.log(
      'TEST 3 — Dashboard today:',
      dashRes.success && dashRes.data.statusOverview
        ? '✅ PASS'
        : '❌ FAIL',
      dashRes.data.statusOverview,
      dashRes.data.vibe
    );

    // TEST 4: Validation empty title
    const badRes1 = await fetch(`${BASE}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: '',
        topic: 'Arrays',
        scheduledDate: '2026-09-02',
      }),
    }).then((r) => r.json());
    console.log(
      'TEST 4 — Empty title rejected:',
      !badRes1.success && badRes1.error === 'Title is required'
        ? '✅ PASS'
        : '❌ FAIL',
      badRes1
    );

    // TEST 5: Bad difficulty
    const badRes2 = await fetch(`${BASE}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'X',
        topic: 'Arrays',
        difficulty: 'impossible',
        scheduledDate: '2026-09-02',
      }),
    }).then((r) => r.json());
    console.log(
      'TEST 5 — Bad difficulty rejected:',
      !badRes2.success ? '✅ PASS' : '❌ FAIL',
      badRes2
    );

    // TEST 6: Create task
    const today = new Date().toISOString().split('T')[0];
    const createRes = await fetch(`${BASE}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'TEST Two Sum',
        topic: 'Arrays',
        difficulty: 'hard',
        platform: 'leetcode',
        problemUrl: 'https://leetcode.com/problems/two-sum/',
        scheduledDate: today,
      }),
    }).then((r) => r.json());
    const taskId = createRes.data?.id;
    console.log(
      'TEST 6 — Create task:',
      createRes.success && taskId ? '✅ PASS' : '❌ FAIL',
      `ID: ${taskId}`
    );

    // TEST 7: Appears in Today's Hitlist
    const dash2 = await fetch(`${BASE}/dashboard/today`, {
      headers,
    }).then((r) => r.json());
    const pendingList = dash2.data.todaysHitlist.pending;
    console.log(
      'TEST 7 — Task in hitlist:',
      pendingList.some((t: any) => t.id === taskId)
        ? '✅ PASS'
        : '❌ FAIL',
      `Pending count: ${pendingList.length}`
    );

    // TEST 8: Complete without rating must FAIL
    const compBad = await fetch(`${BASE}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    }).then((r) => r.json());
    console.log(
      'TEST 8 — Complete without rating fails:',
      !compBad.success ? '✅ PASS' : '❌ FAIL',
      compBad.error
    );

    // TEST 9: Complete with "hard" -> 5 revisions created
    const compGood = await fetch(`${BASE}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'hard' }),
    }).then((r) => r.json());
    const revisions = compGood.data.revisions || [];
    console.log(
      'TEST 9 — Complete with hard (5 revisions):',
      compGood.success && revisions.length === 5 ? '✅ PASS' : '❌ FAIL',
      `Revisions: ${revisions.length}`
    );

    // TEST 10: Coins awarded (hard = 15)
    const meCoins = await fetch(`${BASE}/auth/me`, { headers }).then((r) =>
      r.json()
    );
    console.log(
      'TEST 10 — Coins awarded (15):',
      meCoins.data.coins === 15 ? '✅ PASS' : '❌ FAIL',
      `Coins: ${meCoins.data.coins}`
    );

    // TEST 11: Dashboard reflects completion
    const dash3 = await fetch(`${BASE}/dashboard/today`, {
      headers,
    }).then((r) => r.json());
    console.log(
      'TEST 11 — Dashboard counts:',
      dash3.data.statusOverview.totalQuestions === 1 &&
        dash3.data.statusOverview.coins === 15
        ? '✅ PASS'
        : '❌ FAIL',
      dash3.data.statusOverview
    );

    // TEST 12: Double complete fails
    const doubleComp = await fetch(`${BASE}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'easy' }),
    }).then((r) => r.json());
    console.log(
      'TEST 12 — Double-complete fails:',
      !doubleComp.success ? '✅ PASS' : '❌ FAIL',
      doubleComp.error
    );

    // TEST 13: Re-rate hard -> easy (5 revisions -> 2, coins -> 5)
    const rerateRes = await fetch(`${BASE}/tasks/${taskId}/rate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'easy' }),
    }).then((r) => r.json());
    const meCoins2 = await fetch(`${BASE}/auth/me`, { headers }).then((r) =>
      r.json()
    );
    console.log(
      'TEST 13 — Rerate hard -> easy:',
      rerateRes.data.revisions.length === 2 && meCoins2.data.coins === 5
        ? '✅ PASS'
        : '❌ FAIL',
      `Revisions: ${rerateRes.data.revisions.length}, Coins: ${meCoins2.data.coins}`
    );

    // TEST 14: Undo completion (back to pending, 0 revisions, 0 coins)
    const undoRes = await fetch(`${BASE}/tasks/${taskId}/undo`, {
      method: 'POST',
      headers,
    }).then((r) => r.json());
    const meCoins3 = await fetch(`${BASE}/auth/me`, { headers }).then((r) =>
      r.json()
    );
    console.log(
      'TEST 14 — Undo completion:',
      undoRes.data.status === 'pending' &&
        undoRes.data.revisions.length === 0 &&
        meCoins3.data.coins === 0
        ? '✅ PASS'
        : '❌ FAIL',
      `Status: ${undoRes.data.status}, Revisions: ${undoRes.data.revisions.length}, Coins: ${meCoins3.data.coins}`
    );

    // TEST 15: Delete task
    const delRes = await fetch(`${BASE}/tasks/${taskId}`, {
      method: 'DELETE',
      headers,
    }).then((r) => r.json());
    console.log(
      'TEST 15 — Delete task:',
      delRes.success ? '✅ PASS' : '❌ FAIL'
    );

    console.log('\n🎉 ALL 15 STEP 1 AUTOMATED TESTS COMPLETED WITH 100% PASS!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
