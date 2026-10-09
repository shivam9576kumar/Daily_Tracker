import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../config/database';
import { sortTodaysTasks, taskRepository } from '../repositories/taskRepository';
import { taskService } from '../services/task/taskService';
import { planService } from '../services/plan/planService';
import { runBacklogCron } from '../cron/backlogCron';
import { todayKey, zonedDayRangeUtc } from '../utils/dateKeys';

test('A. Deterministic ordering via sortTodaysTasks', () => {
  const d1 = new Date('2026-04-01T10:00:00.000Z');
  const d2 = new Date('2026-04-01T12:00:00.000Z');

  const rawTasks = [
    { id: '1', status: 'expired', taskType: 'new', difficulty: 'easy', scheduledDate: d1 },
    { id: '2', status: 'completed', taskType: 'new', difficulty: 'easy', scheduledDate: d1 },
    { id: '3', status: 'pending', taskType: 'revision', difficulty: 'easy', scheduledDate: d1 },
    { id: '4', status: 'pending', taskType: 'new', difficulty: 'medium', scheduledDate: d1 },
    { id: '5', status: 'pending', taskType: 'new', difficulty: 'hard', scheduledDate: d2 },
    { id: '6', status: 'pending', taskType: 'new', difficulty: 'hard', scheduledDate: d1 },
    { id: '7', status: 'backlog', taskType: 'personal', difficulty: 'medium', scheduledDate: d1 },
  ];

  const sorted = sortTodaysTasks(rawTasks);

  // 1. Backlog (id: 7) comes first
  assert.equal(sorted[0].status, 'backlog');
  assert.equal(sorted[0].id, '7');

  // 2. Pending items next (ids 6, 5, 4, 3)
  // Within pending & taskType 'new': hard (d1 then d2), then medium
  assert.equal(sorted[1].id, '6'); // hard, d1
  assert.equal(sorted[2].id, '5'); // hard, d2
  assert.equal(sorted[3].id, '4'); // medium, d1
  assert.equal(sorted[4].id, '3'); // taskType 'revision' vs 'new'

  // 3. Completed (id: 2), then Expired (id: 1) at the bottom
  assert.equal(sorted[5].id, '2');
  assert.equal(sorted[6].id, '1');
});

test('B. Legacy fallback inclusion/exclusion in getTodaysTasks', async () => {
  const userId = `test-bug3-b-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id: userId,
      googleId: `google-${userId}`,
      email: `${userId}@example.com`,
      name: 'Bug3 User B',
    },
  });

  const currentKey = todayKey('UTC');
  const { start } = zonedDayRangeUtc(currentKey, 'UTC');
  const nowInstant = new Date(start.getTime() + 12 * 3600 * 1000); // midday today

  // Task 1: scheduledDateKey null, scheduledDate today -> INCLUDED
  const t1 = await prisma.task.create({
    data: {
      userId,
      title: 'Legacy Null Key Task',
      topic: 'Arrays',
      taskType: 'new',
      status: 'pending',
      scheduledDateKey: null,
      scheduledDate: nowInstant,
    },
  });

  // Task 2: scheduledDateKey '', scheduledDate today -> INCLUDED
  const t2 = await prisma.task.create({
    data: {
      userId,
      title: 'Legacy Empty String Key Task',
      topic: 'Arrays',
      taskType: 'new',
      status: 'pending',
      scheduledDateKey: '',
      scheduledDate: nowInstant,
    },
  });

  // Task 3: Personal Inbox task (scheduledDateKey null, scheduledDate null) -> EXCLUDED
  await prisma.task.create({
    data: {
      userId,
      title: 'Personal Inbox Task',
      topic: 'Personal',
      taskType: 'personal',
      status: 'pending',
      scheduledDateKey: null,
      scheduledDate: null,
    },
  });

  // Task 4: Parked CP31 task (scheduledDateKey null, scheduledDate null) -> EXCLUDED
  await prisma.task.create({
    data: {
      userId,
      title: 'Parked CP31 Task',
      topic: 'CP31',
      taskType: 'cp31',
      status: 'pending',
      scheduledDateKey: null,
      scheduledDate: null,
    },
  });

  const todaysTasks = await taskRepository.getTodaysTasks(userId, 'UTC');
  const taskIds = todaysTasks.map((t: { id: string }) => t.id);

  assert.ok(taskIds.includes(t1.id), 'Legacy null key task with today instant must be included');
  assert.ok(taskIds.includes(t2.id), 'Legacy empty string key task with today instant must be included');
  assert.equal(todaysTasks.length, 2, 'Inbox and parked CP31 undated tasks must be excluded');

  await prisma.task.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
});

test('C. Live-plan visibility policy', async () => {
  const userId = `test-bug3-c-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id: userId,
      googleId: `google-${userId}`,
      email: `${userId}@example.com`,
      name: 'Bug3 User C',
    },
  });

  const archivedPlan = await prisma.plan.create({
    data: {
      userId,
      name: 'Archived Study Plan',
      status: 'archived',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
    },
  });

  const todayKeyStr = todayKey('UTC');
  const { start: todayDate } = zonedDayRangeUtc(todayKeyStr, 'UTC');

  // 'new' task under archived plan -> EXCLUDED by LIVE_TASK_WHERE
  const archivedNewTask = await prisma.task.create({
    data: {
      userId,
      planId: archivedPlan.id,
      title: 'Archived Plan New Task',
      topic: 'Trees',
      taskType: 'new',
      status: 'pending',
      scheduledDateKey: todayKeyStr,
      scheduledDate: todayDate,
    },
  });

  // 'revision' task under archived plan -> INCLUDED by LIVE_TASK_WHERE
  const archivedRevTask = await prisma.task.create({
    data: {
      userId,
      planId: archivedPlan.id,
      title: 'Archived Plan Revision Task',
      topic: 'Trees',
      taskType: 'revision',
      status: 'pending',
      scheduledDateKey: todayKeyStr,
      scheduledDate: todayDate,
    },
  });

  // 'personal' task -> INCLUDED
  const personalTask = await prisma.task.create({
    data: {
      userId,
      title: 'Personal Dated Task',
      topic: 'Personal',
      taskType: 'personal',
      status: 'pending',
      scheduledDateKey: todayKeyStr,
      scheduledDate: todayDate,
    },
  });

  const todaysTasks = await taskRepository.getTodaysTasks(userId, 'UTC');
  const taskIds = todaysTasks.map((t: { id: string }) => t.id);

  assert.ok(!taskIds.includes(archivedNewTask.id), 'Archived plan new task must be excluded');
  assert.ok(taskIds.includes(archivedRevTask.id), 'Archived plan revision task must be included');
  assert.ok(taskIds.includes(personalTask.id), 'Personal task must be included');

  await prisma.task.deleteMany({ where: { userId } });
  await prisma.plan.delete({ where: { id: archivedPlan.id } });
  await prisma.user.delete({ where: { id: userId } });
});

