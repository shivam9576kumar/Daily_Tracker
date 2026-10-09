import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import prisma from '../config/database';
import {
  isOpenBacklogTask,
  isOverdueLifecycleTask,
  getUndoLifecyclePatch,
  BACKLOG_TASK_TYPES,
} from '../services/task/taskLifecycle';
import { taskScheduleForKey, todayKey, dateKeyInTz, addDaysToKey } from '../utils/dateKeys';
import { BACKLOG_EXPIRY_DAYS } from '@dsa-planner/shared';
import { taskCompletionService } from '../services/task/taskCompletionService';
import { taskService } from '../services/task/taskService';
import { runRepairTaskLifecycle } from '../../scripts/repairTaskLifecycle';

test('A. Backlog eligibility predicates', () => {
  const today = '2026-04-01';

  // Dated new/revision/personal tasks earlier than today are overdue
  for (const type of BACKLOG_TASK_TYPES) {
    assert.equal(
      isOverdueLifecycleTask({ taskType: type, scheduledDateKey: '2026-03-31' }, today),
      true,
      `${type} on past key is overdue`,
    );

    assert.equal(
      isOverdueLifecycleTask({ taskType: type, scheduledDateKey: '2026-04-01' }, today),
      false,
      `${type} on today key is not overdue`,
    );

    assert.equal(
      isOverdueLifecycleTask({ taskType: type, scheduledDateKey: '2026-04-02' }, today),
      false,
      `${type} on future key is not overdue`,
    );
  }

  // CP31 and POTD are NEVER overdue lifecycle tasks for generic maintenance
  assert.equal(isOverdueLifecycleTask({ taskType: 'cp31', scheduledDateKey: '2026-03-31' }, today), false);
  assert.equal(isOverdueLifecycleTask({ taskType: 'potd', scheduledDateKey: '2026-03-31' }, today), false);

  // Undated / malformed tasks are NEVER overdue lifecycle tasks
  assert.equal(isOverdueLifecycleTask({ taskType: 'personal', scheduledDateKey: null }, today), false);
  assert.equal(isOverdueLifecycleTask({ taskType: 'new', scheduledDateKey: '' }, today), false);
  assert.equal(isOverdueLifecycleTask({ taskType: 'revision', scheduledDateKey: 'invalid-date' }, today), false);

  // isOpenBacklogTask checks canonical invariants
  assert.equal(
    isOpenBacklogTask({
      taskType: 'new',
      scheduledDateKey: '2026-03-31',
      status: 'backlog',
      isBacklog: true,
      isExpired: false,
    }),
    true,
  );

  // Exclusions from open backlog
  assert.equal(
    isOpenBacklogTask({
      taskType: 'cp31',
      scheduledDateKey: '2026-03-31',
      status: 'backlog',
      isBacklog: true,
      isExpired: false,
    }),
    false,
    'CP31 is excluded from open backlog',
  );

  assert.equal(
    isOpenBacklogTask({
      taskType: 'potd',
      scheduledDateKey: '2026-03-31',
      status: 'backlog',
      isBacklog: true,
      isExpired: false,
    }),
    false,
    'POTD is excluded from generic open backlog',
  );

  assert.equal(
    isOpenBacklogTask({
      taskType: 'personal',
      scheduledDateKey: null,
      status: 'backlog',
      isBacklog: true,
      isExpired: false,
    }),
    false,
    'Undated Personal Inbox task is excluded from open backlog',
  );

  assert.equal(
    isOpenBacklogTask({
      taskType: 'new',
      scheduledDateKey: '2026-03-31',
      status: 'completed',
      isBacklog: true,
      isExpired: false,
    }),
    false,
    'Completed status contradicts open backlog',
  );

  assert.equal(
    isOpenBacklogTask({
      taskType: 'new',
      scheduledDateKey: '2026-03-31',
      status: 'backlog',
      isBacklog: true,
      isExpired: true,
    }),
    false,
    'isExpired true contradicts open backlog',
  );
});

