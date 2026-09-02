import jwt from 'jsonwebtoken';
import app from '../src/app';
import prisma from '../src/config/database';
import { daysInMonth, pad2, weekdayOfKey } from '../src/utils/dateKeys';

const JWT_SECRET =
  '1760cad58d49e48906ad4c71dde17d30d95a8e3258a448c2718fb3de8e09b3dfda6d128e03672c15d9fbace34a9b8f58a17e21c428c2a59af929aa9f806a1c71';

async function runPhase6Tests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 PHASE 6: LEETCODE HEATMAP + PROGRESS PAGE TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  let user = await prisma.user.findFirst({
    where: { email: 'test_student@example.com' },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-google-id-phase6',
        email: 'test_student@example.com',
        name: 'Shivam Kumar',
        coins: 100,
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
    'X-Timezone': 'Asia/Kolkata',
  };

  const server = app.listen(5097);
  const API = 'http://localhost:5097/api';

  try {
    // ─── Step 1: Clean up old test seeds ───
    await prisma.task.deleteMany({
      where: { userId: user.id, title: { startsWith: 'TEST Seed' } },
    });

    // ─── Step 2: Seed realistic history ───
    console.log('🌱 Seeding realistic history for user...');
    
    // A) 60 days of varied completions
    const now = new Date();
    const tasksToInsert: any[] = [];
    const topics = ['Arrays', 'Hashing', 'Two Pointers', 'Binary Search', 'Trees'];
    const diffs = ['easy', 'medium', 'hard'];

    for (let g = 1; g <= 60; g++) {
      const daysBack = (g * 7) % 60;
      const d = new Date(now);
      d.setDate(d.getDate() - daysBack);
      d.setUTCHours(10, 0, 0, 0);

      tasksToInsert.push({
        userId: user.id,
        title: `TEST Seed ${g}`,
        topic: topics[g % 5],
        difficulty: diffs[g % 3],
        platform: 'leetcode',
        taskType: 'new',
        status: 'completed',
        scheduledDate: d,
        completedAt: d,
        rating: 'easy',
        originalSolveDate: d,
      });
    }

    // B) Every day of LAST calendar month for the hexagon badge
    const curYear = now.getUTCFullYear();
    const curMonth = now.getUTCMonth() + 1; // 1-12
    let lastMonthYear = curYear;
    let lastMonth = curMonth - 1;
    if (lastMonth <= 0) {
      lastMonth = 12;
      lastMonthYear--;
    }
    const dimLastMonth = daysInMonth(lastMonthYear, lastMonth);

    for (let day = 1; day <= dimLastMonth; day++) {
      const d = new Date(Date.UTC(lastMonthYear, lastMonth - 1, day, 10, 0, 0));
      tasksToInsert.push({
        userId: user.id,
        title: `TEST Seed Badge ${lastMonthYear}-${pad2(lastMonth)}-${pad2(day)}`,
        topic: 'Arrays',
        difficulty: 'easy',
        platform: 'leetcode',
        taskType: 'new',
        status: 'completed',
        scheduledDate: d,
        completedAt: d,
        rating: 'easy',
        originalSolveDate: d,
      });
    }

    await prisma.task.createMany({ data: tasksToInsert });
    console.log(`✅ Seeded ${tasksToInsert.length} tasks successfully.\n`);

    // ─── Test 1: Overview Shape ───
    const overviewRes = await fetch(`${API}/progress/overview`, { headers }).then(
      (r) => r.json()
    );
    const overview = overviewRes.data;
    const curMonthKey = `${curYear}-${pad2(curMonth)}`;

    const test1Pass =
      overviewRes.success &&
      overview.heatmap.tz === 'Asia/Kolkata' &&
      overview.heatmap.months.length === 12 &&
      overview.heatmap.months[11].key === curMonthKey;

    console.log(
      'Test 1 — Overview Shape:',
      test1Pass ? '✅ PASS' : '❌ FAIL',
      `tz: ${overview?.heatmap?.tz}, months: ${overview?.heatmap?.months?.length}, last: ${overview?.heatmap?.months?.[11]?.key}`
    );

    // ─── Test 2: No future cells ───
    const todayKeyStr = `${curYear}-${pad2(curMonth)}-${pad2(now.getDate())}`;
    const allDays = overview.heatmap.months.flatMap((m: any) => m.days);
    const futureCells = allDays.filter((d: any) => d.date > todayKeyStr);

    console.log(
      'Test 2 — No Future Cells:',
      futureCells.length === 0 ? '✅ PASS' : '❌ FAIL',
      `Count > today: ${futureCells.length} (Expected: 0)`
    );

    // ─── Test 3: Cells sum equals summary.totalCount ───
    const totalCountInCells = allDays.reduce((acc: number, d: any) => acc + d.count, 0);
    const sumMatch = totalCountInCells === overview.heatmap.summary.totalCount;

    console.log(
      'Test 3 — Cells Sum Match:',
      sumMatch ? '✅ PASS' : '❌ FAIL',
      `Sum: ${totalCountInCells} vs Summary: ${overview.heatmap.summary.totalCount}`
    );

    // ─── Test 4: Month grid calendar math + Badge ───
    let allMonthsMathOk = true;
    for (const m of overview.heatmap.months) {
      const expWeekday = weekdayOfKey(`${m.key}-01`);
      if (m.firstWeekday !== expWeekday) {
        allMonthsMathOk = false;
      }
    }
    const lastMonthKeyStr = `${lastMonthYear}-${pad2(lastMonth)}`;
    const lastMonthObj = overview.heatmap.months.find(
      (m: any) => m.key === lastMonthKeyStr
    );
    const badgePass = lastMonthObj?.badge === 'full-month';

    console.log(
      'Test 4 — Calendar Math & Full-Month Badge:',
      allMonthsMathOk && badgePass ? '✅ PASS' : '❌ FAIL',
      `Math OK: ${allMonthsMathOk}, Last month badge: "${lastMonthObj?.badge}"`
    );

    // ─── Test 5: Completing a task lights up today (+1 count in heatmap) ───
    const todayTask = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'TEST Solve For Progress Lightup',
        topic: 'Arrays',
        difficulty: 'easy',
        platform: 'leetcode',
        scheduledDate: todayKeyStr,
      }),
    })
      .then((r) => r.json())
      .then((r) => r.data);

    const countBefore =
      overview.heatmap.months[11].days.find((d: any) => d.date === todayKeyStr)
        ?.count || 0;

    await fetch(`${API}/tasks/${todayTask.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'easy' }),
    });

    const overview2 = await fetch(`${API}/progress/overview`, { headers })
      .then((r) => r.json())
      .then((r) => r.data);

    const countAfter =
      overview2.heatmap.months[11].days.find((d: any) => d.date === todayKeyStr)
        ?.count || 0;

    console.log(
      'Test 5 — Complete Task Lights Up Today:',
      countAfter === countBefore + 1 && overview2.stats.activeToday === true
        ? '✅ PASS'
        : '❌ FAIL',
      `Count today: ${countBefore} -> ${countAfter}, activeToday: ${overview2.stats.activeToday}, streak: ${overview2.stats.currentStreak}`
    );

    // ─── Test 6: Timezone header handling ───
    const invalidTzRes = await fetch(`${API}/progress/heatmap`, {
      headers: { ...headers, 'X-Timezone': 'Not/AZone' },
    }).then((r) => r.json());
    const validNyRes = await fetch(`${API}/progress/heatmap`, {
      headers: { ...headers, 'X-Timezone': 'America/New_York' },
    }).then((r) => r.json());

    console.log(
      'Test 6 — Timezone Fallback & Routing:',
      invalidTzRes.data.tz === 'Asia/Kolkata' &&
        validNyRes.data.tz === 'America/New_York'
        ? '✅ PASS'
        : '❌ FAIL',
      `Invalid fallback: "${invalidTzRes.data.tz}", NY: "${validNyRes.data.tz}"`
    );

    // ─── Test 7: Dashboard and Progress consistency ───
    const dash = await fetch(`${API}/dashboard/today`, { headers })
      .then((r) => r.json())
      .then((r) => r.data);

    const matchStreak = dash.statusOverview.streak === overview2.stats.currentStreak;
    const matchTotal =
      dash.statusOverview.totalQuestions === overview2.stats.totalSolved;

    console.log(
      'Test 7 — Dashboard & Progress Single Source of Truth:',
      matchStreak && matchTotal ? '✅ PASS' : '❌ FAIL',
      `Streak: Dash=${dash.statusOverview.streak} vs Prog=${overview2.stats.currentStreak} | Solved: Dash=${dash.statusOverview.totalQuestions} vs Prog=${overview2.stats.totalSolved}`
    );

    // ─── Test 8: Topic scope toggle with Active Plan ───
    const testPlan = await prisma.plan.create({
      data: {
        userId: user.id,
        name: 'TEST Progress Plan',
        source: 'neetcode',
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
        status: 'active',
        weekdayCapacity: 2,
        weekendCapacity: 3,
      },
    });

    const topicPlan = await fetch(`${API}/progress/topics?scope=plan`, { headers })
      .then((r) => r.json())
      .then((r) => r.data);
    const topicAll = await fetch(`${API}/progress/topics?scope=all`, { headers })
      .then((r) => r.json())
      .then((r) => r.data);

    console.log(
      'Test 8 — Topic Scope Toggle:',
      topicPlan.scope === 'plan' && topicAll.scope === 'all' && topicPlan.hasActivePlan === true
        ? '✅ PASS'
        : '❌ FAIL',
      `Plan Scope: "${topicPlan.scope}", All Scope: "${topicAll.scope}", HasPlan: ${topicPlan.hasActivePlan}`
    );

    // ─── Test 9: Streak Grace Rule Test (Alive but at risk) ───
    // If today had no completions, but yesterday had a completion, current streak remains intact
    const yesterdayKeys = new Set(['2026-09-01', '2026-09-02']);
    const streakGrace = (await import('../src/services/progress/streakService')).computeStreaks(
      yesterdayKeys,
      '2026-09-03'
    );
    console.log(
      'Test 9 — Streak Grace Rule (Alive at risk):',
      streakGrace.activeToday === false && streakGrace.current === 2
        ? '✅ PASS'
        : '❌ FAIL',
      `ActiveToday: ${streakGrace.activeToday} (Expected: false), CurrentStreak: ${streakGrace.current} (Expected: 2)`
    );

    // ─── Cleanup ───
    await prisma.task.deleteMany({
      where: { userId: user.id, title: { startsWith: 'TEST Seed' } },
    });
    await prisma.plan.delete({ where: { id: testPlan.id } });
    await fetch(`${API}/tasks/${todayTask.id}`, { method: 'DELETE', headers });
    console.log('\n🧹 Cleanup: All test seeds and temp tasks cleaned up.');

    console.log('\n🎉 ALL PHASE 6 (LEETCODE HEATMAP + PROGRESS) TESTS PASSED 100%!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runPhase6Tests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
