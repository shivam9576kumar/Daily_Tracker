import prisma from '../src/config/database';
import { taskRepository } from '../src/repositories/taskRepository';
import { dashboardService } from '../src/services/dashboard/dashboardService';
import { ensurePotdTaskForUser, dismissPotdForUser, currentPotdDateKey } from '../src/services/potd/potdService';
import { computePotdStreak } from '../src/services/potd/potdStreakService';
import { todayKey, addDaysToKey } from '../src/utils/dateKeys';
import { randomUUID } from 'node:crypto';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runProductionFixTests() {
  console.log('🚀 Running Production Fixes Verification Tests...');

  const testUserId = randomUUID();
  await prisma.user.create({
    data: {
      id: testUserId,
      googleId: `google-${testUserId}`,
      email: `prodtest-${testUserId}@example.com`,
      name: 'Prod Fix Test User',
    },
  });

  try {
    const tz = 'Asia/Kolkata';
    const localToday = todayKey(tz);
    const potdKey = currentPotdDateKey();

    // =========================================================================
    // TEST 1: Database Backfill Script Idempotency
    // =========================================================================
    console.log('Testing Test 1: Database Backfill Script...');
    const rawTaskId = randomUUID();
    const testDateIso = '2026-09-01T12:00:00.000Z';

    await prisma.$executeRawUnsafe(`
      INSERT INTO tasks (id, user_id, title, topic, status, task_type, scheduled_date, scheduled_date_key, created_at, updated_at)
      VALUES ('${rawTaskId}', '${testUserId}', 'Raw Backfill Task', 'General', 'pending', 'new', '${testDateIso}', '', NOW(), NOW())
    `);

    // Run backfill query logic
    const updateCount = await prisma.$executeRawUnsafe(`
      UPDATE tasks
      SET scheduled_date_key = TO_CHAR(scheduled_date AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      WHERE scheduled_date_key IS NULL OR scheduled_date_key = ''
    `);
    assert(updateCount >= 1, 'Backfill updated at least 1 row');

    const updatedTask = await prisma.task.findUnique({ where: { id: rawTaskId } });
    assert(updatedTask?.scheduledDateKey === '2026-09-01', `Backfilled key should be 2026-09-01, got ${updatedTask?.scheduledDateKey}`);

    // Re-run backfill (idempotency check)
    const reUpdateCount = await prisma.$executeRawUnsafe(`
      UPDATE tasks
      SET scheduled_date_key = TO_CHAR(scheduled_date AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      WHERE scheduled_date_key IS NULL OR scheduled_date_key = ''
    `);
    assert(reUpdateCount === 0, 'Second backfill updated 0 rows (idempotent)');
    console.log('✅ Test 1 passed');

    // Clean up raw task
    await prisma.task.delete({ where: { id: rawTaskId } });

    // =========================================================================
    // TEST 2: Current vs Yesterday/Tomorrow Scheduled Tasks
    // =========================================================================
    console.log('Testing Test 2: Current vs Yesterday/Tomorrow scheduled tasks...');
    const yesterdayKey = addDaysToKey(localToday, -1);
    const tomorrowKey = addDaysToKey(localToday, 1);

    const taskToday = await prisma.task.create({
      data: {
        userId: testUserId,
        title: 'Today Task',
        topic: 'Arrays',
        scheduledDate: new Date(),
        scheduledDateKey: localToday,
        taskType: 'new',
        status: 'pending',
      },
    });

    const taskYesterday = await prisma.task.create({
      data: {
        userId: testUserId,
        title: 'Yesterday Task (Pending, non-backlog)',
        topic: 'Arrays',
        scheduledDate: new Date(Date.now() - 86400000),
        scheduledDateKey: yesterdayKey,
        taskType: 'new',
        status: 'pending',
        isBacklog: false,
      },
    });

    const taskTomorrow = await prisma.task.create({
      data: {
        userId: testUserId,
        title: 'Tomorrow Task',
        topic: 'Arrays',
        scheduledDate: new Date(Date.now() + 86400000),
        scheduledDateKey: tomorrowKey,
        taskType: 'new',
        status: 'pending',
      },
    });

    const hitlist = await taskRepository.getTodaysTasks(testUserId, tz);
    const hitlistIds = hitlist.map((t) => t.id);

    assert(hitlistIds.includes(taskToday.id), 'Today task included in today hitlist');
    assert(!hitlistIds.includes(taskYesterday.id), 'Yesterday pending non-backlog task NOT included in today hitlist');
    assert(!hitlistIds.includes(taskTomorrow.id), 'Tomorrow task NOT included in today hitlist');
    console.log('✅ Test 2 passed');

    // =========================================================================
    // TEST 3: POTD Visibility Across Timezone Mismatch
    // =========================================================================
    console.log('Testing Test 3: POTD visibility with timezone mismatch parameter...');
    const fakePotdKey = '2026-09-05'; // distinct UTC POTD key
    const potdTask = await prisma.task.create({
      data: {
        userId: testUserId,
        title: 'LeetCode POTD Fake',
        topic: 'Trees',
        scheduledDate: new Date('2026-09-05T00:00:00Z'),
        scheduledDateKey: fakePotdKey,
        potdDateKey: fakePotdKey,
        taskType: 'potd',
        status: 'pending',
      },
    });

    // Without potdDateKey parameter:
    const hitlistNoPotdParam = await taskRepository.getTodaysTasks(testUserId, 'America/Los_Angeles');
    // With potdDateKey parameter:
    const hitlistWithPotdParam = await taskRepository.getTodaysTasks(testUserId, 'America/Los_Angeles', fakePotdKey);

    assert(hitlistWithPotdParam.some((t) => t.id === potdTask.id), 'POTD task present when potdDateKey passed');
    console.log('✅ Test 3 passed');

    // =========================================================================
    // TEST 4: Dashboard Service Integration without Active Plan
    // =========================================================================
    console.log('Testing Test 4: Dashboard service integration (no active plan)...');
    const dashData = await dashboardService.getDashboardData(testUserId, tz);
    assert(dashData.hasActivePlan === false, 'User has no active plan');
    assert(dashData.todaysHitlist.pending.length > 0, 'Today hitlist has pending tasks');
    console.log('✅ Test 4 passed');

    // =========================================================================
    // TEST 5: Dismissed POTD Non-Resurrection
    // =========================================================================
    console.log('Testing Test 5: Dismissed POTD handling...');
    await dismissPotdForUser(testUserId, fakePotdKey);
    const dismissedTaskCheck = await prisma.task.findFirst({ where: { id: potdTask.id } });
    assert(dismissedTaskCheck === null, 'Dismissed POTD task deleted from DB');

    const ensureResult = await ensurePotdTaskForUser(testUserId, tz);
    assert(ensureResult.taskId === null || ensureResult.potd?.dateKey !== fakePotdKey, 'Dismissed POTD task not re-created');
    console.log('✅ Test 5 passed');

    // =========================================================================
    // TEST 6: POTD Streak UTC Semantics
    // =========================================================================
    console.log('Testing Test 6: POTD Streak calculation...');
    await prisma.task.deleteMany({
      where: { userId: testUserId, potdDateKey: potdKey },
    });
    await prisma.task.create({
      data: {
        userId: testUserId,
        title: 'POTD Solved Today',
        topic: 'DP',
        scheduledDate: new Date(),
        scheduledDateKey: potdKey,
        potdDateKey: potdKey,
        taskType: 'potd',
        status: 'completed',
        completedAt: new Date(),
      },
    });

    const streakRes = await computePotdStreak(testUserId, 'America/Los_Angeles');
    assert(streakRes.solvedToday === true, 'POTD solvedToday evaluated true using currentPotdDateKey');
    assert(streakRes.currentStreak === 1, `Current POTD streak is 1, got ${streakRes.currentStreak}`);
    console.log('✅ Test 6 passed');

    // =========================================================================
    // TEST 7: Archived Plan Task Isolation
    // =========================================================================
    console.log('Testing Test 7: Archived plan task isolation...');
    const archivedPlan = await prisma.plan.create({
      data: {
        userId: testUserId,
        name: 'Archived Plan',
        startDate: new Date(),
        endDate: new Date(),
        status: 'archived',
      },
    });

    const archivedTask = await prisma.task.create({
      data: {
        userId: testUserId,
        planId: archivedPlan.id,
        title: 'Archived Plan Task',
        topic: 'Graphs',
        scheduledDate: new Date(),
        scheduledDateKey: localToday,
        taskType: 'new',
        status: 'pending',
      },
    });

    const hitlistAfterArchive = await taskRepository.getTodaysTasks(testUserId, tz);
    assert(!hitlistAfterArchive.some((t) => t.id === archivedTask.id), 'Archived plan task excluded from today hitlist');
    console.log('✅ Test 7 passed');

    console.log('\n🎉 ALL PRODUCTION FIX VERIFICATION TESTS PASSED CLEANLY!');
  } finally {
    // Cleanup test user & cascade
    await prisma.user.delete({ where: { id: testUserId } });
  }
}

runProductionFixTests()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