test('B. Expiry calculation and thresholds', () => {
  const tz = 'Asia/Kolkata';
  const userToday = '2026-04-08';
  assert.equal(BACKLOG_EXPIRY_DAYS, 7, 'BACKLOG_EXPIRY_DAYS is 7');

  // Task entered backlog on 2026-04-01 -> expires on 2026-04-08 -> on userToday 2026-04-08 it IS expired!
  const backlogDate1 = new Date('2026-04-01T10:00:00.000Z');
  const backlogDay1 = dateKeyInTz(backlogDate1, tz);
  const expiresOn1 = addDaysToKey(backlogDay1, BACKLOG_EXPIRY_DAYS);
  assert.equal(expiresOn1 <= userToday, true, 'Task entered backlog on 2026-04-01 expires on 2026-04-08');

  // Task entered backlog on 2026-04-02 -> expires on 2026-04-09 -> on userToday 2026-04-08 it is NOT expired yet!
  const backlogDate2 = new Date('2026-04-02T10:00:00.000Z');
  const backlogDay2 = dateKeyInTz(backlogDate2, tz);
  const expiresOn2 = addDaysToKey(backlogDay2, BACKLOG_EXPIRY_DAYS);
  assert.equal(expiresOn2 <= userToday, false, 'Task entered backlog on 2026-04-02 does not expire on 2026-04-08');
});

test('C & D. Undo lifecycle patch for ordinary tasks', () => {
  const tz = 'Asia/Kolkata';
  const now = new Date('2026-04-01T10:00:00.000Z');

  // Overdue ordinary task -> restores to backlog immediately
  const overduePatch = getUndoLifecyclePatch(
    { taskType: 'new', scheduledDateKey: '2026-03-31', cp31ProblemId: null },
    tz,
    now,
  );
  assert.equal(overduePatch.status, 'backlog');
  assert.equal(overduePatch.isBacklog, true);
  assert.equal(overduePatch.isExpired, false);
  assert.equal(overduePatch.backlogSince, now);
  assert.equal(overduePatch.rating, null);
  assert.equal(overduePatch.completedAt, null);
  assert.equal(overduePatch.originalSolveDate, null);

  // Today/future ordinary task -> restores to pending
  const todayPatch = getUndoLifecyclePatch(
    { taskType: 'new', scheduledDateKey: '2026-04-01', cp31ProblemId: null },
    tz,
    now,
  );
  assert.equal(todayPatch.status, 'pending');
  assert.equal(todayPatch.isBacklog, false);
  assert.equal(todayPatch.backlogSince, null);
  assert.equal(todayPatch.isExpired, false);
  assert.equal(todayPatch.rating, null);
  assert.equal(todayPatch.completedAt, null);

  // Personal Inbox task -> restores to pending and keeps null dates
  const inboxPatch = getUndoLifecyclePatch(
    { taskType: 'personal', scheduledDateKey: null, cp31ProblemId: null },
    tz,
    now,
  );
  assert.equal(inboxPatch.status, 'pending');
  assert.equal(inboxPatch.isBacklog, false);
  assert.equal(inboxPatch.backlogSince, null);
});

