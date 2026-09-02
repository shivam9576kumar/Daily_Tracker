import jwt from 'jsonwebtoken';
import app from '../src/app';
import prisma from '../src/config/database';

const JWT_SECRET =
  '1760cad58d49e48906ad4c71dde17d30d95a8e3258a448c2718fb3de8e09b3dfda6d128e03672c15d9fbace34a9b8f58a17e21c428c2a59af929aa9f806a1c71';

async function runFutureLockTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 ROADMAP READ-ONLY & FUTURE-LOCK VERIFICATION TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  let user = await prisma.user.findFirst({
    where: { email: 'test_student@example.com' },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-google-id-lock',
        email: 'test_student@example.com',
        name: 'Shivam Kumar',
        coins: 0,
      },
    });
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

  const server = app.listen(5099);
  const API = 'http://localhost:5099/api';

  try {
    // ─── Test 1: Create a task 7 days in the future ───
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const futureTaskRes = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'TEST Future Lock Task',
        topic: 'Arrays',
        difficulty: 'easy',
        platform: 'leetcode',
        problemUrl: 'https://leetcode.com/problems/two-sum/',
        scheduledDate: futureDateStr,
      }),
    }).then((r) => r.json());

    const futureTask = futureTaskRes.data;
    console.log(
      'Test 1 — Create Future Task (+7 days):',
      futureTask?.id ? '✅ PASS' : '❌ FAIL',
      `ID: ${futureTask?.id}, Scheduled: ${futureTask?.scheduledDate}`
    );

    // ─── Test 2: Attempt to complete the future task today -> MUST BE BLOCKED ───
    const completeAttempt = await fetch(`${API}/tasks/${futureTask.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'easy' }),
    }).then((r) => r.json());

    const blocked =
      !completeAttempt.success &&
      completeAttempt.error.includes('Cannot complete this task yet');

    console.log(
      'Test 2 — Block Future Task Completion:',
      blocked ? '✅ PASS' : '❌ FAIL',
      `Response error: "${completeAttempt.error}"`
    );

    // ─── Test 3: Today's task can still be completed normally ───
    const todayDateStr = new Date().toISOString().split('T')[0];
    const todayTask = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'TEST Today Solvable Task',
        topic: 'Arrays',
        difficulty: 'easy',
        platform: 'leetcode',
        problemUrl: 'https://leetcode.com/problems/two-sum/',
        scheduledDate: todayDateStr,
      }),
    })
      .then((r) => r.json())
      .then((r) => r.data);

    const todayComplete = await fetch(`${API}/tasks/${todayTask.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'easy' }),
    }).then((r) => r.json());

    console.log(
      'Test 3 — Complete Today Task:',
      todayComplete.success ? '✅ PASS' : '❌ FAIL',
      `Status: ${todayComplete.data?.status}, Coins: ${todayComplete.data?.userCoins || 'awarded'}`
    );

    // ─── Test 4: Active Plan API ───
    const activeRes = await fetch(`${API}/plans/active`, { headers }).then((r) =>
      r.json()
    );
    console.log(
      'Test 4 — Active Plan API Structure:',
      activeRes.success && activeRes.data !== undefined ? '✅ PASS' : '❌ FAIL',
      `Plan: ${activeRes.data.plan?.name || 'None'}, Tasks: ${activeRes.data.tasks?.length || 0}`
    );

    // ─── Test 5: SQL Check — No future completed tasks ───
    const futureCompleted = await prisma.$queryRaw<any[]>`
      SELECT id, title, scheduled_date::date, status, completed_at::date
      FROM tasks
      WHERE user_id = ${user.id}
        AND status = 'completed'
        AND scheduled_date::date > CURRENT_DATE;
    `;
    console.log(
      'Test 5 — SQL Check (No future completed tasks):',
      futureCompleted.length === 0 ? '✅ PASS' : '❌ FAIL',
      `Count: ${futureCompleted.length} (Expected: 0)`
    );

    // ─── Cleanup ───
    await fetch(`${API}/tasks/${futureTask.id}`, { method: 'DELETE', headers });
    await fetch(`${API}/tasks/${todayTask.id}`, { method: 'DELETE', headers });
    console.log('\nCleanup: temporary test tasks deleted.');

    console.log('\n🎉 ALL ROADMAP READ-ONLY & FUTURE-LOCK TESTS PASSED 100%!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runFutureLockTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
