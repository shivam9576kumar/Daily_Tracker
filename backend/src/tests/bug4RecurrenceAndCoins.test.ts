import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import prisma from '../config/database';
import app from '../app';
import { generateToken } from '../services/auth/jwtService';
import { taskService } from '../services/task/taskService';
import { taskCompletionService } from '../services/task/taskCompletionService';
import { personalTaskService } from '../services/todo/personalTaskService';
import { ValidationError } from '../utils/error';
import logger from '../utils/logger';
import { addDaysToKey, todayKey } from '../utils/dateKeys';

// Helper to create test user
async function createTestUser(prefix: string) {
  const userId = `test-b4-${prefix}-${randomUUID()}`;
  const user = await prisma.user.create({
    data: {
      id: userId,
      googleId: `google-${userId}`,
      email: `${userId}@example.com`,
      name: `Bug4 User ${prefix}`,
      coins: 100,
    },
  });
  const token = generateToken({ userId: user.id, email: user.email });
  return { user, userId: user.id, token };
}

test('A. Multi-level recurrence chain reproduction (Section 1-A)', async () => {
  const { userId } = await createTestUser('chain');

  // Step 1: Create personal task A with recurrence: 'daily', scheduledDateKey: day1
  const day1 = todayKey('UTC');
  const day2 = addDaysToKey(day1, 1);
  const day3 = addDaysToKey(day1, 2);

  const taskA = await personalTaskService.create(
    userId,
    { title: 'Personal Recurring A', scheduledDateKey: day1, recurrence: 'daily' },
    'UTC',
  );

  assert.equal(taskA.status, 'pending');
  assert.equal(taskA.recurrence, 'daily');
  assert.equal(taskA.scheduledDateKey, day1);

  // Step 2: Complete A -> child B is spawned with recurrenceParentId: A.id, scheduledDateKey: day2
  await taskCompletionService.completeTask(userId, taskA.id, undefined, 'UTC');
  const updatedA = await prisma.task.findUniqueOrThrow({ where: { id: taskA.id } });
  assert.equal(updatedA.status, 'completed');

  const childB = await prisma.task.findFirst({
    where: { userId, recurrenceParentId: taskA.id },
  });
  assert.ok(childB, 'Child B must exist');
  assert.equal(childB.status, 'pending');
  assert.equal(childB.scheduledDateKey, day2);
  assert.equal(childB.recurrenceParentId, taskA.id);

  // Step 3: Complete B -> child C is spawned with recurrenceParentId: B.id, scheduledDateKey: day3
  await taskCompletionService.completeTask(userId, childB.id, undefined, 'UTC');
  const updatedB = await prisma.task.findUniqueOrThrow({ where: { id: childB.id } });
  assert.equal(updatedB.status, 'completed');

  const childC = await prisma.task.findFirst({
    where: { userId, recurrenceParentId: childB.id },
  });
  assert.ok(childC, 'Child C must exist');
  assert.equal(childC.status, 'pending');
  assert.equal(childC.scheduledDateKey, day3);
  assert.equal(childC.recurrenceParentId, childB.id);

  // Step 4: Undo A
  await taskCompletionService.undoTask(userId, taskA.id, 'UTC');

  // Record resulting states of A, B, and C
  const finalA = await prisma.task.findUniqueOrThrow({ where: { id: taskA.id } });
  const finalB = await prisma.task.findUniqueOrThrow({ where: { id: childB.id } });
  const finalC = await prisma.task.findUniqueOrThrow({ where: { id: childC.id } });

  // A is reverted to pending
  assert.equal(finalA.status, 'pending');

  // B is still completed (was already completed prior to undoing A, not the pending child spawned by A)
  assert.equal(finalB.status, 'completed');

  // C is still pending (child of B)
  assert.equal(finalC.status, 'pending');

  /*
   * DOCUMENTATION OF REPRODUCTION RESULT:
   * Tracing the actual code and this reproduction test confirms that `undoTask`'s single-level
   * cleanup logic (`where: { userId, recurrenceParentId: taskId, taskType: 'personal', status: 'pending' }`)
   * safely targets only the uncompleted pending child spawned by that specific completion.
   * Because B was already completed, it is untouched; and C is a child of B, so it is untouched.
   * This refutes the original report's prose claiming a broken multi-level deletion traversal.
   * The genuine defect was architectural: conflating recurrence and revision hierarchies into the
   * shared `parentTaskId` foreign key field.
   */
});

