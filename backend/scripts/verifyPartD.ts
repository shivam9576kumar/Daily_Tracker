/**
 * Part D verification script — Todo API Integration & Action Endpoints
 * Usage: npm run verify:part-d --workspace=backend
 */
import prisma from '../src/config/database';
import { todoService } from '../src/services/todo/todoService';
import { dailyChallengeSettingsService } from '../src/services/dailyChallenges/dailyChallengeSettingsService';
import { cp31Service } from '../src/services/cp31/cp31Service';
import { taskCompletionService } from '../src/services/task/taskCompletionService';
import { getCp31Problems } from '../src/services/plan/cp31SheetLoader';
import { todayKey, addDaysToKey } from '../src/utils/dateKeys';

const TZ = 'Asia/Kolkata';
let failures = 0;

function check(name: string, cond: boolean, detail = '') {
  if (!cond) failures++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function rejects(fn: () => Promise<unknown>, label: string) {
  let r = false;
  try {
    await fn();
  } catch {
    r = true;
  }
  check(`rejects: ${label}`, r);
}

async function main() {
  const email = 'partd-test@test.local';
  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: {
      googleId: `partd-${Date.now()}`,
      email,
      name: 'Part D User',
      coins: 0,
      timezone: TZ,
      potdEnabled: true,
      cp31Enabled: false,
      cp31Band: null,
      cp31DailyCount: 1,
    },
  });
  const uid = user.id;
  const today = todayKey(TZ);
  const tomorrow = addDaysToKey(today, 1);

  try {
    // 1. Initial GET todo (CP31 disabled)
    const todo1 = await todoService.getTodo(uid, TZ, 14);
    check('dailyChallenges.potd.enabled is true', todo1.dailyChallenges.potd.enabled === true);
    check('dailyChallenges.cp31.enabled is false', todo1.dailyChallenges.cp31.enabled === false);
    check('dailyChallenges.cp31.bandStatus is none', todo1.dailyChallenges.cp31.bandStatus === 'none');
    check('today.cp31 is empty array', Array.isArray(todo1.today.cp31) && todo1.today.cp31.length === 0);

    // 2. Enable CP31 band 1300
    await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31Enabled: true });
    const todo2 = await todoService.getTodo(uid, TZ, 14);

    check('dailyChallenges.cp31.enabled is true after enable', todo2.dailyChallenges.cp31.enabled === true);
    check('dailyChallenges.cp31.band is 1300', todo2.dailyChallenges.cp31.band === 1300);
    check('dailyChallenges.cp31.bandStatus is active', todo2.dailyChallenges.cp31.bandStatus === 'active');
    check('today.cp31 contains served task cp31-1300-01', todo2.today.cp31.length === 1 && todo2.today.cp31[0].cp31ProblemId === 'cp31-1300-01');
    check('summary.today count includes CP31 pending task', todo2.summary.today >= 1);
    check('backlog is empty (CP31 never in backlog)', todo2.backlog.length === 0);

    const cp31TaskId = todo2.today.cp31[0].id;

    // 3. Solve cp31-1300-01
    await taskCompletionService.completeTask(uid, cp31TaskId, 'medium', TZ);
    const todo3 = await todoService.getTodo(uid, TZ, 14);
    check('quotaDoneToday is true after solve', todo3.dailyChallenges.cp31.quotaDoneToday === true);
    check('solvedInBand is 1', todo3.dailyChallenges.cp31.solvedInBand === 1);
    check('today.cp31 is empty (task moved to today.completed)', todo3.today.cp31.length === 0);
    check('today.completed contains solved CP31 task', todo3.today.completed.some((t) => t.id === cp31TaskId));

    // 4. One-More action endpoint simulation (serve index 02)
    const om1 = await cp31Service.serveOneMore(uid, TZ);
    check('oneMore serves index 02', om1.state.pendingTaskIds.length === 1);

    const todoOm1 = await todoService.getTodo(uid, TZ, 14);
    check('today.cp31 contains index 02', todoOm1.today.cp31.length === 1 && todoOm1.today.cp31[0].cp31ProblemId === 'cp31-1300-02');

    // 5. Skip cp31-1300-02
    const skippedTask = await cp31Service.skipCp31Problem(uid, om1.taskId);
    check('skipProblem sets status skipped and skippedAt timestamp', skippedTask.status === 'skipped' && skippedTask.skippedAt !== null);

    const todoSkip = await todoService.getTodo(uid, TZ, 14);
    check('today.cp31 is empty after skip', todoSkip.today.cp31.length === 0);
    check('skippedCount is 1', todoSkip.dailyChallenges.cp31.skippedCount === 1);

    // 6. One-More cap test (serve 3 completed extras, 4th extra rejected)
    const om2 = await cp31Service.serveOneMore(uid, TZ); // extra #1 completed today
    await taskCompletionService.completeTask(uid, om2.taskId, 'medium', TZ);

    const om3 = await cp31Service.serveOneMore(uid, TZ); // extra #2 completed today
    await taskCompletionService.completeTask(uid, om3.taskId, 'medium', TZ);

    const om4 = await cp31Service.serveOneMore(uid, TZ); // extra #3 completed today
    await taskCompletionService.completeTask(uid, om4.taskId, 'medium', TZ);

    await rejects(() => cp31Service.serveOneMore(uid, TZ), '4th One More (cap 3 reached)');

    // 7. Advance band test (incomplete band fails, complete band succeeds)
    await rejects(() => cp31Service.advanceCp31Band(uid), 'advance-band when incomplete');

    // Complete rest of band synthetically
    const existingTasks = await prisma.task.findMany({ where: { userId: uid, taskType: 'cp31' } });
    const existingIds = new Set(existingTasks.map((t) => t.cp31ProblemId));
    const rest = getCp31Problems(1300).filter((p) => !existingIds.has(p.id));

    await prisma.task.createMany({
      data: rest.map((p) => ({
        userId: uid,
        taskType: 'cp31',
        status: 'skipped',
        skippedAt: new Date(),
        title: p.title,
        topic: 'CF 1300',
        difficulty: 'medium',
        platform: 'codeforces',
        problemUrl: p.url,
        scheduledDate: null,
        scheduledDateKey: null,
        cp31ProblemId: p.id,
      })),
    });

    const todoComplete = await todoService.getTodo(uid, TZ, 14);
    check('bandStatus is complete-awaiting-confirm when all 31 rows created', todoComplete.dailyChallenges.cp31.bandStatus === 'complete-awaiting-confirm');

    const nextBand = await cp31Service.advanceCp31Band(uid);
    check('advanceBand updates band to 1400', nextBand === 1400);

    const todoAdvanced = await todoService.getTodo(uid, TZ, 14);
    check('after advanceBand, new band is 1400 and index 01 is served in today.cp31', todoAdvanced.dailyChallenges.cp31.band === 1400 && todoAdvanced.today.cp31[0].cp31ProblemId === 'cp31-1400-01');

    // 8. View Assertions & Regression
    // CP31 tasks NEVER in backlog
    const allBacklog = await prisma.task.findMany({ where: { userId: uid, taskType: 'cp31', isBacklog: true } });
    check('CP31 tasks NEVER in backlog', allBacklog.length === 0);

  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? '\n✅ ALL PART D CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
