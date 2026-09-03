import prisma from '../src/config/database';
import { taskCompletionService } from '../src/services/task/taskCompletionService';
import { taskRepository } from '../src/repositories/taskRepository';

async function main() {
  console.log('=== TESTING SOLVE-RATE TOGGLE MODEL & COMPLETED TODAY FIX ===');

  let user = await prisma.user.findFirst({ where: { email: 'test_solve_rate@example.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test_solve_rate_google_id',
        email: 'test_solve_rate@example.com',
        name: 'Solve Rate Tester',
        coins: 100,
      },
    });
  }
  const userId = user.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Clean existing tasks for test user
  await prisma.task.deleteMany({ where: { userId } });

  // 1. Solve without rating
  console.log('\n--- Test 1: Solve Without Rating ---');
  const task1 = await prisma.task.create({
    data: {
      userId,
      title: 'TEST Minimum Window Substring',
      topic: 'Sliding Window',
      difficulty: 'hard',
      platform: 'leetcode',
      taskType: 'new',
      status: 'pending',
      scheduledDate: today,
    },
  });

  const coinsBefore1 = (await prisma.user.findUnique({ where: { id: userId } }))?.coins ?? 0;
  const solved1 = await taskCompletionService.completeTask(task1.id, userId, null);
  const coinsAfter1 = (await prisma.user.findUnique({ where: { id: userId } }))?.coins ?? 0;

  console.log(
    `status=${solved1.status} rating=${solved1.rating} coinsDelta=${coinsAfter1 - coinsBefore1} (MUST be 15 for hard) revisions=${solved1.revisions?.length}`
  );
  if (solved1.status !== 'completed' || solved1.rating !== null || coinsAfter1 - coinsBefore1 !== 15 || solved1.revisions?.length !== 0) {
    throw new Error('Test 1 failed!');
  }

  // 2. Completed Today Backlog Fix
  console.log('\n--- Test 2: Backlog Solved Today Stays in Today Hitlist ---');
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const backlogTask = await prisma.task.create({
    data: {
      userId,
      title: 'TEST Backlog Solved Today',
      topic: 'Arrays',
      difficulty: 'medium',
      platform: 'leetcode',
      taskType: 'new',
      status: 'backlog',
      isBacklog: true,
      scheduledDate: yesterday,
    },
  });

  await taskCompletionService.completeTask(backlogTask.id, userId);
  const todaysList = await taskRepository.getTodaysTasks(userId);
  const hitlistCompleted = todaysList.filter((t) => t.status === 'completed' && t.id === backlogTask.id);
  console.log(`Backlog task solved today visible in today hitlist (MUST be 1): ${hitlistCompleted.length}`);
  if (hitlistCompleted.length !== 1) throw new Error('Test 2 failed!');

  // 3. Rate a solved problem
  console.log('\n--- Test 3: Rate Solved Problem ---');
  const coinsBefore3 = (await prisma.user.findUnique({ where: { id: userId } }))?.coins ?? 0;
  const rated1 = await taskCompletionService.rateTask(task1.id, userId, 'medium');
  const coinsAfter3 = (await prisma.user.findUnique({ where: { id: userId } }))?.coins ?? 0;

  console.log(
    `rating=${rated1.rating} revisions=${rated1.revisions?.length} coinsDelta=${coinsAfter3 - coinsBefore3} (MUST be 0)`
  );
  if (rated1.rating !== 'medium' || rated1.revisions?.length !== 4 || coinsAfter3 - coinsBefore3 !== 0) {
    throw new Error('Test 3 failed!');
  }

  // 4. Unrate problem (keep solve)
  console.log('\n--- Test 4: Unrate Problem ---');
  const coinsBefore4 = (await prisma.user.findUnique({ where: { id: userId } }))?.coins ?? 0;
  const unrated1 = await taskCompletionService.unrateTask(task1.id, userId);
  const coinsAfter4 = (await prisma.user.findUnique({ where: { id: userId } }))?.coins ?? 0;

  console.log(
    `status=${unrated1.status} rating=${unrated1.rating} revisions=${unrated1.revisions?.length} coinsDelta=${coinsAfter4 - coinsBefore4} (MUST be 0)`
  );
  if (unrated1.status !== 'completed' || unrated1.rating !== null || unrated1.revisions?.length !== 0 || coinsAfter4 - coinsBefore4 !== 0) {
    throw new Error('Test 4 failed!');
  }

  // 5. Unsolve (undo)
  console.log('\n--- Test 5: Unsolve Problem ---');
  const coinsBefore5 = (await prisma.user.findUnique({ where: { id: userId } }))?.coins ?? 0;
  const unsolved1 = await taskCompletionService.undoTask(task1.id, userId);
  const coinsAfter5 = (await prisma.user.findUnique({ where: { id: userId } }))?.coins ?? 0;

  console.log(
    `status=${unsolved1.status} rating=${unsolved1.rating} coinsDelta=${coinsAfter5 - coinsBefore5} (MUST be -15)`
  );
  if (unsolved1.status !== 'pending' || unsolved1.rating !== null || coinsAfter5 - coinsBefore5 !== -15) {
    throw new Error('Test 5 failed!');
  }

  // Clean up
  console.log('\n--- Cleanup Test Data ---');
  await prisma.task.deleteMany({ where: { userId } });

  console.log('\n✅ ALL SOLVE-RATE TOGGLE TESTS PASSED!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