test('E. Timezone-sensitive undo classification', () => {
  const instant = new Date('2026-04-01T00:30:00.000Z');
  const scheduledKey = '2026-03-31';
  const task = { taskType: 'new' as const, scheduledDateKey: scheduledKey, cp31ProblemId: null };

  // Los Angeles wall-clock at 2026-04-01T00:30:00Z is 2026-03-31 17:30 (today)
  const patchLA = getUndoLifecyclePatch(task, 'America/Los_Angeles', instant);
  assert.equal(dateKeyInTz(instant, 'America/Los_Angeles'), '2026-03-31');
  assert.equal(patchLA.status, 'pending', 'LA task scheduled for local today becomes pending on undo');

  // Kolkata wall-clock at 2026-04-01T00:30:00Z is 2026-04-01 06:00 (today is 2026-04-01) -> 2026-03-31 is overdue!
  const patchKolkata = getUndoLifecyclePatch(task, 'Asia/Kolkata', instant);
  assert.equal(dateKeyInTz(instant, 'Asia/Kolkata'), '2026-04-01');
  assert.equal(patchKolkata.status, 'backlog', 'Kolkata task scheduled for 2026-03-31 is overdue');

  // Kiritimati wall-clock at 2026-04-01T00:30:00Z is 2026-04-01 14:30 (today is 2026-04-01) -> 2026-03-31 is overdue!
  const patchKiritimati = getUndoLifecyclePatch(task, 'Pacific/Kiritimati', instant);
  assert.equal(dateKeyInTz(instant, 'Pacific/Kiritimati'), '2026-04-01');
  assert.equal(patchKiritimati.status, 'backlog', 'Kiritimati task scheduled for 2026-03-31 is overdue');
});

test('F. CP31 undo active vs parked state', () => {
  const tz = 'Asia/Kolkata';
  const now = new Date('2026-04-01T10:00:00.000Z');

  // Active band -> scheduled Today
  const activePatch = getUndoLifecyclePatch(
    { taskType: 'cp31', scheduledDateKey: null, cp31ProblemId: 'cp31-800-1' },
    tz,
    now,
    { cp31Enabled: true, cp31Band: 800 },
  );
  assert.equal(activePatch.status, 'pending');
  assert.equal(activePatch.scheduledDateKey, '2026-04-01');
  assert.equal(activePatch.isBacklog, false);
  assert.equal(activePatch.isExpired, false);

  // Disabled CP31 -> parked pending (null keys)
  const disabledPatch = getUndoLifecyclePatch(
    { taskType: 'cp31', scheduledDateKey: '2026-04-01', cp31ProblemId: 'cp31-800-1' },
    tz,
    now,
    { cp31Enabled: false, cp31Band: 800 },
  );
  assert.equal(disabledPatch.status, 'pending');
  assert.equal(disabledPatch.scheduledDateKey, null);
  assert.equal(disabledPatch.scheduledDate, null);

  // Different band -> parked pending (null keys)
  const wrongBandPatch = getUndoLifecyclePatch(
    { taskType: 'cp31', scheduledDateKey: '2026-04-01', cp31ProblemId: 'cp31-800-1' },
    tz,
    now,
    { cp31Enabled: true, cp31Band: 900 },
  );
  assert.equal(wrongBandPatch.status, 'pending');
  assert.equal(wrongBandPatch.scheduledDateKey, null);
  assert.equal(wrongBandPatch.scheduledDate, null);
});

test('G. POTD undo preserves challenge identity', () => {
  const tz = 'Asia/Kolkata';
  const now = new Date('2026-04-01T10:00:00.000Z');

  const potdPatch = getUndoLifecyclePatch(
    { taskType: 'potd', scheduledDateKey: '2026-03-25', cp31ProblemId: null },
    tz,
    now,
  );
  assert.equal(potdPatch.status, 'pending');
  assert.equal(potdPatch.isBacklog, false);
  assert.equal(potdPatch.isExpired, false);
  assert.equal('scheduledDateKey' in potdPatch, false);
});

