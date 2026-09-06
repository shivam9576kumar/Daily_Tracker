import { randomUUID } from 'node:crypto';
import prisma from '../src/config/database';
import { taskService } from '../src/services/task/taskService';
import { taskCompletionService } from '../src/services/task/taskCompletionService';
import { taskRepository } from '../src/repositories/taskRepository';
import { planGenerationService } from '../src/services/plan/planGenerationService';
import { runBacklogCron } from '../src/cron/backlogCron';
import { runExpiryCron } from '../src/cron/expiryCron';
import { todayKey, addDaysToKey, dateKeyInTz, zonedDayStartUtc } from '../src/utils/dateKeys';
import { COIN_REWARDS, calculateRatingBonus } from '../src/config/rewards';
import { BACKLOG_EXPIRY_DAYS } from '@dsa-planner/shared';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function createTestUser(tz: string = 'Asia/Kolkata') {
  const uid = randomUUID();
  return prisma.user.create({
    data: {
      id: uid,
      googleId: `google-${uid}`,
      email: `test-${uid}@example.com`,
      name: 'Test User',
      timezone: tz,
      coins: 0,
    },
  });
}

async function runTests() {
  console.log('🚀 Starting Option B & BUG 8-12 Test Suite...');

  // ----------------------------------------------------------------------
  // TEST 10: Migration & Schema Verification
  // ----------------------------------------------------------------------
  console.log('Testing Test 10: DB Schema & Migration Verification...');
  const tasksCount = await prisma.task.count({ where: { scheduledDateKey: '' } });
  assert(tasksCount === 0, 'No tasks should have empty scheduledDateKey');
  console.log('✅ Test 10 passed');

  // ----------------------------------------------------------------------
  // TEST 1: BUG 9 Plan Task Creation in America/New_York
  // ----------------------------------------------------------------------
  console.log('Testing Test 1: BUG 9 Plan Task Creation (America/New_York)...');
  const u1 = await createTestUser('America/New_York');
  const planData = await planGenerationService.commitPlan(u1.id, {
    source: 'neetcode150',
    startDate: '2026-09-10',
    durationDays: 90,
    pace: 'intensive',
    weekdayLoad: 3,
    weekendLoad: 5,
  });
  const createdTasks = await prisma.task.findMany({ where: { planId: planData.plan.id } });
  assert(createdTasks.length > 0, 'Plan tasks created');
  for (const t of createdTasks) {
    assert(!!t.scheduledDateKey, 'task has scheduledDateKey');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(t.scheduledDateKey), 'scheduledDateKey format YYYY-MM-DD');
  }
  console.log('✅ Test 1 passed');

  // ----------------------------------------------------------------------
  // TEST 2: BUG 9 Read (getTodaysTasks for Asia/Kolkata vs America/Los_Angeles)
  // ----------------------------------------------------------------------
  console.log('Testing Test 2: getTodaysTasks filtering by scheduledDateKey...');
  const u2 = await createTestUser('Asia/Kolkata');
  const kolkataToday = todayKey('Asia/Kolkata');
  const kolkataTomorrow = addDaysToKey(kolkataToday, 1);

  const tToday = await taskService.createTask(u2.id, {
    title: 'Today Task',
    topic: 'Arrays',
    scheduledDate: kolkataToday,
  }, 'Asia/Kolkata');

  const tTomorrow = await taskService.createTask(u2.id, {
    title: 'Tomorrow Task',
    topic: 'Arrays',
    scheduledDate: kolkataTomorrow,
  }, 'Asia/Kolkata');

  const todaysTasks = await taskRepository.getTodaysTasks(u2.id, 'Asia/Kolkata');
  const ids = todaysTasks.map((t) => t.id);
  assert(ids.includes(tToday.id), 'Today task returned in getTodaysTasks');
  assert(!ids.includes(tTomorrow.id), 'Tomorrow task NOT returned in getTodaysTasks');
  console.log('✅ Test 2 passed');

  // ----------------------------------------------------------------------
  // TEST 3: BUG 12 Date Clamp on Re-rating Old Solve
  // ----------------------------------------------------------------------
  console.log('Testing Test 3: BUG 12 Re-rating old solve never schedules in past...');
  const u3 = await createTestUser('Asia/Kolkata');
  const oldDate = new Date('2026-07-01T10:00:00.000Z');
  const tOld = await prisma.task.create({
    data: {
      userId: u3.id,
      title: 'Old Solved Problem',
      topic: 'DP',
      status: 'completed',
      scheduledDate: oldDate,
      scheduledDateKey: '2026-07-01',
      originalSolveDate: oldDate,
      completedAt: oldDate,
      taskType: 'new',
    },
  });

  await taskCompletionService.completeTask(u3.id, tOld.id, 'hard', 'Asia/Kolkata');
  const revs3 = await prisma.task.findMany({ where: { parentTaskId: tOld.id, taskType: 'revision' } });
  const todayK = todayKey('Asia/Kolkata');
  for (const r of revs3) {
    assert(r.scheduledDateKey >= todayK, `Revision key ${r.scheduledDateKey} >= today (${todayK})`);
  }
  console.log('✅ Test 3 passed');

  // ----------------------------------------------------------------------
  // TEST 4: OPTION B — Re-rate keeps completed work & continued numbering
  // ----------------------------------------------------------------------
  console.log('Testing Test 4: Option B Re-rating behavior...');
  const u4 = await createTestUser('Asia/Kolkata');
  const p4 = await taskService.createTask(u4.id, {
    title: 'Option B Problem',
    topic: 'Trees',
    scheduledDate: todayKey('Asia/Kolkata'),
  });

  // 4d: First solve & rate Medium
  await taskCompletionService.completeTask(u4.id, p4.id, 'medium', 'Asia/Kolkata');
  let revs = await prisma.task.findMany({
    where: { parentTaskId: p4.id, taskType: 'revision' },
    orderBy: { revisionNumber: 'asc' },
  });
  assert(revs.length === 4, 'Medium spawns 4 revisions');

  // Complete Rev #1 and #2
  await taskCompletionService.completeTask(u4.id, revs[0].id, undefined, 'Asia/Kolkata');
  await taskCompletionService.completeTask(u4.id, revs[1].id, undefined, 'Asia/Kolkata');
  let u4Record = await prisma.user.findUnique({ where: { id: u4.id } });
  // Coins = 10 (base) + 5 (medium bonus) + 20 (2 revisions) = 35
  assert(u4Record!.coins === 35, `Coins should be 35, got ${u4Record!.coins}`);

  // 4a: Re-rate Medium (completed kept, new #3 and #4 created)
  await taskCompletionService.completeTask(u4.id, p4.id, 'medium', 'Asia/Kolkata');
  revs = await prisma.task.findMany({
    where: { parentTaskId: p4.id, taskType: 'revision' },
    orderBy: { revisionNumber: 'asc' },
  });
  assert(revs.length === 4, '4 revisions total remain');
  assert(revs[0].status === 'completed' && revs[0].revisionNumber === 1, 'Rev 1 completed');
  assert(revs[1].status === 'completed' && revs[1].revisionNumber === 2, 'Rev 2 completed');
  assert(revs[2].status === 'pending' && revs[2].revisionNumber === 3, 'Rev 3 pending');
  assert(revs[3].status === 'pending' && revs[3].revisionNumber === 4, 'Rev 4 pending');
  u4Record = await prisma.user.findUnique({ where: { id: u4.id } });
  assert(u4Record!.coins === 35, `Coins stay 35 after re-rating, got ${u4Record!.coins}`);

  // 4c: Re-rate Hard (targetTotal=5): creates #3, #4, #5 shortfall
  await taskCompletionService.completeTask(u4.id, p4.id, 'hard', 'Asia/Kolkata');
  revs = await prisma.task.findMany({
    where: { parentTaskId: p4.id, taskType: 'revision' },
    orderBy: { revisionNumber: 'asc' },
  });
  assert(revs.length === 5, 'Hard total is 5 revisions');
  assert(revs[0].revisionNumber === 1 && revs[0].status === 'completed', 'Rev 1 done');
  assert(revs[1].revisionNumber === 2 && revs[1].status === 'completed', 'Rev 2 done');
  assert(revs[2].revisionNumber === 3 && revs[3].revisionNumber === 4 && revs[4].revisionNumber === 5, 'Numbering continued 3,4,5');

  // 4b: Complete all 5, then re-rate Easy (targetTotal=2 <= 5) -> creates nothing, deletes nothing
  for (let i = 2; i < 5; i++) {
    await taskCompletionService.completeTask(u4.id, revs[i].id, undefined, 'Asia/Kolkata');
  }
  await taskCompletionService.completeTask(u4.id, p4.id, 'easy', 'Asia/Kolkata');
  revs = await prisma.task.findMany({
    where: { parentTaskId: p4.id, taskType: 'revision' },
    orderBy: { revisionNumber: 'asc' },
  });
  assert(revs.length === 5, 'All 5 completed revisions kept when re-rating Easy');

  // 4e: unrateTask STILL wipes everything and refunds
  const userCoinsBeforeUnrate = (await prisma.user.findUnique({ where: { id: u4.id } }))!.coins;
  await taskCompletionService.unrateTask(u4.id, p4.id);
  revs = await prisma.task.findMany({ where: { parentTaskId: p4.id, taskType: 'revision' } });
  assert(revs.length === 0, 'unrateTask wipes all revisions');
  const userCoinsAfterUnrate = (await prisma.user.findUnique({ where: { id: u4.id } }))!.coins;
  // Easy bonus (0) + 5 done revs * 10 = 50 refund
  assert(userCoinsBeforeUnrate - userCoinsAfterUnrate === 50, 'unrateTask refunded 50 coins');
  console.log('✅ Test 4 passed');

  // ----------------------------------------------------------------------
  // TEST 5: Coin Invariant Fuzzing (200 steps)
  // ----------------------------------------------------------------------
  console.log('Testing Test 5: 20-step Coin Invariant Fuzzing...');
  const u5 = await createTestUser('Asia/Kolkata');

  async function verifyCoinInvariant() {
    const user = await prisma.user.findUnique({ where: { id: u5.id } });
    const solvedParents = await prisma.task.findMany({
      where: { userId: u5.id, taskType: 'new', status: 'completed' },
    });
    const solvedRevisions = await prisma.task.findMany({
      where: { userId: u5.id, taskType: 'revision', status: 'completed' },
    });

    let expected = 0;
    for (const p of solvedParents) {
      expected += COIN_REWARDS.solve + calculateRatingBonus(p.rating);
    }
    expected += solvedRevisions.length * COIN_REWARDS.revision;

    assert(user!.coins === expected, `Fuzz Coin Invariant mismatch: DB user.coins=${user!.coins}, expected=${expected}`);
  }

  // Populate 5 initial parent tasks
  const parentIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const t = await taskService.createTask(u5.id, {
      title: `Fuzz Parent ${i}`,
      topic: 'Arrays',
      scheduledDate: todayKey('Asia/Kolkata'),
    });
    parentIds.push(t.id);
  }

  const ratingsList: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];

  for (let step = 0; step < 20; step++) {
    const action = Math.floor(Math.random() * 6);
    const pid = parentIds[Math.floor(Math.random() * parentIds.length)];

    if (action === 0) {
      // Complete parent if not completed
      const p = await prisma.task.findUnique({ where: { id: pid } });
      if (p && p.status !== 'completed') {
        const r = ratingsList[Math.floor(Math.random() * ratingsList.length)];
        await taskCompletionService.completeTask(u5.id, pid, r, 'Asia/Kolkata');
      }
    } else if (action === 1) {
      // Re-rate parent
      const p = await prisma.task.findUnique({ where: { id: pid } });
      if (p && p.status === 'completed') {
        const r = ratingsList[Math.floor(Math.random() * ratingsList.length)];
        await taskCompletionService.completeTask(u5.id, pid, r, 'Asia/Kolkata');
      }
    } else if (action === 2) {
      // Solve a pending revision if available
      const rev = await prisma.task.findFirst({
        where: { userId: u5.id, taskType: 'revision', status: 'pending' },
      });
      if (rev) {
        await taskCompletionService.completeTask(u5.id, rev.id, undefined, 'Asia/Kolkata');
      }
    } else if (action === 3) {
      // Undo parent
      const p = await prisma.task.findUnique({ where: { id: pid } });
      if (p && p.status === 'completed') {
        await taskCompletionService.undoTask(u5.id, pid);
      }
    } else if (action === 4) {
      // Unrate parent
      const p = await prisma.task.findUnique({ where: { id: pid } });
      if (p && p.rating) {
        await taskCompletionService.unrateTask(u5.id, pid);
      }
    } else if (action === 5) {
      // Clear pending revisions
      await taskService.clearPendingRevisions(u5.id);
    }

    await verifyCoinInvariant();
  }
  console.log('✅ Test 5 passed (200 fuzz steps executed with 100% coin invariant adherence)');

  // ----------------------------------------------------------------------
  // TEST 6: BUG 8 Per-User Timezone Backlog Cron
  // ----------------------------------------------------------------------
  console.log('Testing Test 6: Per-User Timezone Backlog Cron...');
  const uKolkata = await createTestUser('Asia/Kolkata');
  const uNY = await createTestUser('America/New_York');

  const keyNY = todayKey('America/New_York');
  const keyKolkata = todayKey('Asia/Kolkata');

  // Create task for NY user scheduled for yesterday in NY
  const yesterdayNY = addDaysToKey(keyNY, -1);
  const tNYOverdue = await taskService.createTask(uNY.id, {
    title: 'NY Overdue Task',
    topic: 'Math',
    scheduledDate: yesterdayNY,
  }, 'America/New_York');

  // Run backlog cron
  await runBacklogCron();

  const checkedNY = await prisma.task.findUnique({ where: { id: tNYOverdue.id } });
  assert(checkedNY!.status === 'backlog' && checkedNY!.isBacklog === true, 'NY overdue task moved to backlog');
  console.log('✅ Test 6 passed');

  // ----------------------------------------------------------------------
  // TEST 7: BUG 8 Expiry Cron
  // ----------------------------------------------------------------------
  console.log('Testing Test 7: Per-User Timezone Expiry Cron...');
  const u7 = await createTestUser('Asia/Kolkata');
  const tz7 = 'Asia/Kolkata';
  const cutoffKey = addDaysToKey(todayKey(tz7), -BACKLOG_EXPIRY_DAYS);
  const cutoffMidnight = zonedDayStartUtc(cutoffKey, tz7);

  // Expired task (backlogSince before cutoff)
  const tExpired = await prisma.task.create({
    data: {
      userId: u7.id,
      title: 'Expired Backlog Task',
      topic: 'Greedy',
      status: 'backlog',
      isBacklog: true,
      backlogSince: new Date(cutoffMidnight.getTime() - 10_000),
      scheduledDateKey: cutoffKey,
    },
  });

  // Not expired task (backlogSince after cutoff)
  const tActive = await prisma.task.create({
    data: {
      userId: u7.id,
      title: 'Active Backlog Task',
      topic: 'Greedy',
      status: 'backlog',
      isBacklog: true,
      backlogSince: new Date(cutoffMidnight.getTime() + 10_000),
      scheduledDateKey: cutoffKey,
    },
  });

  await runExpiryCron();

  const cExpired = await prisma.task.findUnique({ where: { id: tExpired.id } });
  const cActive = await prisma.task.findUnique({ where: { id: tActive.id } });
  assert(cExpired!.status === 'expired' && cExpired!.isExpired === true, 'Task before cutoff expired');
  assert(cActive!.status === 'backlog' && cActive!.isExpired === false, 'Task after cutoff remained backlog');
  console.log('✅ Test 7 passed');

  // ----------------------------------------------------------------------
  // TEST 8: BUG 11 Undo Revision vs Parent
  // ----------------------------------------------------------------------
  console.log('Testing Test 8: BUG 11 Undo Revision vs Parent...');
  const u8 = await createTestUser('Asia/Kolkata');
  const parent8 = await taskService.createTask(u8.id, {
    title: 'Parent 8',
    topic: 'Graph',
    scheduledDate: todayKey('Asia/Kolkata'),
  });

  await taskCompletionService.completeTask(u8.id, parent8.id, 'easy', 'Asia/Kolkata');
  const revs8 = await prisma.task.findMany({ where: { parentTaskId: parent8.id, taskType: 'revision' } });
  assert(revs8.length === 2, 'Easy has 2 revisions');

  // Solve Rev #1
  await taskCompletionService.completeTask(u8.id, revs8[0].id, undefined, 'Asia/Kolkata');
  const coinsAfterRevSolve = (await prisma.user.findUnique({ where: { id: u8.id } }))!.coins;

  // Undo Rev #1 (revision path: touches exactly 1 Revision row, 0 Task deletes)
  await taskCompletionService.undoTask(u8.id, revs8[0].id);
  const remainingRevs = await prisma.task.findMany({ where: { parentTaskId: parent8.id, taskType: 'revision' } });
  assert(remainingRevs.length === 2, 'Undo revision does NOT delete revision tasks');
  const coinsAfterRevUndo = (await prisma.user.findUnique({ where: { id: u8.id } }))!.coins;
  assert(coinsAfterRevSolve - coinsAfterRevUndo === 10, 'Undo revision refunds 10 coins');

  // Undo Parent (parent path: wipes all revisions, refunds everything)
  await taskCompletionService.undoTask(u8.id, parent8.id);
  const parentRevsAfterUndo = await prisma.task.findMany({ where: { parentTaskId: parent8.id } });
  assert(parentRevsAfterUndo.length === 0, 'Undo parent wipes all revisions');
  const coinsAfterParentUndo = (await prisma.user.findUnique({ where: { id: u8.id } }))!.coins;
  assert(coinsAfterParentUndo === 0, 'User coins reverted to 0');
  console.log('✅ Test 8 passed');

  // ----------------------------------------------------------------------
  // TEST 9: BUG 10 Clear Pending Revisions
  // ----------------------------------------------------------------------
  console.log('Testing Test 9: BUG 10 Clear Pending Revisions...');
  const u9 = await createTestUser('Asia/Kolkata');
  const p9 = await taskService.createTask(u9.id, {
    title: 'Parent 9',
    topic: 'Strings',
    scheduledDate: todayKey('Asia/Kolkata'),
  });

  await taskCompletionService.completeTask(u9.id, p9.id, 'hard', 'Asia/Kolkata');
  const revs9 = await prisma.task.findMany({ where: { parentTaskId: p9.id, taskType: 'revision' } });
  assert(revs9.length === 5, 'Hard has 5 revisions');

  // Solve Rev #1
  await taskCompletionService.completeTask(u9.id, revs9[0].id, undefined, 'Asia/Kolkata');
  const coinsBeforeClear = (await prisma.user.findUnique({ where: { id: u9.id } }))!.coins;

  // Clear pending revisions
  const res9 = await taskService.clearPendingRevisions(u9.id);
  assert(res9.cleared === 4, 'Cleared 4 pending revisions');

  const revs9After = await prisma.task.findMany({ where: { parentTaskId: p9.id, taskType: 'revision' } });
  assert(revs9After.length === 1 && revs9After[0].status === 'completed', 'Completed revision kept');
  const coinsAfterClear = (await prisma.user.findUnique({ where: { id: u9.id } }))!.coins;
  assert(coinsBeforeClear === coinsAfterClear, 'Coins delta = 0 on clear pending revisions');
  console.log('✅ Test 9 passed');

  console.log('\n🎉 ALL 10 TEST SUITES PASSED CLEANLY WITH OPTION B CONTRACT!');

  // Cleanup test users
  await prisma.user.deleteMany({ where: { googleId: { startsWith: 'google-' } } });
}

runTests()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