test('B. Recurrence/revision FK separation', async () => {
  const { userId } = await createTestUser('fk-sep');
  const day = todayKey('UTC');

  // 1. Personal recurring task
  const personalParent = await personalTaskService.create(
    userId,
    { title: 'Personal Habit', scheduledDateKey: day, recurrence: 'daily' },
    'UTC',
  );

  await taskCompletionService.completeTask(userId, personalParent.id, undefined, 'UTC');
  const personalChild = await prisma.task.findFirst({
    where: { userId, recurrenceParentId: personalParent.id },
  });

  assert.ok(personalChild);
  assert.equal(personalChild.recurrenceParentId, personalParent.id);
  assert.equal(personalChild.parentTaskId, null);

  // 2. New DSA task with rating -> revisions spawned
  const newProblem = await taskService.createTask(
    userId,
    {
      title: 'Two Sum',
      topic: 'Arrays',
      difficulty: 'easy',
      scheduledDate: day,
    },
    'UTC',
  );

  await taskCompletionService.completeTask(userId, newProblem.id, 'medium', 'UTC');

  const revisionChildren = await prisma.task.findMany({
    where: { parentTaskId: newProblem.id },
  });

  assert.ok(revisionChildren.length > 0, 'Revisions should be spawned');
  for (const rev of revisionChildren) {
    assert.equal(rev.taskType, 'revision');
    assert.equal(rev.parentTaskId, newProblem.id);
    assert.equal(rev.recurrenceParentId, null);
  }

  // 3. getTaskById on personal recurring parent -> revisions is empty
  const fetchedPersonal = await taskService.getTaskById(personalParent.id, userId);
  assert.deepEqual(fetchedPersonal.revisions, [], 'Personal task revisions must be empty');

  // 4. getTaskById on new problem -> revisions contains only taskType: 'revision'
  const fetchedNew = await taskService.getTaskById(newProblem.id, userId);
  assert.ok(fetchedNew.revisions.length > 0);
  for (const rev of fetchedNew.revisions) {
    assert.equal(rev.taskType, 'revision');
  }
});

test('C. Delete-unlinks-not-cascades policy', async () => {
  const { userId } = await createTestUser('delete-unlink');
  const day = todayKey('UTC');

  // Create 3-level chain A -> B -> C via recurrenceParentId
  const taskA = await personalTaskService.create(
    userId,
    { title: 'Task A', scheduledDateKey: day },
    'UTC',
  );

  const taskB = await prisma.task.create({
    data: {
      userId,
      title: 'Task B',
      topic: 'Personal',
      taskType: 'personal',
      status: 'pending',
      recurrenceParentId: taskA.id,
    },
  });

  const taskC = await prisma.task.create({
    data: {
      userId,
      title: 'Task C',
      topic: 'Personal',
      taskType: 'personal',
      status: 'pending',
      recurrenceParentId: taskB.id,
    },
  });

  // Delete A
  await taskService.deleteTask(taskA.id, userId);

  // Assert B still exists, pending, recurrenceParentId === null
  const bAfterA = await prisma.task.findUnique({ where: { id: taskB.id } });
  assert.ok(bAfterA, 'B must still exist after A deleted');
  assert.equal(bAfterA.status, 'pending');
  assert.equal(bAfterA.recurrenceParentId, null);

  // Assert C is untouched (recurrenceParentId still points to B)
  const cAfterA = await prisma.task.findUnique({ where: { id: taskC.id } });
  assert.ok(cAfterA, 'C must still exist after A deleted');
  assert.equal(cAfterA.recurrenceParentId, taskB.id);

  // Delete B
  await taskService.deleteTask(taskB.id, userId);

  // Assert C still exists and now has recurrenceParentId === null
  const cAfterB = await prisma.task.findUnique({ where: { id: taskC.id } });
  assert.ok(cAfterB, 'C must still exist after B deleted');
  assert.equal(cAfterB.recurrenceParentId, null);
});