test('H. Revision undo - refunds only its own reward, siblings/parent untouched', async () => {
  const tz = 'Asia/Kolkata';
  const userId = `test-user-h-${randomUUID()}`;

  const cleanup = async () => {
    await prisma.revision.deleteMany({ where: { parentTask: { userId } } });
    await prisma.task.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  };

  try {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.com`, googleId: userId, name: 'User H', coins: 100 },
    });

    const parent = await prisma.task.create({
      data: {
        userId,
        title: 'Parent Problem',
        topic: 'Arrays',
        taskType: 'new',
        status: 'completed',
        completedAt: new Date(),
        scheduledDate: new Date('2026-04-01T00:00:00Z'),
        scheduledDateKey: '2026-04-01',
      },
    });

    const rev1 = await prisma.task.create({
      data: {
        userId,
        parentTaskId: parent.id,
        title: 'Parent Problem',
        topic: 'Arrays',
        taskType: 'revision',
        status: 'completed',
        completedAt: new Date(),
        scheduledDate: new Date('2026-04-02T00:00:00Z'),
        scheduledDateKey: '2026-04-02',
        revisionNumber: 1,
      },
    });

    await prisma.revision.create({
      data: { parentTaskId: parent.id, revisionTaskId: rev1.id, revisionNumber: 1, status: 'completed', completedAt: new Date(), scheduledDate: new Date('2026-04-02T00:00:00Z') },
    });

    // Undo rev1 solve
    await taskCompletionService.undoTask(userId, rev1.id, tz);

    const userAfter = await prisma.user.findUnique({ where: { id: userId } });
    assert.equal(userAfter?.coins, 90, 'User coins refunded 10 for revision');

    const rev1After = await prisma.task.findUnique({ where: { id: rev1.id } });
    assert.equal(rev1After?.status === 'pending' || rev1After?.status === 'backlog', true);

    const revRecord = await prisma.revision.findFirst({ where: { revisionTaskId: rev1.id } });
    assert.equal(revRecord?.status, 'pending');
    assert.equal(revRecord?.completedAt, null);

    const parentAfter = await prisma.task.findUnique({ where: { id: parent.id } });
    assert.equal(parentAfter?.status, 'completed', 'Parent task remains completed');
  } finally {
    await cleanup();
  }
});

test('I. Parent undo - refunds base + bonus + completed revisions, second undo is no-op', async () => {
  const tz = 'Asia/Kolkata';
  const userId = `test-user-i-${randomUUID()}`;

  const cleanup = async () => {
    await prisma.revision.deleteMany({ where: { parentTask: { userId } } });
    await prisma.task.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  };

  try {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.com`, googleId: userId, name: 'User I', coins: 100 },
    });

    // Complete parent with rating 'medium' (10 solve + 5 bonus = 15 coins -> 115)
    const parent = await taskCompletionService.completeTask(userId, (await prisma.task.create({
      data: { userId, title: 'DP Problem', topic: 'DP', taskType: 'new', status: 'pending', scheduledDate: new Date('2026-04-01T00:00:00Z'), scheduledDateKey: '2026-04-01' },
    })).id, 'medium', tz);

    const user1 = await prisma.user.findUnique({ where: { id: userId } });
    assert.equal(user1?.coins, 115, 'Earned 15 coins for parent solve');

    // First undo of parent task
    await taskCompletionService.undoTask(userId, parent.id, tz);

    const user2 = await prisma.user.findUnique({ where: { id: userId } });
    assert.equal(user2?.coins, 100, 'Refunded 15 coins on parent undo');

    // SECOND undo of already undone parent task
    const secondUndoResult = await taskCompletionService.undoTask(userId, parent.id, tz);
    assert.equal(secondUndoResult.status === 'pending' || secondUndoResult.status === 'backlog', true);

    const user3 = await prisma.user.findUnique({ where: { id: userId } });
    assert.equal(user3?.coins, 100, 'Second undo did NOT refund coins again');
  } finally {
    await cleanup();
  }
});

test('J. Original solve date clearing on undo', () => {
  const tz = 'Asia/Kolkata';
  const now = new Date('2026-04-01T10:00:00.000Z');

  const patch = getUndoLifecyclePatch(
    { taskType: 'new', scheduledDateKey: '2026-04-01', cp31ProblemId: null },
    tz,
    now,
  );

  assert.equal(patch.originalSolveDate, null, 'Undo explicitly clears originalSolveDate to null');
});

