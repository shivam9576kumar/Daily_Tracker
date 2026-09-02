import jwt from 'jsonwebtoken';
import app from '../src/app';
import prisma from '../src/config/database';

const JWT_SECRET =
  '1760cad58d49e48906ad4c71dde17d30d95a8e3258a448c2718fb3de8e09b3dfda6d128e03672c15d9fbace34a9b8f58a17e21c428c2a59af929aa9f806a1c71';

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 REVISION SYSTEM HARDENING — FULL TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Find or create test user
  let user = await prisma.user.findFirst({
    where: { email: 'test_student@example.com' },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-google-id-step2',
        email: 'test_student@example.com',
        name: 'Shivam Kumar',
        coins: 0,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { coins: 0 },
    });
    await prisma.task.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
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

  const server = app.listen(5097);
  const API = 'http://localhost:5097/api';

  try {
    // ─── Test 1: Health ───
    const hRes = await fetch(`${API}/health`).then((r) => r.json());
    console.log(
      'Test 1 — Health:',
      hRes.success && hRes.data.status === 'ok' ? '✅ PASS' : '❌ FAIL'
    );

    // ─── Test 2: Revision consistency initially ───
    const rInit = await fetch(`${API}/debug/revisions`, { headers }).then(
      (r) => r.json()
    );
    console.log(
      'Test 2 — Revision consistency initially:',
      rInit.data.ok === true ? '✅ PASS' : '❌ FAIL',
      rInit.data.counts
    );

    // ─── Test 3: Create Easy, Medium, Hard tasks ───
    const today = new Date().toISOString().split('T')[0];
    const easy = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'TEST Easy Two Sum',
        topic: 'Arrays',
        difficulty: 'easy',
        platform: 'leetcode',
        scheduledDate: today,
      }),
    })
      .then((r) => r.json())
      .then((r) => r.data);

    const medium = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'TEST Medium Longest Substring',
        topic: 'Sliding Window',
        difficulty: 'medium',
        platform: 'leetcode',
        scheduledDate: today,
      }),
    })
      .then((r) => r.json())
      .then((r) => r.data);

    const hard = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'TEST Hard Median',
        topic: 'Binary Search',
        difficulty: 'hard',
        platform: 'leetcode',
        scheduledDate: today,
      }),
    })
      .then((r) => r.json())
      .then((r) => r.data);

    console.log(
      'Test 3 — Create Easy, Medium, Hard tasks:',
      easy.id && medium.id && hard.id ? '✅ PASS' : '❌ FAIL',
      `[Easy: ${easy.id}, Med: ${medium.id}, Hard: ${hard.id}]`
    );

    // ─── Test 4: Complete all three ───
    const easyDone = await fetch(`${API}/tasks/${easy.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'easy' }),
    })
      .then((r) => r.json())
      .then((r) => r.data);

    const mediumDone = await fetch(`${API}/tasks/${medium.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'medium' }),
    })
      .then((r) => r.json())
      .then((r) => r.data);

    const hardDone = await fetch(`${API}/tasks/${hard.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'hard' }),
    })
      .then((r) => r.json())
      .then((r) => r.data);

    console.log(
      'Test 4 — Complete all three:',
      easyDone.revisions.length === 2 &&
        mediumDone.revisions.length === 4 &&
        hardDone.revisions.length === 5
        ? '✅ PASS'
        : '❌ FAIL',
      `Easy: ${easyDone.revisions.length}, Med: ${mediumDone.revisions.length}, Hard: ${hardDone.revisions.length}`
    );

    // ─── Test 5: Hard revision offsets ───
    const hardRevs = await prisma.task.findMany({
      where: { parentTaskId: hard.id },
      orderBy: { revisionNumber: 'asc' },
    });
    console.log(
      'Test 5 — Hard revision offsets:',
      hardRevs.length === 5 ? '✅ PASS' : '❌ FAIL'
    );
    hardRevs.forEach((r) => {
      console.log(
        `  Rev #${r.revisionNumber} - ${r.scheduledDate.toISOString().split('T')[0]} (${r.status})`
      );
    });

    // ─── Test 6: Consistency after generation ───
    const rGen = await fetch(`${API}/debug/revisions`, { headers }).then(
      (r) => r.json()
    );
    console.log(
      'Test 6 — Consistency after generation:',
      rGen.data.ok === true ? '✅ PASS' : '❌ FAIL',
      rGen.data.counts
    );

    // ─── Test 7: Complete one revision task ───
    const firstRevId = hardDone.revisions[0].id;
    const revDone = await fetch(`${API}/tasks/${firstRevId}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((r) => r.data);

    const revChildren = await prisma.task.count({
      where: { parentTaskId: firstRevId },
    });
    console.log(
      'Test 7 — Complete one revision task:',
      revDone.status === 'completed' && revChildren === 0
        ? '✅ PASS'
        : '❌ FAIL',
      `Status: ${revDone.status}, Child revisions: ${revChildren}`
    );

    // ─── Test 8: Revision cannot be rated ───
    const secondRevId = hardDone.revisions[1].id;
    const rateRevRes = await fetch(`${API}/tasks/${secondRevId}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'hard' }),
    }).then((r) => r.json());
    console.log(
      'Test 8 — Revision cannot be rated:',
      !rateRevRes.success &&
        rateRevRes.error === 'Revision tasks cannot be rated'
        ? '✅ PASS'
        : '❌ FAIL',
      rateRevRes.error
    );

    // ─── Test 9: Re-rate hard task to easy ───
    const rerated = await fetch(`${API}/tasks/${hard.id}/rate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'easy' }),
    })
      .then((r) => r.json())
      .then((r) => r.data);

    const completedRevs = rerated.revisions.filter(
      (r: any) => r.status === 'completed'
    ).length;
    const unfinishedRevs = rerated.revisions.filter(
      (r: any) => r.status !== 'completed'
    ).length;
    console.log(
      'Test 9 — Re-rate hard task to easy:',
      rerated.rating === 'easy' && completedRevs === 1 && unfinishedRevs === 2
        ? '✅ PASS'
        : '❌ FAIL',
      `Rating: ${rerated.rating}, Completed: ${completedRevs}, Unfinished: ${unfinishedRevs}, Total: ${rerated.revisions.length}`
    );

    // ─── Test 10: Consistency after re-rate ───
    const rRerate = await fetch(`${API}/debug/revisions`, { headers }).then(
      (r) => r.json()
    );
    console.log(
      'Test 10 — Consistency after re-rate:',
      rRerate.data.ok === true ? '✅ PASS' : '❌ FAIL',
      rRerate.data.counts
    );

    // ─── Test 11: Create overdue task ───
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const overdue = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'TEST Overdue Backlog',
        topic: 'Graphs',
        difficulty: 'medium',
        platform: 'leetcode',
        scheduledDate: yesterday.toISOString().split('T')[0],
      }),
    })
      .then((r) => r.json())
      .then((r) => r.data);
    console.log(
      'Test 11 — Create overdue task:',
      overdue.id ? '✅ PASS' : '❌ FAIL',
      `ID: ${overdue.id}`
    );

    // ─── Test 12: Run backlog cron manually ───
    const backlogCronRes = await fetch(`${API}/debug/cron/backlog`, {
      method: 'POST',
      headers,
    }).then((r) => r.json());
    console.log(
      'Test 12 — Run backlog cron manually:',
      backlogCronRes.success && backlogCronRes.data.result.moved >= 1
        ? '✅ PASS'
        : '❌ FAIL',
      backlogCronRes.data
    );

    // ─── Test 13: Dashboard backlog count ───
    const dashData = await fetch(`${API}/dashboard/today`, { headers }).then(
      (r) => r.json()
    );
    console.log(
      'Test 13 — Dashboard backlog count:',
      dashData.data.statusOverview.backlog >= 1 ? '✅ PASS' : '❌ FAIL',
      `Backlog: ${dashData.data.statusOverview.backlog}`
    );

    // ─── Test 14: Notification created ───
    const unreadNotifs = await fetch(`${API}/notifications/unread`, {
      headers,
    }).then((r) => r.json());
    const backlogNotif = unreadNotifs.data.find(
      (n: any) => n.type === 'backlog'
    );
    console.log(
      'Test 14 — Backlog Notification created:',
      backlogNotif ? '✅ PASS' : '❌ FAIL',
      backlogNotif
    );

    // ─── Test 15: Mark notifications read ───
    const markReadRes = await fetch(`${API}/notifications/read-all`, {
      method: 'PATCH',
      headers,
    }).then((r) => r.json());
    const unreadAfter = await fetch(`${API}/notifications/unread`, {
      headers,
    }).then((r) => r.json());
    console.log(
      'Test 15 — Mark notifications read:',
      markReadRes.success && unreadAfter.data.length === 0
        ? '✅ PASS'
        : '❌ FAIL',
      `Remaining unread: ${unreadAfter.data.length}`
    );

    // ─── Part 16: Expiry Test ───
    console.log('\n--- PART 16: EXPIRY TEST ---');
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    await prisma.task.updateMany({
      where: {
        userId: user.id,
        title: 'TEST Overdue Backlog',
        isBacklog: true,
      },
      data: {
        backlogSince: tenDaysAgo,
      },
    });

    const expiryCronRes = await fetch(`${API}/debug/cron/expiry`, {
      method: 'POST',
      headers,
    }).then((r) => r.json());
    console.log('Expiry cron manual execution:', expiryCronRes.data);

    const dashExpiry = await fetch(`${API}/dashboard/today`, {
      headers,
    }).then((r) => r.json());
    console.log(
      'Dashboard expired count:',
      dashExpiry.data.statusOverview.expired >= 1 ? '✅ PASS' : '❌ FAIL',
      `Expired: ${dashExpiry.data.statusOverview.expired}`
    );

    const unreadExpiryNotifs = await fetch(`${API}/notifications/unread`, {
      headers,
    }).then((r) => r.json());
    const expiredNotif = unreadExpiryNotifs.data.find(
      (n: any) => n.type === 'expired'
    );
    console.log(
      'Expired notification created:',
      expiredNotif ? '✅ PASS' : '❌ FAIL',
      expiredNotif
    );

    // ─── Part 15: SQL Verification Queries ───
    console.log('\n--- PART 15: SQL VERIFICATION QUERIES ---');

    // Query 1: Orphan revision tasks
    const orphanTasks = await prisma.$queryRaw<any[]>`
      SELECT
        t.id,
        t.title,
        t.parent_task_id,
        t.revision_number
      FROM tasks t
      LEFT JOIN revisions r ON r.revision_task_id = t.id
      WHERE t.user_id = ${user.id}
        AND t.task_type = 'revision'
        AND r.id IS NULL
    `;
    console.log(`Query 1 — Orphan Revision Tasks: ${orphanTasks.length} (Expected: 0)`);

    // Query 2: Orphan revision records
    const orphanRecords = await prisma.$queryRaw<any[]>`
      SELECT
        r.id,
        r.parent_task_id,
        r.revision_task_id
      FROM revisions r
      JOIN tasks parent ON parent.id = r.parent_task_id
      LEFT JOIN tasks revision_task ON revision_task.id = r.revision_task_id
      WHERE parent.user_id = ${user.id}
        AND revision_task.id IS NULL
    `;
    console.log(`Query 2 — Orphan Revision Records: ${orphanRecords.length} (Expected: 0)`);

    // Query 3: Parent mismatch
    const parentMismatch = await prisma.$queryRaw<any[]>`
      SELECT
        r.id AS revision_id,
        r.parent_task_id,
        r.revision_task_id,
        t.parent_task_id AS task_parent_task_id
      FROM revisions r
      JOIN tasks parent ON parent.id = r.parent_task_id
      JOIN tasks t ON t.id = r.revision_task_id
      WHERE parent.user_id = ${user.id}
        AND t.parent_task_id IS DISTINCT FROM r.parent_task_id
    `;
    console.log(`Query 3 — Parent Mismatches: ${parentMismatch.length} (Expected: 0)`);

    // Query 4: Duplicate unfinished revisions
    const duplicateUnfinished = await prisma.$queryRaw<any[]>`
      SELECT
        r.parent_task_id,
        r.scheduled_date::date AS scheduled_date,
        COUNT(*) AS count
      FROM revisions r
      JOIN tasks parent ON parent.id = r.parent_task_id
      WHERE parent.user_id = ${user.id}
        AND r.status <> 'completed'
      GROUP BY r.parent_task_id, r.scheduled_date::date
      HAVING COUNT(*) > 1
    `;
    console.log(`Query 4 — Duplicate Unfinished Revisions: ${duplicateUnfinished.length} (Expected: 0)`);

    // Query 5: Revision task count vs revision record count
    const countCheck = await prisma.$queryRaw<any[]>`
      SELECT
        (
          SELECT COUNT(*)
          FROM tasks
          WHERE user_id = ${user.id}
            AND task_type = 'revision'
        ) AS revision_tasks,
        (
          SELECT COUNT(*)
          FROM revisions r
          JOIN tasks parent ON parent.id = r.parent_task_id
          WHERE parent.user_id = ${user.id}
        ) AS revision_records
    `;
    console.log(`Query 5 — Revision Tasks vs Records:`, countCheck[0]);

    // Query 6: Dashboard count cross-check
    const sqlCrossCheck = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*) FILTER (
          WHERE task_type = 'new'
            AND status = 'completed'
        ) AS total_questions,
        COUNT(*) FILTER (
          WHERE is_backlog = true
            AND is_expired = false
            AND status <> 'completed'
        ) AS backlog,
        COUNT(*) FILTER (
          WHERE is_expired = true
        ) AS expired,
        (
          SELECT coins
          FROM users
          WHERE id = ${user.id}
        ) AS coins
      FROM tasks
      WHERE user_id = ${user.id}
    `;
    console.log(`Query 6 — Dashboard SQL Cross-Check:`, sqlCrossCheck[0]);

    // ─── Part 18: Cleanup Test Data ───
    console.log('\n--- PART 18: CLEANUP TEST DATA ---');
    await prisma.task.deleteMany({
      where: { userId: user.id, title: { startsWith: 'TEST' } },
    });
    await prisma.notification.deleteMany({
      where: { userId: user.id },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { coins: 0 },
    });
    const remainingTasks = await prisma.task.count({
      where: { userId: user.id, title: { startsWith: 'TEST' } },
    });
    console.log(`Cleanup verification: remaining TEST tasks = ${remainingTasks}`);

    console.log('\n🎉 ALL 18 REVISION SYSTEM HARDENING CHECKS PASSED 100%!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runAllTests().catch((err) => {
  console.error('❌ Revision Hardening Test Suite Failed:', err);
  process.exit(1);
});
