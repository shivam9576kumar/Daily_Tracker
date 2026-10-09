import assert from 'node:assert/strict';
import test, { TestContext } from 'node:test';
import {
  isOpenBacklogTask,
  isOverdueLifecycleTask,
  getUndoLifecyclePatch,
  BACKLOG_TASK_TYPES,
} from '../services/task/taskLifecycle';
import { taskScheduleForKey, todayKey, dateKeyInTz } from '../utils/dateKeys';

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
  // scheduledDate and scheduledDateKey are untouched on reset
  assert.equal('scheduledDateKey' in potdPatch, false);
});
