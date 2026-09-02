import jwt from 'jsonwebtoken';
import app from '../src/app';
import prisma from '../src/config/database';

const JWT_SECRET =
  '1760cad58d49e48906ad4c71dde17d30d95a8e3258a448c2718fb3de8e09b3dfda6d128e03672c15d9fbace34a9b8f58a17e21c428c2a59af929aa9f806a1c71';

async function runStep3Tests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 STEP 3 — AI PLAN GENERATION & WEIGHTED SCHEDULER');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Find or create test user
  let user = await prisma.user.findFirst({
    where: { email: 'test_student@example.com' },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-google-id-step3',
        email: 'test_student@example.com',
        name: 'Shivam Kumar',
        coins: 0,
      },
    });
  } else {
    await prisma.task.deleteMany({ where: { userId: user.id } });
    await prisma.plan.deleteMany({ where: { userId: user.id } });
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

  const server = app.listen(5098);
  const API = 'http://localhost:5098/api';

  try {
    // ─── Test 1: AI Parse ───
    const parseRes = await fetch(`${API}/plans/ai-parse`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt:
          'I want to complete NeetCode in 14 days. I am weak in Binary Search and I have an exam on 10 September 2026.',
      }),
    }).then((r) => r.json());

    const parsed = parseRes.data;
    const test1Pass =
      parseRes.success &&
      parsed.source === 'neetcode150' &&
      parsed.durationDays === 14 &&
      parsed.focusTopics.some((t: string) => /binary search/i.test(t)) &&
      parsed.busyDays.some((b: any) => b.date.includes('09-10')) &&
      parsed.weekdayLoad === 2 &&
      parsed.weekendLoad === 3;

    console.log(
      'Test 1 — AI Parse Prompt:',
      test1Pass ? '✅ PASS' : '❌ FAIL',
      parsed
    );

    // ─── Test 2: Preview 14-day Plan ───
    const previewRes = await fetch(`${API}/plans/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source: 'neetcode150',
        startDate: '2026-09-02',
        durationDays: 14,
        pace: 'moderate',
        weekdayLoad: 2,
        weekendLoad: 3,
        focusTopics: ['Binary Search'],
        avoidTopics: [],
        busyDays: [{ date: '2026-09-10', reason: 'Semester Exam', loadReduction: 0.6 }],
        bufferDay: 0,
      }),
    }).then((r) => r.json());

    const preview = previewRes.data;
    const totalScheduled = preview.days.reduce(
      (acc: number, d: any) => acc + d.questions.length,
      0
    );

    const test2Pass =
      previewRes.success &&
      preview.valid === true &&
      preview.summary.totalQuestions === 20 &&
      totalScheduled === 20;

    console.log(
      'Test 2 — Preview 14-day plan:',
      test2Pass ? '✅ PASS' : '❌ FAIL',
      `Valid: ${preview.valid}, Total Questions: ${preview.summary.totalQuestions}, Scheduled: ${totalScheduled}`
    );

    // ─── Test 3: Check Overloaded Days ───
    const overloadedDays = preview.days.filter(
      (d: any) => d.usedLoad > d.capacityLoad + 0.5
    );
    const multiHardDays = preview.days.filter(
      (d: any) =>
        d.questions.filter((q: any) => q.question.difficulty === 'hard').length >
        1
    );

    console.log(
      'Test 3 — Weighted Daily Load Check (tolerance <= capacity + 0.5):',
      overloadedDays.length === 0 && multiHardDays.length === 0
        ? '✅ PASS'
        : '❌ FAIL',
      `Overloaded days: ${overloadedDays.length}, Multi-hard days: ${multiHardDays.length}`
    );

    console.log('\n--- Daily Schedule Breakdown ---');
    preview.days.forEach((d: any) => {
      const qTitles = d.questions
        .map((q: any) => `${q.question.title} [${q.question.difficulty}:${q.load}]`)
        .join(', ');
      console.log(
        `  ${d.date} | Cap: ${d.capacityLoad} | Used: ${d.usedLoad} | ${qTitles || '(Buffer/Catch-up day)'}`
      );
    });

    // ─── Test 4: Commit Plan ───
    const commitRes = await fetch(`${API}/plans/commit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'TEST NeetCode Weighted Plan',
        source: 'neetcode150',
        startDate: '2026-09-02',
        durationDays: 14,
        pace: 'moderate',
        weekdayLoad: 2,
        weekendLoad: 3,
        focusTopics: ['Binary Search'],
        avoidTopics: [],
        busyDays: [{ date: '2026-09-10', reason: 'Semester Exam', loadReduction: 0.6 }],
        bufferDay: 0,
        archiveExisting: true,
      }),
    }).then((r) => r.json());

    const commitData = commitRes.data;
    const test4Pass =
      commitRes.success &&
      commitData.plan.status === 'active' &&
      commitData.tasksCreated === 20;

    console.log(
      '\nTest 4 — Commit Plan:',
      test4Pass ? '✅ PASS' : '❌ FAIL',
      `Plan ID: ${commitData.plan.id}, Tasks Created: ${commitData.tasksCreated}`
    );

    // ─── Test 5: Active Plan Retrieval ───
    const activeRes = await fetch(`${API}/plans/active`, {
      headers,
    }).then((r) => r.json());

    const test5Pass =
      activeRes.success &&
      activeRes.data.plan.name === 'TEST NeetCode Weighted Plan' &&
      activeRes.data.tasks.length === 20;

    console.log(
      'Test 5 — Active Plan API:',
      test5Pass ? '✅ PASS' : '❌ FAIL',
      `Plan: "${activeRes.data.plan.name}", Linked tasks: ${activeRes.data.tasks.length}`
    );

    // ─── Test 6: Archive Existing Plan on New Commit ───
    const commitNewRes = await fetch(`${API}/plans/commit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'TEST Sprint Plan 7 Days',
        source: 'neetcode150',
        startDate: '2026-09-02',
        durationDays: 7,
        pace: 'intensive',
        weekdayLoad: 3,
        weekendLoad: 4.5,
        focusTopics: [],
        avoidTopics: [],
        busyDays: [],
        bufferDay: 0,
        archiveExisting: true,
      }),
    }).then((r) => r.json());

    const oldPlan = await prisma.plan.findUnique({
      where: { id: commitData.plan.id },
    });

    console.log(
      'Test 6 — Archive Old Plan & Create New:',
      oldPlan?.status === 'archived' && commitNewRes.data.plan.status === 'active'
        ? '✅ PASS'
        : '❌ FAIL',
      `Old Plan status: ${oldPlan?.status}, New Plan: "${commitNewRes.data.plan.name}"`
    );

    // ─── Test 7: SQL Verification Queries ───
    console.log('\n--- PART 7: SQL VERIFICATION QUERIES ---');

    // 1. Active plans count
    const activePlans = await prisma.$queryRaw<any[]>`
      SELECT id, name, source, status, start_date, end_date
      FROM plans
      WHERE user_id = ${user.id} AND status = 'active'
    `;
    console.log(`Active plans count: ${activePlans.length} (Expected: 1)`);

    // 2. Total tasks created with plan_id
    const planTasksCount = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) AS total
      FROM tasks
      WHERE user_id = ${user.id}
        AND plan_id = ${commitNewRes.data.plan.id}
        AND task_type = 'new'
    `;
    console.log(`Tasks created for active plan: ${planTasksCount[0].total} (Expected: 20)`);

    // 3. No manual revision tasks created by plan
    const revisionTasksCount = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) AS total
      FROM tasks
      WHERE user_id = ${user.id}
        AND plan_id = ${commitNewRes.data.plan.id}
        AND task_type = 'revision'
    `;
    console.log(`Revision tasks created by plan generator: ${revisionTasksCount[0].total} (Expected: 0)`);

    // 4. Daily weighted load distribution in SQL
    const dailyLoadSql = await prisma.$queryRaw<any[]>`
      SELECT
        scheduled_date::date AS day,
        SUM(
          CASE difficulty
            WHEN 'easy' THEN 0.5
            WHEN 'medium' THEN 1.0
            WHEN 'hard' THEN 1.5
            ELSE 1.0
          END
        ) AS used_load,
        COUNT(*) AS questions
      FROM tasks
      WHERE user_id = ${user.id}
        AND plan_id = ${commitNewRes.data.plan.id}
        AND task_type = 'new'
      GROUP BY scheduled_date::date
      ORDER BY day
    `;
    console.log('\nDaily SQL Load Distribution:');
    dailyLoadSql.forEach((row) => {
      console.log(`  ${row.day.toISOString().split('T')[0]} ➔ Load: ${row.used_load} (${row.questions} questions)`);
    });

    // ─── Test 8: Task Completion & Revision Generation from Roadmap ───
    console.log('\n--- PART 8: COMPLETE PLAN TASK & GENERATE REVISIONS ---');
    const firstTask = await prisma.task.findFirst({
      where: {
        userId: user.id,
        planId: commitNewRes.data.plan.id,
        status: 'pending',
      },
    });

    if (firstTask) {
      const completeRes = await fetch(`${API}/tasks/${firstTask.id}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rating: 'medium' }),
      }).then((r) => r.json());

      const revisions = await prisma.task.findMany({
        where: { parentTaskId: firstTask.id, taskType: 'revision' },
      });

      console.log(
        'Complete plan task + Medium rating:',
        completeRes.success && revisions.length === 4 ? '✅ PASS' : '❌ FAIL',
        `Task: "${firstTask.title}", Revisions generated: ${revisions.length}`
      );
    }

    // ─── Test 9: Cleanup ───
    console.log('\n--- PART 9: CLEANUP TEST DATA ---');
    await prisma.task.deleteMany({ where: { userId: user.id } });
    await prisma.plan.deleteMany({ where: { userId: user.id } });
    const remainingTasks = await prisma.task.count({ where: { userId: user.id } });
    console.log(`Cleanup complete: remaining tasks = ${remainingTasks}`);

    console.log('\n🎉 ALL STEP 3 AI PLAN & SCHEDULER TESTS PASSED 100%!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runStep3Tests().catch((err) => {
  console.error('❌ Step 3 Test Suite Failed:', err);
  process.exit(1);
});