test('D. Inbox/recurrence validation gap (Section 1-B item 1)', async () => {
  const { userId, token } = await createTestUser('val-gap');

  // Create personal task already in Inbox (scheduledDateKey: null)
  const inboxTask = await personalTaskService.create(
    userId,
    { title: 'Inbox Task', scheduledDateKey: null },
    'UTC',
  );
  assert.equal(inboxTask.scheduledDateKey, null);

  // Direct service call: update with { recurrence: 'daily' } without scheduledDateKey -> ValidationError
  await assert.rejects(
    async () => {
      await personalTaskService.update(userId, inboxTask.id, { recurrence: 'daily' }, 'UTC');
    },
    (err: any) => {
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /A repeating task needs a date/);
      return true;
    },
  );

  // HTTP call: PATCH /api/todo/tasks/:id with { recurrence: 'daily' } -> HTTP 400
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/todo/tasks/${inboxTask.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recurrence: 'daily' }),
    });

    assert.equal(res.status, 400);
    const json = (await res.json()) as any;
    assert.equal(json.success, false);
    assert.match(json.error, /A repeating task needs a date/);
  } finally {
    server.close();
  }
});

test('E. Expired-to-Inbox cleanup (Section 1-B item 2)', async () => {
  const { userId } = await createTestUser('exp-inbox');

  const expiredTask = await prisma.task.create({
    data: {
      userId,
      title: 'Expired Task',
      topic: 'Personal',
      taskType: 'personal',
      status: 'expired',
      isExpired: true,
      isBacklog: false,
      scheduledDateKey: '2026-01-01',
      scheduledDate: new Date('2026-01-01T00:00:00Z'),
      recurrence: 'daily',
    },
  });

  const updated = await personalTaskService.update(
    userId,
    expiredTask.id,
    { scheduledDateKey: null },
    'UTC',
  );

  assert.equal(updated.status, 'pending');
  assert.equal(updated.isExpired, false);
  assert.equal(updated.isBacklog, false);
  assert.equal(updated.backlogSince, null);
  assert.equal(updated.scheduledDateKey, null);
  assert.equal(updated.scheduledDate, null);
  assert.equal(updated.recurrence, null);
});

test('F. Explicit reschedule of expired task to a future date', async () => {
  const { userId } = await createTestUser('exp-resched');
  const futureKey = addDaysToKey(todayKey('UTC'), 10);

  const expiredTask = await prisma.task.create({
    data: {
      userId,
      title: 'Expired Task',
      topic: 'Personal',
      taskType: 'personal',
      status: 'expired',
      isExpired: true,
      isBacklog: false,
      scheduledDateKey: '2026-01-01',
      scheduledDate: new Date('2026-01-01T00:00:00Z'),
    },
  });

  const updated = await personalTaskService.update(
    userId,
    expiredTask.id,
    { scheduledDateKey: futureKey },
    'UTC',
  );

  assert.equal(updated.status, 'pending');
  assert.equal(updated.isExpired, false);
  assert.equal(updated.isBacklog, false);
  assert.equal(updated.scheduledDateKey, futureKey);
});

test('G. Title-only edit does not disturb backlog timer', async () => {
  const { userId } = await createTestUser('backlog-timer');
  const fixedTimestamp = new Date('2026-03-15T12:00:00.000Z');

  const backlogTask = await prisma.task.create({
    data: {
      userId,
      title: 'Original Title',
      topic: 'Personal',
      taskType: 'personal',
      status: 'backlog',
      isBacklog: true,
      backlogSince: fixedTimestamp,
      scheduledDateKey: '2026-03-01',
      scheduledDate: new Date('2026-03-01T00:00:00Z'),
    },
  });

  const updated = await personalTaskService.update(
    userId,
    backlogTask.id,
    { title: 'New title' },
    'UTC',
  );

  assert.equal(updated.title, 'New title');
  assert.equal(updated.status, 'backlog');
  assert.equal(updated.isBacklog, true);
  assert.equal(updated.backlogSince?.toISOString(), fixedTimestamp.toISOString());
});

