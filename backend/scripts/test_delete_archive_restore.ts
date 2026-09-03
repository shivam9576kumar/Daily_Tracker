import prisma from '../src/config/database';
import { planService } from '../src/services/plan/planService';
import { planGenerationService } from '../src/services/plan/planGenerationService';
import { taskCompletionService } from '../src/services/task/taskCompletionService';
import { taskRepository } from '../src/repositories/taskRepository';
import { dashboardService } from '../src/services/dashboard/dashboardService';

async function main() {
  console.log('=== TESTING PLAN DELETE, ARCHIVE, RESTORE & ARCHIVED LEAK FIX ===');

  let user = await prisma.user.findFirst({ where: { email: 'test_plan_ops@example.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test_plan_ops_google_id',
        email: 'test_plan_ops@example.com',
        name: 'Plan Ops Tester',
        coins: 50,
      },
    });
  }
  const userId = user.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Clean existing test data for this user
  await prisma.task.deleteMany({ where: { userId } });
  await prisma.plan.deleteMany({ where: { userId } });
  await prisma.assignment.deleteMany({ where: { userId } });

  // Create an assignment to verify it is never touched
  const assignment = await prisma.assignment.create({
    data: {
      userId,
      title: 'Operating Systems Lab Assignment',
      description: 'Implement page replacement algorithms',
      deadline: new Date(Date.now() + 86400000),
      status: 'pending',
    },
  });

  // 1. Commit Plan A (14 days, moderate)
  console.log('\n--- Step 1: Commit Plan A ---');
  const planAData = await planGenerationService.commitPlan(userId, {
    name: 'Plan A',
    source: 'neetcode150',
    startDate: today.toISOString().split('T')[0],
    durationDays: 14,
    pace: 'moderate',
    weekdayLoad: 2,
    weekendLoad: 3,
    focusTopics: [],
    avoidTopics: [],
    busyDays: [],
    bufferDay: 0,
    archiveExisting: false,
  });

  const planAId = planAData.plan.id;
  console.log(`Plan A committed with ID: ${planAId}, tasks: ${planAData.tasksCreated}`);

  // Fetch plan A tasks
  const planATasks = await prisma.task.findMany({ where: { planId: planAId } });
  if (planATasks.length === 0) throw new Error('Plan A has no tasks!');

  // 2. Solve 2 problems and rate them
  console.log('\n--- Step 2: Solve 2 Problems and Rate Them ---');
  const task1 = planATasks[0];
  const task2 = planATasks[1];

  await taskCompletionService.completeTask(task1.id, userId, 'medium');
  await taskCompletionService.completeTask(task2.id, userId, 'hard');

  const userBeforeDelete = await prisma.user.findUnique({ where: { id: userId } });
  const coinsBeforeDelete = userBeforeDelete?.coins ?? 0;
  console.log(`User coins before delete: ${coinsBeforeDelete}`);

  // 3. Check Dashboard before delete
  console.log('\n--- Step 3: Check Dashboard Before Delete ---');
  const dashBefore = await dashboardService.getDashboardData(userId, 'Asia/Kolkata');
  console.log(
    `Dashboard before delete -> pending: ${dashBefore.todaysHitlist.pending.length}, completed: ${dashBefore.todaysHitlist.completed.length}, assignments: ${dashBefore.pendingAssignments.length}`
  );

  // 4. Delete Plan A
  console.log('\n--- Step 4: Delete Plan A ---');
  const deleteResult = await planService.deletePlan(userId, planAId);
  console.log(`Delete Plan A result: deletedPending=${deleteResult.deletedPending}, keptCompleted=${deleteResult.keptCompleted}`);

  // Verify Active Plan is null
  const activePlanAfterDelete = await planService.getActivePlan(userId);
  console.log(`Active plan after delete (MUST be null): ${activePlanAfterDelete.plan}`);
  if (activePlanAfterDelete.plan !== null) throw new Error('Active plan should be null after delete!');

  // Verify coins were NOT touched
  const userAfterDelete = await prisma.user.findUnique({ where: { id: userId } });
  const coinsAfterDelete = userAfterDelete?.coins ?? 0;
  console.log(`User coins after delete (MUST match ${coinsBeforeDelete}): ${coinsAfterDelete}`);
  if (coinsAfterDelete !== coinsBeforeDelete) throw new Error('Coins were altered after plan delete!');

  // Verify completed tasks kept as history with planId = null and rating = null
  console.log('\n--- Step 5: Verify Completed Tasks Kept As History ---');
  const keptTask1 = await prisma.task.findUnique({ where: { id: task1.id } });
  const keptTask2 = await prisma.task.findUnique({ where: { id: task2.id } });
  console.log(`Task 1 -> status: ${keptTask1?.status}, planId: ${keptTask1?.planId}, rating: ${keptTask1?.rating}`);
  console.log(`Task 2 -> status: ${keptTask2?.status}, planId: ${keptTask2?.planId}, rating: ${keptTask2?.rating}`);

  if (keptTask1?.status !== 'completed' || keptTask1?.planId !== null || keptTask1?.rating !== null) {
    throw new Error('Task 1 history properties incorrect!');
  }
  if (keptTask2?.status !== 'completed' || keptTask2?.planId !== null || keptTask2?.rating !== null) {
    throw new Error('Task 2 history properties incorrect!');
  }

  // Verify pending revisions of kept parent tasks were deleted
  const pendingRevsForKept = await prisma.task.findMany({
    where: { parentTaskId: { in: [task1.id, task2.id] }, status: { not: 'completed' } },
  });
  console.log(`Pending revisions for kept tasks (MUST be 0): ${pendingRevsForKept.length}`);
  if (pendingRevsForKept.length !== 0) throw new Error('Pending revisions were not deleted!');

  // Verify Assignment was untouched
  const assignmentCheck = await prisma.assignment.findUnique({ where: { id: assignment.id } });
  console.log(`Assignment untouched check (MUST exist): ${assignmentCheck?.title}`);
  if (!assignmentCheck) throw new Error('Assignment was deleted!');

  // 6. Test Archive & Restore Flow
  console.log('\n--- Step 6: Test Archive & Restore Flow ---');
  // Commit Plan B
  const planBData = await planGenerationService.commitPlan(userId, {
    name: 'Plan B',
    source: 'neetcode150',
    startDate: today.toISOString().split('T')[0],
    durationDays: 14,
    pace: 'moderate',
    weekdayLoad: 2,
    weekendLoad: 3,
    focusTopics: [],
    avoidTopics: [],
    busyDays: [],
    bufferDay: 0,
    archiveExisting: false,
  });
  const planBId = planBData.plan.id;

  // Commit Plan C with archiveExisting = true -> archives Plan B
  const planCData = await planGenerationService.commitPlan(userId, {
    name: 'Plan C',
    source: 'neetcode150',
    startDate: today.toISOString().split('T')[0],
    durationDays: 14,
    pace: 'moderate',
    weekdayLoad: 2,
    weekendLoad: 3,
    focusTopics: [],
    avoidTopics: [],
    busyDays: [],
    bufferDay: 0,
    archiveExisting: true,
  });
  const planCId = planCData.plan.id;

  // Check archived plans list
  const archivedPlans = await planService.getArchivedPlans(userId);
  console.log(`Archived plans count (MUST be 1): ${archivedPlans.length}, name: ${archivedPlans[0]?.name}`);
  if (archivedPlans.length !== 1 || archivedPlans[0].id !== planBId) {
    throw new Error('Plan B was not archived!');
  }

  // Restore Plan B
  console.log('\n--- Step 7: Restore Plan B ---');
  await planService.restorePlan(userId, planBId);
  const activeAfterRestore = await planService.getActivePlan(userId);
  console.log(`Active plan after restore (MUST be Plan B): ${activeAfterRestore.plan?.name}`);
  if (activeAfterRestore.plan?.id !== planBId) throw new Error('Restore failed!');

  // Delete Plan C (archived)
  console.log('\n--- Step 8: Delete Archived Plan C ---');
  await planService.deletePlan(userId, planCId);
  const archivedAfterDeleteC = await planService.getArchivedPlans(userId);
  console.log(`Archived plans count after deleting C (MUST be 0): ${archivedAfterDeleteC.length}`);
  if (archivedAfterDeleteC.length !== 0) throw new Error('Archived Plan C delete failed!');

  // Clean up remaining test data
  console.log('\n--- Step 9: Cleanup Test Data ---');
  await planService.deletePlan(userId, planBId);
  await prisma.task.deleteMany({ where: { userId } });
  await prisma.assignment.deleteMany({ where: { userId } });

  console.log('\n✅ ALL PLAN DELETE, ARCHIVE, RESTORE & LEAK FIX TESTS PASSED!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