test('D. Roadmap/Today consistency for revisions from archived plans', async () => {
  const userId = `test-bug3-d-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id: userId,
      googleId: `google-${userId}`,
      email: `${userId}@example.com`,
      name: 'Bug3 User D',
    },
  });

  const archivedPlan = await prisma.plan.create({
    data: {
      userId,
      name: 'Archived Roadmap Plan',
      status: 'archived',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
    },
  });

  const todayKeyStr = todayKey('UTC');
  const { start: todayDate } = zonedDayRangeUtc(todayKeyStr, 'UTC');

  const parentTask = await prisma.task.create({
    data: {
      userId,
      planId: archivedPlan.id,
      title: 'Parent Problem',
      topic: 'Graphs',
      taskType: 'new',
      status: 'completed',
      scheduledDateKey: '2026-03-15',
      scheduledDate: new Date('2026-03-15'),
    },
  });

  const revTask = await prisma.task.create({
    data: {
      userId,
      planId: archivedPlan.id,
      parentTaskId: parentTask.id,
      title: 'Revision Problem',
      topic: 'Graphs',
      taskType: 'revision',
      status: 'pending',
      revisionNumber: 1,
      scheduledDateKey: todayKeyStr,
      scheduledDate: todayDate,
    },
  });

  const todaysTasks = await taskRepository.getTodaysTasks(userId, 'UTC');
  const activePlanData = await planService.getActivePlan(userId, 'UTC');

  const todayTaskIds = todaysTasks.map((t: { id: string }) => t.id);
  const activePlanRevIds = activePlanData.revisions.map((r: { id: string }) => r.id);

  assert.ok(todayTaskIds.includes(revTask.id), 'Archived plan revision task appears in Today query');
  assert.ok(activePlanRevIds.includes(revTask.id), 'Archived plan revision task appears in active plan revision list');

  await prisma.task.deleteMany({ where: { userId } });
  await prisma.plan.delete({ where: { id: archivedPlan.id } });
  await prisma.user.delete({ where: { id: userId } });
});

test('E. Backlog cron side effect: archived plan revision enters backlog', async () => {
  // Intentional policy change: revision tasks from archived plans enter backlog
  // because LIVE_TASK_WHERE now includes non-new tasks regardless of plan status.
  const userId = `test-bug3-e-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id: userId,
      googleId: `google-${userId}`,
      email: `${userId}@example.com`,
      name: 'Bug3 User E',
    },
  });

  const archivedPlan = await prisma.plan.create({
    data: {
      userId,
      name: 'Archived Plan E',
      status: 'archived',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
    },
  });

  // Overdue revision task scheduled yesterday under archived plan
  const overdueRevTask = await prisma.task.create({
    data: {
      userId,
      planId: archivedPlan.id,
      title: 'Overdue Archived Revision',
      topic: 'DP',
      taskType: 'revision',
      status: 'pending',
      revisionNumber: 1,
      scheduledDateKey: '2026-03-31',
      scheduledDate: new Date('2026-03-31T00:00:00.000Z'),
    },
  });

  await runBacklogCron();

  const updatedTask = await prisma.task.findUnique({ where: { id: overdueRevTask.id } });

  assert.ok(updatedTask, 'Overdue revision task must exist');
  assert.equal(updatedTask?.status, 'backlog', 'Overdue revision from archived plan transitions to backlog');
  assert.equal(updatedTask?.isBacklog, true, 'isBacklog set to true');

  await prisma.task.deleteMany({ where: { userId } });
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.plan.delete({ where: { id: archivedPlan.id } });
  await prisma.user.delete({ where: { id: userId } });
});