test('K. Concurrent duplicate undo refunds exactly once under high concurrency', async () => {
  const tz = 'Asia/Kolkata';
  const userId = `test-user-k-${randomUUID()}`;

  const cleanup = async () => {
    await prisma.revision.deleteMany({ where: { parentTask: { userId } } });
    await prisma.task.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  };

  try {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.com`, googleId: userId, name: 'User K', coins: 100 },
    });

    const task = await taskCompletionService.completeTask(userId, (await prisma.task.create({
      data: { userId, title: 'Graphs Problem', topic: 'Graphs', taskType: 'new', status: 'pending', scheduledDate: new Date('2026-04-01T00:00:00Z'), scheduledDateKey: '2026-04-01' },
    })).id, 'medium', tz);

    const userSolved = await prisma.user.findUnique({ where: { id: userId } });
    assert.equal(userSolved?.coins, 115, 'Earned 15 coins for parent solve');

    // Fire TWO parallel concurrent undo requests via Promise.all
    const [res1, res2] = await Promise.all([
      taskCompletionService.undoTask(userId, task.id, tz),
      taskCompletionService.undoTask(userId, task.id, tz),
    ]);

    assert.equal(res1.id, task.id);
    assert.equal(res2.id, task.id);

    const userAfter = await prisma.user.findUnique({ where: { id: userId } });
    assert.equal(userAfter?.coins, 100, 'Coins refunded EXACTLY ONCE under concurrent duplicate undo');
  } finally {
    await cleanup();
  }
});

test('L. Rescheduling lifecycle consistency', async () => {
  const tz = 'Asia/Kolkata';
  const userId = `test-user-l-${randomUUID()}`;

  const cleanup = async () => {
    await prisma.task.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  };

  try {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.com`, googleId: userId, name: 'User L', coins: 0 },
    });

    // 1. Backlog task -> rescheduled to future date relative to today -> clears backlog flags
    const currentToday = todayKey(tz);
    const futureKey = addDaysToKey(currentToday, 10);
    const pastKey = addDaysToKey(currentToday, -5);

    const backlogTask = await prisma.task.create({
      data: {
        userId,
        title: 'Backlog Task',
        topic: 'Trees',
        taskType: 'new',
        status: 'backlog',
        isBacklog: true,
        backlogSince: new Date('2026-03-25T10:00:00Z'),
        isExpired: false,
        scheduledDate: new Date('2026-03-20T00:00:00Z'),
        scheduledDateKey: pastKey,
      },
    });

    const rescheduledFuture = await taskService.updateTask(
      backlogTask.id,
      userId,
      { scheduledDate: futureKey },
      tz,
    );

    assert.equal(rescheduledFuture.status, 'pending');
    assert.equal(rescheduledFuture.isBacklog, false);
    assert.equal(rescheduledFuture.backlogSince, null);
    assert.equal(rescheduledFuture.scheduledDateKey, futureKey);

    // 2. Title-only edit on a backlog task -> preserves backlogSince and status
    const backlogTask2 = await prisma.task.create({
      data: {
        userId,
        title: 'Original Title',
        topic: 'Trees',
        taskType: 'new',
        status: 'backlog',
        isBacklog: true,
        backlogSince: new Date('2026-03-25T10:00:00Z'),
        isExpired: false,
        scheduledDate: new Date('2026-03-20T00:00:00Z'),
        scheduledDateKey: pastKey,
      },
    });

    const updatedTitle = await taskService.updateTask(
      backlogTask2.id,
      userId,
      { title: 'New Title' },
      tz,
    );

    assert.equal(updatedTitle.title, 'New Title');
    assert.equal(updatedTitle.status, 'backlog');
    assert.equal(updatedTitle.isBacklog, true);
    assert.equal(updatedTitle.backlogSince?.toISOString(), new Date('2026-03-25T10:00:00Z').toISOString());
  } finally {
    await cleanup();
  }
});

test('M. Repair script dry-run safety verification', async () => {
  const result = await runRepairTaskLifecycle({ apply: false });
  assert.equal(typeof result.actionsCount, 'number');
  assert.equal(typeof result.ambiguousCount, 'number');
});
