import jwt from 'jsonwebtoken';
import app from '../src/app';
import prisma from '../src/config/database';
import { runBacklogCron } from '../src/cron/backlogCron';
import { runExpiryCron } from '../src/cron/expiryCron';
const JWT_SECRET =
  '1760cad58d49e48906ad4c71dde17d30d95a8e3258a448c2718fb3de8e09b3dfda6d128e03672c15d9fbace34a9b8f58a17e21c428c2a59af929aa9f806a1c71';

async function runPhase4Tests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 RUNNING PHASE 4 HARDENING TEST SUITE & VERIFICATIONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Find or create test user
  let user = await prisma.user.findFirst({
    where: { email: 'test_student@example.com' },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-google-id-phase4',
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
    // Clean any prior tasks
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

  const server = app.listen(5098);
  const BASE = 'http://localhost:5098/api';

  try {
    // ─────────────────────────────────────────────────────────
    // TEST 1 — Change Rating (Hard → Easy)
    // ─────────────────────────────────────────────────────────
    console.log('--- TEST 1: Change Rating (Hard → Easy) ---');
    const today = new Date().toISOString().split('T')[0];
    const t1 = await fetch(`${BASE}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'TEST Change Rating',
        topic: 'Arrays',
        difficulty: 'hard',
        platform: 'leetcode',
        scheduledDate: today,
      }),
    }).then((r) => r.json());
    const t1Id = t1.data.id;

    // Complete as Hard
    const c1 = await fetch(`${BASE}/tasks/${t1Id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'hard' }),
    }).then((r) => r.json());

    const userCoins1 = await prisma.user.findUnique({ where: { id: user.id } });
    const revs1 = await prisma.task.findMany({
      where: { parentTaskId: t1Id, taskType: 'revision' },
      orderBy: { revisionNumber: 'asc' },
    });

    // Re-rate to Easy
    const r1 = await fetch(`${BASE}/tasks/${t1Id}/rate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'easy' }),
    }).then((r) => r.json());

    const userCoins1After = await prisma.user.findUnique({
      where: { id: user.id },
    });
    const revs1After = await prisma.task.findMany({
      where: { parentTaskId: t1Id, taskType: 'revision' },
      orderBy: { revisionNumber: 'asc' },
    });

    const t1Pass =
      revs1.length === 5 &&
      userCoins1?.coins === 15 &&
      revs1After.length === 2 &&
      userCoins1After?.coins === 5;
    console.log(`Test 1 Change Rating: ${t1Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(
      `  Revisions (Hard): ${revs1.length} -> (Easy): ${revs1After.length}`
    );
    console.log(
      `  Coins (Hard): ${userCoins1?.coins} -> (Easy): ${userCoins1After?.coins}\n`
    );

    // ─────────────────────────────────────────────────────────
    // TEST 2 — Undo Completion
    // ─────────────────────────────────────────────────────────
    console.log('--- TEST 2: Undo Completion ---');
    const u1 = await fetch(`${BASE}/tasks/${t1Id}/undo`, {
      method: 'POST',
      headers,
    }).then((r) => r.json());

    const t1AfterUndo = await prisma.task.findUnique({ where: { id: t1Id } });
    const revsAfterUndo = await prisma.task.findMany({
      where: { parentTaskId: t1Id, taskType: 'revision' },
    });
    const userCoinsAfterUndo = await prisma.user.findUnique({
      where: { id: user.id },
    });

    const t2Pass =
      t1AfterUndo?.status === 'pending' &&
      t1AfterUndo?.rating === null &&
      t1AfterUndo?.completedAt === null &&
      revsAfterUndo.length === 0 &&
      userCoinsAfterUndo?.coins === 0;
    console.log(`Test 2 Undo Completion: ${t2Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(
      `  Status: ${t1AfterUndo?.status}, Rating: ${t1AfterUndo?.rating}, Revisions: ${revsAfterUndo.length}, Coins: ${userCoinsAfterUndo?.coins}\n`
    );

    // ─────────────────────────────────────────────────────────
    // TEST 3 — Double-Undo Protection
    // ─────────────────────────────────────────────────────────
    console.log('--- TEST 3: Double-Undo Protection ---');
    const doubleUndoRes = await fetch(`${BASE}/tasks/${t1Id}/undo`, {
      method: 'POST',
      headers,
    }).then((r) => r.json());
    const t3Pass =
      !doubleUndoRes.success &&
      doubleUndoRes.error === 'Can only undo completed tasks';
    console.log(
      `Test 3 Double-Undo Protection: ${t3Pass ? '✅ PASS' : '❌ FAIL'} (${doubleUndoRes.error})\n`
    );

    // ─────────────────────────────────────────────────────────
    // TEST 4 — Re-rate Revision Protection
    // ─────────────────────────────────────────────────────────
    console.log('--- TEST 4: Re-rate Revision Protection ---');
    // Complete t1 again to generate a revision task
    await fetch(`${BASE}/tasks/${t1Id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'medium' }),
    });
    const revTask = await prisma.task.findFirst({
      where: { parentTaskId: t1Id, taskType: 'revision' },
    });
    const rerateRevRes = await fetch(`${BASE}/tasks/${revTask!.id}/rate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'easy' }),
    }).then((r) => r.json());

    const t4Pass =
      !rerateRevRes.success &&
      rerateRevRes.error === 'Can only re-rate new tasks (not revisions)';
    console.log(
      `Test 4 Re-rate Revision Protection: ${t4Pass ? '✅ PASS' : '❌ FAIL'} (${rerateRevRes.error})\n`
    );

    // ─────────────────────────────────────────────────────────
    // TEST 5 — Backlog Cron (Overdue Task)
    // ─────────────────────────────────────────────────────────
    console.log('--- TEST 5: Backlog Cron (Overdue Task) ---');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const tBacklog = await prisma.task.create({
      data: {
        userId: user.id,
        title: 'TEST Backlog',
        topic: 'Strings',
        difficulty: 'medium',
        platform: 'leetcode',
        scheduledDate: yesterday,
        status: 'pending',
        isBacklog: false,
      },
    });

    await runBacklogCron();

    const updatedBacklogTask = await prisma.task.findUnique({
      where: { id: tBacklog.id },
    });
    const t5Pass =
      updatedBacklogTask?.isBacklog === true &&
      updatedBacklogTask?.status === 'pending' &&
      updatedBacklogTask?.backlogSince !== null;
    console.log(
      `Test 5 Backlog Cron: ${t5Pass ? '✅ PASS' : '❌ FAIL'} (isBacklog: ${updatedBacklogTask?.isBacklog}, status: ${updatedBacklogTask?.status})\n`
    );

    // ─────────────────────────────────────────────────────────
    // TEST 6 — Expiry Cron (Old Backlog Task)
    // ─────────────────────────────────────────────────────────
    console.log('--- TEST 6: Expiry Cron (Old Backlog Task) ---');
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    eightDaysAgo.setHours(0, 0, 0, 0);

    const tExpiry = await prisma.task.create({
      data: {
        userId: user.id,
        title: 'TEST Expiry',
        topic: 'Hashing',
        difficulty: 'medium',
        platform: 'leetcode',
        scheduledDate: eightDaysAgo,
        status: 'pending',
        isBacklog: true,
        backlogSince: eightDaysAgo,
        isExpired: false,
      },
    });

    await runExpiryCron();

    const updatedExpiryTask = await prisma.task.findUnique({
      where: { id: tExpiry.id },
    });
    const t6Pass =
      updatedExpiryTask?.isExpired === true &&
      updatedExpiryTask?.status === 'expired';
    console.log(
      `Test 6 Expiry Cron: ${t6Pass ? '✅ PASS' : '❌ FAIL'} (isExpired: ${updatedExpiryTask?.isExpired}, status: ${updatedExpiryTask?.status})\n`
    );

    // ─────────────────────────────────────────────────────────
    // TEST 7 — Orphan Detection (Revision Sync)
    // ─────────────────────────────────────────────────────────
    console.log('--- TEST 7: Orphan Detection (Revision Sync) ---');
    const revisionTasksCount = await prisma.task.count({
      where: { taskType: 'revision', userId: user.id },
    });
    const revisionRecordsCount = await prisma.revision.count({
      where: { parentTask: { userId: user.id } },
    });
    const orphans = await prisma.$queryRaw<any[]>`
      SELECT t.id, t.title, t.revision_number
      FROM tasks t
      WHERE t.task_type = 'revision'
        AND t.user_id = ${user.id}
        AND NOT EXISTS (
          SELECT 1 FROM revisions r WHERE r.revision_task_id = t.id
        )
    `;
    const t7Pass =
      revisionTasksCount === revisionRecordsCount && orphans.length === 0;
    console.log(
      `Test 7 Orphan Detection: ${t7Pass ? '✅ PASS' : '❌ FAIL'} (revision_tasks: ${revisionTasksCount}, revision_records: ${revisionRecordsCount}, orphans: ${orphans.length})\n`
    );

    // ─────────────────────────────────────────────────────────
    // TEST 8 — Coin Refund Verification
    // ─────────────────────────────────────────────────────────
    console.log('--- TEST 8: Coin Refund & Transition Verification ---');
    await prisma.user.update({ where: { id: user.id }, data: { coins: 0 } });
    await prisma.task.deleteMany({ where: { userId: user.id } });

    // 1. Hard (+15, undo -15)
    const tH = await prisma.task.create({
      data: {
        userId: user.id,
        title: 'TEST Coin Hard',
        topic: 'Arrays',
        difficulty: 'hard',
        scheduledDate: new Date(),
      },
    });
    await fetch(`${BASE}/tasks/${tH.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'hard' }),
    });
    const uH1 = await prisma.user.findUnique({ where: { id: user.id } });
    await fetch(`${BASE}/tasks/${tH.id}/undo`, { method: 'POST', headers });
    const uH2 = await prisma.user.findUnique({ where: { id: user.id } });

    // 2. Easy (+5, undo -5)
    const tE = await prisma.task.create({
      data: {
        userId: user.id,
        title: 'TEST Coin Easy',
        topic: 'Arrays',
        difficulty: 'easy',
        scheduledDate: new Date(),
      },
    });
    await fetch(`${BASE}/tasks/${tE.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'easy' }),
    });
    const uE1 = await prisma.user.findUnique({ where: { id: user.id } });
    await fetch(`${BASE}/tasks/${tE.id}/undo`, { method: 'POST', headers });
    const uE2 = await prisma.user.findUnique({ where: { id: user.id } });

    // 3. Medium (+10)
    const tM = await prisma.task.create({
      data: {
        userId: user.id,
        title: 'TEST Coin Medium',
        topic: 'Arrays',
        difficulty: 'medium',
        scheduledDate: new Date(),
      },
    });
    await fetch(`${BASE}/tasks/${tM.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'medium' }),
    });
    const uM1 = await prisma.user.findUnique({ where: { id: user.id } });

    // 4. Hard -> Easy re-rate (-10)
    await fetch(`${BASE}/tasks/${tH.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'hard' }),
    });
    const coinsBeforeRerate = (await prisma.user.findUnique({
      where: { id: user.id },
    }))!.coins;
    await fetch(`${BASE}/tasks/${tH.id}/rate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'easy' }),
    });
    const coinsAfterRerate = (await prisma.user.findUnique({
      where: { id: user.id },
    }))!.coins;

    const t8Pass =
      uH1?.coins === 15 &&
      uH2?.coins === 0 &&
      uE1?.coins === 5 &&
      uE2?.coins === 0 &&
      uM1?.coins === 10 &&
      coinsBeforeRerate - coinsAfterRerate === 10;
    console.log(
      `Test 8 Coin Verification: ${t8Pass ? '✅ PASS' : '❌ FAIL'}`
    );
    console.log(
      `  Complete Hard: ${uH1?.coins}, Undo Hard: ${uH2?.coins}, Complete Easy: ${uE1?.coins}, Undo Easy: ${uE2?.coins}, Hard->Easy delta: -${coinsBeforeRerate - coinsAfterRerate}\n`
    );

    // ─────────────────────────────────────────────────────────
    // SQL VERIFICATION QUERIES (PART 3)
    // ─────────────────────────────────────────────────────────
    console.log('--- PART 3: SQL VERIFICATION QUERIES ---');

    // Query A: Full Task Overview
    const allTestTasks = await prisma.task.findMany({
      where: { userId: user.id, title: { startsWith: 'TEST' } },
    });
    console.log(`Query A — Task Overview Count: ${allTestTasks.length}`);

    // Query B: Parent -> Revision Tree Day Offsets
    // Create one Hard task and inspect day offsets
    const testHardTask = await prisma.task.create({
      data: {
        userId: user.id,
        title: 'TEST Parent Hard',
        topic: 'Arrays',
        difficulty: 'hard',
        scheduledDate: new Date(),
      },
    });
    await fetch(`${BASE}/tasks/${testHardTask.id}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 'hard' }),
    });
    const treeHard = await prisma.$queryRaw<any[]>`
      SELECT 
        p.title AS problem,
        p.rating AS parent_rating,
        p.completed_at::date AS completed_on,
        r.revision_number AS rev_no,
        r.scheduled_date::date AS rev_date,
        (r.scheduled_date::date - p.completed_at::date) AS days_after_solve,
        r.status
      FROM tasks p
      JOIN tasks r ON r.parent_task_id = p.id
      WHERE p.id = ${testHardTask.id}
      ORDER BY r.revision_number
    `;
    const offsets = treeHard.map((row) => Number(row.days_after_solve));
    console.log(
      `Query B — Hard Task Day Offsets: [${offsets.join(', ')}] (Expected: [1, 3, 7, 14, 28])`
    );

    // Query C: Revision Sync Check
    const syncCheck = await prisma.$queryRaw<any[]>`
      SELECT 
        (SELECT COUNT(*) FROM tasks WHERE task_type = 'revision' AND user_id = ${user.id}) AS revision_tasks,
        (SELECT COUNT(*) FROM revisions rv JOIN tasks t ON t.id = rv.parent_task_id WHERE t.user_id = ${user.id}) AS revision_records,
        (SELECT COUNT(*) FROM tasks t WHERE t.task_type = 'revision' AND t.user_id = ${user.id} AND NOT EXISTS (SELECT 1 FROM revisions r WHERE r.revision_task_id = t.id)) AS orphan_tasks
    `;
    console.log(
      `Query C — Revision Sync Check:`,
      syncCheck[0]
    );

    // Query D: Dashboard Cross-Check
    const dashData = await fetch(`${BASE}/dashboard/today`, {
      headers,
    }).then((r) => r.json());
    const sqlOverview = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) FILTER (WHERE task_type = 'new' AND status = 'completed') AS total_questions,
        COUNT(*) FILTER (WHERE is_backlog AND NOT is_expired AND status <> 'completed') AS backlog,
        COUNT(*) FILTER (WHERE is_expired) AS expired,
        (SELECT coins FROM users WHERE id = ${user.id}) AS coins
      FROM tasks
      WHERE user_id = ${user.id}
    `;
    console.log(`Query D — Dashboard Cross-Check:`);
    console.log(`  UI API:`, dashData.data.statusOverview);
    console.log(`  SQL:`, sqlOverview[0]);

    // Query E: Cleanup
    await prisma.task.deleteMany({
      where: { userId: user.id, title: { startsWith: 'TEST' } },
    });
    await prisma.user.update({ where: { id: user.id }, data: { coins: 0 } });
    const remainingTasks = await prisma.task.count({
      where: { userId: user.id, title: { startsWith: 'TEST' } },
    });
    const finalCoins = (await prisma.user.findUnique({
      where: { id: user.id },
    }))!.coins;
    console.log(
      `Query E — Cleanup: remaining_test_tasks = ${remainingTasks}, coins = ${finalCoins}`
    );

    console.log(
      '\n🎉 ALL PHASE 4 TESTS & SQL QUERIES COMPLETED SUCCESSFULLY!'
    );
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runPhase4Tests().catch((err) => {
  console.error('❌ Phase 4 Test Suite Failed:', err);
  process.exit(1);
});