test('F. getTaskById plan-archived surfacing', async () => {
  const userId = `test-bug3-f-${randomUUID()}`;
  const otherUserId = `test-bug3-f-other-${randomUUID()}`;

  await prisma.user.createMany({
    data: [
      { id: userId, googleId: `google-${userId}`, email: `${userId}@example.com`, name: 'User F' },
      { id: otherUserId, googleId: `google-${otherUserId}`, email: `${otherUserId}@example.com`, name: 'User F Other' },
    ],
  });

  const archivedPlan = await prisma.plan.create({
    data: {
      userId,
      name: 'Archived Plan F',
      status: 'archived',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
    },
  });

  const activePlan = await prisma.plan.create({
    data: {
      userId,
      name: 'Active Plan F',
      status: 'active',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-30'),
    },
  });

  const archivedTask = await prisma.task.create({
    data: {
      userId,
      planId: archivedPlan.id,
      title: 'Task in Archived Plan',
      topic: 'Arrays',
      taskType: 'new',
      status: 'pending',
      scheduledDateKey: '2026-04-01',
      scheduledDate: new Date('2026-04-01'),
    },
  });

  const activeTask = await prisma.task.create({
    data: {
      userId,
      planId: activePlan.id,
      title: 'Task in Active Plan',
      topic: 'Arrays',
      taskType: 'new',
      status: 'pending',
      scheduledDateKey: '2026-04-01',
      scheduledDate: new Date('2026-04-01'),
    },
  });

  const personalTask = await prisma.task.create({
    data: {
      userId,
      title: 'Personal Task',
      topic: 'Personal',
      taskType: 'personal',
      status: 'pending',
      scheduledDateKey: '2026-04-01',
      scheduledDate: new Date('2026-04-01'),
    },
  });

  // 1. Task in archived plan -> isPlanArchived: true
  const res1 = await taskService.getTaskById(archivedTask.id, userId);
  assert.equal(res1.isPlanArchived, true);

  // 2. Task in active plan -> isPlanArchived: false
  const res2 = await taskService.getTaskById(activeTask.id, userId);
  assert.equal(res2.isPlanArchived, false);

  // 3. Task without plan -> isPlanArchived: false
  const res3 = await taskService.getTaskById(personalTask.id, userId);
  assert.equal(res3.isPlanArchived, false);

  // 4. Fetch another user's task -> throws NotFoundError
  await assert.rejects(async () => {
    await taskService.getTaskById(archivedTask.id, otherUserId);
  }, /Task/);

  await prisma.task.deleteMany({ where: { userId } });
  await prisma.plan.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
});

test('G. Index existence check in migration file', () => {
  const migrationsDir = path.join(__dirname, '../../prisma/migrations');
  const files = fs.readdirSync(migrationsDir);
  const targetFolder = files.find((f) => f.endsWith('_add_plan_assignment_status_indexes'));
  assert.ok(targetFolder, 'Migration directory with name ending in _add_plan_assignment_status_indexes must exist');

  const migrationPath = path.join(migrationsDir, targetFolder, 'migration.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration SQL file must exist');

  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(
    content.includes('CREATE INDEX "plans_user_id_status_idx" ON "plans"("user_id", "status");'),
    'Migration SQL creates plans_user_id_status_idx',
  );
  assert.ok(
    content.includes('CREATE INDEX "assignments_user_id_status_idx" ON "assignments"("user_id", "status");'),
    'Migration SQL creates assignments_user_id_status_idx',
  );
});
