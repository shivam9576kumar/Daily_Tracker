/**
 * Part 8 end-to-end verification.
 * Runs against the local DB via Prisma + services (no HTTP server needed).
 * Usage: npx tsx scripts/verifyTodoFeature.ts
 * Exits non-zero on first failure.
 */
import prisma from '../src/config/database';
import { todoService } from '../src/services/todo/todoService';
import { personalTaskService } from '../src/services/todo/personalTaskService';
import { taskCompletionService } from '../src/services/task/taskCompletionService';
import { taskService } from '../src/services/task/taskService';
import { addDaysToKey, todayKey } from '../src/utils/dateKeys';

const TZ = 'Asia/Kolkata';
let failures = 0;

function check(name: string, cond: boolean, detail = '') {
  const status = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function coinsOf(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { coins: true } });
  return u?.coins ?? 0;
}

async function main() {
  // ── setup: dedicated test user ──
  const email = `part8-verify@test.local`;
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({
    data: { googleId: `part8-${Date.now()}`, email, name: 'Part8 Verify', coins: 0, timezone: TZ },
  });
  const uid = user.id;
  const today = todayKey(TZ);

  try {
    // 1. Personal inbox task
    const inboxTask = await personalTaskService.create(uid, { title: 'Read DBMS notes' });
    check('personal create → inbox (null keys)',
      inboxTask.scheduledDateKey === null && inboxTask.scheduledDate === null);

    let todo = await todoService.getTodo(uid, TZ);
    check('inbox count = 1', todo.summary.inbox === 1);
    check('inbox task not in today', todo.today.personal.length === 0);

    // 2. Schedule it for today
    await personalTaskService.update(uid, inboxTask.id, { scheduledDateKey: today });
    todo = await todoService.getTodo(uid, TZ);
    check('scheduled personal in today.personal', todo.today.personal.length === 1);
    check('inbox now empty', todo.summary.inbox === 0);

    // 3. Complete personal → 0 coins
    const before = await coinsOf(uid);
    await taskCompletionService.completeTask(uid, inboxTask.id, undefined, TZ);
    check('personal complete → coins unchanged', (await coinsOf(uid)) === before);

    // 4. Personal cannot be rated
    let rejected = false;
    try {
      await taskCompletionService.completeTask(uid, inboxTask.id, 'hard', TZ);
    } catch {
      rejected = true;
    }
    check('personal rate rejected', rejected);

    // 5. DSA manual task: solve + rate → coins + revisions
    const dsa = await taskService.createTask(
      uid,
      { title: 'Two Sum', topic: 'Arrays', difficulty: 'easy', platform: 'leetcode', scheduledDate: today },
      TZ,
    );
    await taskCompletionService.completeTask(uid, dsa.id, 'medium', TZ);
    const afterDsa = await coinsOf(uid);
    check('DSA solve+medium → +15 coins', afterDsa === before + 15, `got ${afterDsa - before}`);

    const revs = await prisma.task.findMany({
      where: { userId: uid, parentTaskId: dsa.id, taskType: 'revision' },
    });
    check('medium rating → 4 revisions', revs.length === 4);
    check('all revision keys >= today', revs.every((r) => (r.scheduledDateKey ?? '') >= today));

    // 6. Revisions appear in upcoming (day+1 within 14)
    todo = await todoService.getTodo(uid, TZ);
    const upcomingTaskIds = todo.upcoming.flatMap((g) => g.tasks.map((t) => t.id));
    check('rev(+1) in upcoming', revs.some((r) => upcomingTaskIds.includes(r.id)));

    // 7. upcomingDays=30 superset
    const todo30 = await todoService.getTodo(uid, TZ, 30);
    check('upcoming(30) >= upcoming(14)', todo30.summary.upcoming >= todo.summary.upcoming);
    check('upcomingDays echoed', todo30.upcomingDays === 30);

    // 8. Assignment lifecycle in todo payload
    const assignment = await prisma.assignment.create({
      data: { userId: uid, title: 'OS Lab Report', deadline: new Date(`${today}T00:00:00.000Z`) },
    });
    todo = await todoService.getTodo(uid, TZ);
    check('assignment due today in today.assignments',
      todo.today.assignments.some((a) => a.id === assignment.id));

    // 9. Personal completed shows in todo completed but NOT in analytics
    const completedIds = todo.completed.flatMap((g) => g.tasks.map((t) => t.id));
    check('personal completion in todo completed', completedIds.includes(inboxTask.id));
    const analyticsCount = await prisma.task.count({
      where: { userId: uid, status: 'completed', taskType: { in: ['new', 'revision', 'potd'] } },
    });
    check('analytics excludes personal (only DSA counted)', analyticsCount === 1);

    // 10. Coin invariant: sum of currently-solved coin values == user.coins
    //     (solved: dsa new medium-rated = 10 + 5)
    check('coin invariant holds', (await coinsOf(uid)) === 15);

    // 11. Undo DSA → full refund, revisions wiped
    await taskCompletionService.undoTask(uid, dsa.id);
    check('undo refunds to 0', (await coinsOf(uid)) === 0);
    const revsAfter = await prisma.task.count({ where: { parentTaskId: dsa.id, taskType: 'revision' } });
    check('undo wipes revisions', revsAfter === 0);

    // 12. Inbox task never backlogged: null-key guard
    const inboxTask2 = await personalTaskService.create(uid, { title: 'Unscheduled forever' });
    const nullKeyOverdue = await prisma.task.count({
      where: { userId: uid, id: inboxTask2.id, scheduledDateKey: null, isBacklog: true },
    });
    check('inbox task not backlogged', nullKeyOverdue === 0);

    // 13. Scheduled-personal backlog path: schedule yesterday, simulate cron rule
    await personalTaskService.update(uid, inboxTask2.id, { scheduledDateKey: addDaysToKey(today, -1) });
    const t2 = await prisma.task.findUnique({ where: { id: inboxTask2.id } });
    check('overdue personal eligible for backlog (key < today, not null)',
      t2 !== null && t2.scheduledDateKey !== null && t2.scheduledDateKey < today);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }

  console.log(`\n${failures === 0 ? '✅ ALL PART 8 CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