test('H. Coin delta accuracy — solve, rate, unrate, undo', async () => {
  const { userId } = await createTestUser('coins-flow');
  const day = todayKey('UTC');

  // Create new task
  const task = await taskService.createTask(
    userId,
    { title: 'Coins Test Problem', topic: 'Arrays', difficulty: 'hard', scheduledDate: day },
    'UTC',
  );

  // 1. Solve without rating -> coinsDelta === 10
  const solveResult = await taskCompletionService.completeTask(userId, task.id, undefined, 'UTC');
  assert.equal(solveResult.coinsDelta, 10);

  // 2. Rate it hard -> coinsDelta === 10 (hard rating bonus is +10)
  const rateResult = await taskCompletionService.completeTask(userId, task.id, 'hard', 'UTC');
  assert.equal(rateResult.coinsDelta, 10);

  // Find spawned revisions
  const revisions = await prisma.task.findMany({
    where: { parentTaskId: task.id, taskType: 'revision' },
    orderBy: { revisionNumber: 'asc' },
  });
  assert.ok(revisions.length >= 2);

  // 3. Complete 2 revisions -> each +10 coins
  const rev1Result = await taskCompletionService.completeTask(userId, revisions[0].id, undefined, 'UTC');
  assert.equal(rev1Result.coinsDelta, 10);

  const rev2Result = await taskCompletionService.completeTask(userId, revisions[1].id, undefined, 'UTC');
  assert.equal(rev2Result.coinsDelta, 10);

  // 4. Unrate parent -> coinsDelta === -(hardBonus + 2 * 10) = -(10 + 20) = -30
  const unrateResult = await taskCompletionService.unrateTask(userId, task.id);
  assert.equal(unrateResult.coinsDelta, -30);

  // 5. Undo parent solve -> coinsDelta === -10 (base solve only)
  const undoResult = await taskCompletionService.undoTask(userId, task.id, 'UTC');
  assert.equal(undoResult.coinsDelta, -10);
});

test('I. Personal task coin delta is always zero', async () => {
  const { userId } = await createTestUser('personal-coins');
  const day = todayKey('UTC');

  const personalTask = await personalTaskService.create(
    userId,
    { title: 'Personal Chore', scheduledDateKey: day },
    'UTC',
  );

  // Complete personal task -> coinsDelta === 0
  const completeResult = await taskCompletionService.completeTask(userId, personalTask.id, undefined, 'UTC');
  assert.equal(completeResult.coinsDelta, 0);

  // Undo personal task -> coinsDelta === 0
  const undoResult = await taskCompletionService.undoTask(userId, personalTask.id, 'UTC');
  assert.equal(undoResult.coinsDelta, 0);
});

test('J. Coin clamp logging', async () => {
  const { userId } = await createTestUser('clamp-log');
  const day = todayKey('UTC');

  // Directly set user's coins to 5
  await prisma.user.update({
    where: { id: userId },
    data: { coins: 5 },
  });

  // Create and solve a completed problem (earned base 10 + bonus 10 = 20 refund on undo)
  const task = await taskService.createTask(
    userId,
    { title: 'Task with big refund', topic: 'DP', difficulty: 'hard', scheduledDate: day },
    'UTC',
  );

  // Artificially mark task as completed with hard rating without giving user coins
  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: 'completed',
      rating: 'hard',
      completedAt: new Date(),
      originalSolveDate: new Date(),
    },
  });

  // Spy on logger.error
  let loggedInvariantMessage = false;
  const originalError = logger.error.bind(logger);
  logger.error = (msg: any, ...args: any[]) => {
    const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
    if (/Coin invariant violation/.test(text)) {
      loggedInvariantMessage = true;
    }
    return originalError(msg, ...args);
  };

  try {
    // Undo task: will compute refund of 10 (base) + 10 (hard bonus) = 20.
    // User only has 5 coins, so next would be 5 - 20 = -15.
    await taskCompletionService.undoTask(userId, task.id, 'UTC');

    // Balance clamped to 0
    const finalUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(finalUser.coins, 0, 'User balance must be clamped to 0');
    assert.equal(loggedInvariantMessage, true, 'Logger must log Coin invariant violation');
  } finally {
    logger.error = originalError;
  }
});

test('K. API response shape', async () => {
  const { userId, token } = await createTestUser('api-shape');
  const day = todayKey('UTC');

  const task = await taskService.createTask(
    userId,
    { title: 'API Test Problem', topic: 'Graphs', difficulty: 'medium', scheduledDate: day },
    'UTC',
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/tasks/${task.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 200);
    const json = (await res.json()) as any;

    assert.equal(json.success, true);
    assert.ok(json.data, 'data must be present');
    assert.ok(json.data.task, 'data.task must be present');
    assert.equal(json.data.task.id, task.id);
    assert.equal(typeof json.data.coinsDelta, 'number');
    assert.equal(json.data.coinsDelta, 10);
  } finally {
    server.close();
  }
});
