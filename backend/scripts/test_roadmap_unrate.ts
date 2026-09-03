import prisma from '../src/config/database';
import { taskCompletionService } from '../src/services/task/taskCompletionService';
import { planService } from '../src/services/plan/planService';
import { dashboardService } from '../src/services/dashboard/dashboardService';

async function main() {
  console.log('=== TESTING ROADMAP REVISIONS & TAP-AGAIN UNRATE ===');

  // Find or create test user
  let user = await prisma.user.findFirst({ where: { email: 'test_roadmap_unrate@example.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test_roadmap_unrate_google_id',
        email: 'test_roadmap_unrate@example.com',
        name: 'Unrate Tester',
        coins: 100,
      },
    });
  }
  const userId = user.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Clean existing tasks for user
  await prisma.task.deleteMany({ where: { userId } });

  // Test 1: Rate manual task Medium -> 4 revisions created
  console.log('\n--- Test 1: Rate Manual Task Medium ---');
  const manualTask = await prisma.task.create({
    data: {
      userId,
      title: 'TEST Unrate Two Sum',
      topic: 'Arrays',
      difficulty: 'medium',
      platform: 'leetcode',
      problemUrl: 'https://leetcode.com/problems/two-sum/',
      taskType: 'new',
      status: 'pending',
      scheduledDate: today,
    },
  });

  const completedTask = await taskCompletionService.completeTask(manualTask.id, userId, 'medium');
  console.log(
    `status=${completedTask.status} rating=${completedTask.rating} revisions=${completedTask.revisions?.length} planId=${completedTask.planId}`
  );
  if (completedTask.status !== 'completed' || completedTask.rating !== 'medium' || completedTask.revisions?.length !== 4) {
    throw new Error('Test 1 failed!');
  }

  // Test 2: Roadmap payload carries revisions (even for manual parent tasks)
  console.log('\n--- Test 2: Roadmap Payload Carries Revisions ---');
  const rmPayload = await planService.getActivePlan(userId);
  console.log(
    `hasPlan=${rmPayload.plan !== null} planTasks=${rmPayload.tasks.length} revisions=${rmPayload.revisions.length} origin=${rmPayload.origin}`
  );
  const planRevCount = rmPayload.tasks.filter((t) => t.taskType === 'revision').length;
  console.log(`plan tasks that are revisions (MUST be 0): ${planRevCount}`);
  if (planRevCount !== 0) throw new Error('plan tasks array must not contain revisions!');

  const twoSumRevisions = rmPayload.revisions.filter((r) => r.parentTaskId === manualTask.id);
  console.log(`Two Sum revisions on roadmap (MUST be 4): ${twoSumRevisions.length}`);
  if (twoSumRevisions.length !== 4) throw new Error('Test 2 failed!');

  // Test 3: Unrate -> gone from roadmap, back on dashboard, coins refunded
  console.log('\n--- Test 3: Unrate Task ---');
  const userBeforeUndo = await prisma.user.findUnique({ where: { id: userId } });
  const unratedTask = await taskCompletionService.undoTask(manualTask.id, userId);
  console.log(
    `status=${unratedTask.status} rating=[${unratedTask.rating}] revisionsLeft=${unratedTask.revisions?.length}`
  );

  const rmPayload2 = await planService.getActivePlan(userId);
  const twoSumRevisionsAfter = rmPayload2.revisions.filter((r) => r.parentTaskId === manualTask.id);
  console.log(`Two Sum revisions on roadmap now (MUST be 0): ${twoSumRevisionsAfter.length}`);

  const dash2 = await dashboardService.getDashboardData(userId, 'Asia/Kolkata');
  const hitlistPending = dash2.todaysHitlist.pending.filter((t) => t.id === manualTask.id);
  console.log(`visible in today's pending (MUST be 1): ${hitlistPending.length}`);

  const userAfterUndo = await prisma.user.findUnique({ where: { id: userId } });
  console.log(`coins ${userBeforeUndo?.coins} -> ${userAfterUndo?.coins} (MUST drop by 10)`);

  if (
    unratedTask.status !== 'pending' ||
    unratedTask.rating !== null ||
    twoSumRevisionsAfter.length !== 0 ||
    hitlistPending.length !== 1 ||
    (userBeforeUndo?.coins ?? 0) - (userAfterUndo?.coins ?? 0) !== 10
  ) {
    throw new Error('Test 3 failed!');
  }

  // Test 4: Bug B — Undo on a past-dated task lands in BACKLOG immediately
  console.log("\n--- Test 4: Undo Past-Dated Task Lands in BACKLOG ---");
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const backdatedTask = await prisma.task.create({
    data: {
      userId,
      title: 'TEST Unrate Backdated',
      topic: 'Arrays',
      difficulty: 'easy',
      platform: 'leetcode',
      taskType: 'new',
      status: 'pending',
      scheduledDate: yesterday,
    },
  });

  await taskCompletionService.completeTask(backdatedTask.id, userId, 'easy');
  const undoneBackdated = await taskCompletionService.undoTask(backdatedTask.id, userId);
  console.log(`status=${undoneBackdated.status} isBacklog=${undoneBackdated.isBacklog}`);

  const dash3 = await dashboardService.getDashboardData(userId, 'Asia/Kolkata');
  const hitlistBackdated = dash3.todaysHitlist.pending.filter((t) => t.id === backdatedTask.id);
  console.log(`visible on dashboard right now (MUST be 1): ${hitlistBackdated.length}`);

  if (undoneBackdated.status !== 'backlog' || !undoneBackdated.isBacklog || hitlistBackdated.length !== 1) {
    throw new Error('Test 4 failed!');
  }

  // Test 5: Completed revisions survive an unrate
  console.log('\n--- Test 5: Completed Revisions Survive Unrate ---');
  // Re-rate Two Sum Medium
  const completedAgain = await taskCompletionService.completeTask(manualTask.id, userId, 'medium');
  const rev1 = completedAgain.revisions![0];

  // Backdate rev1 to today and complete it
  await prisma.task.update({
    where: { id: rev1.id },
    data: { scheduledDate: today },
  });
  await prisma.revision.updateMany({
    where: { revisionTaskId: rev1.id },
    data: { scheduledDate: today },
  });

  await taskCompletionService.completeTask(rev1.id, userId);

  // Undo parent task (unrate)
  const undoneWithCompletedRev = await taskCompletionService.undoTask(manualTask.id, userId);
  const remainingRevisions = await prisma.task.findMany({ where: { parentTaskId: manualTask.id } });
  console.log(
    `parent status=${undoneWithCompletedRev.status} remainingRevisionsInDB=${remainingRevisions.length} remainingRevStatus=${remainingRevisions[0]?.status}`
  );

  const rmPayload3 = await planService.getActivePlan(userId);
  const leftOnRoadmap = rmPayload3.revisions.filter((r) => r.parentTaskId === manualTask.id);
  console.log(`on roadmap: ${leftOnRoadmap.length} (MUST be 1, status completed): ${leftOnRoadmap[0]?.status}`);

  if (remainingRevisions.length !== 1 || leftOnRoadmap.length !== 1 || leftOnRoadmap[0].status !== 'completed') {
    throw new Error('Test 5 failed!');
  }

  // Clean up
  console.log('\n--- Cleanup Test Data ---');
  await prisma.task.deleteMany({ where: { userId } });

  console.log('\n✅ ALL TESTS PASSED SUCCESSFULLY!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
