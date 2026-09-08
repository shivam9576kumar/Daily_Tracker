/**
 * Part C verification — CP31 Ladder Engine Core.
 * Usage: npm run verify:cp31 --workspace=backend
 */
import prisma from '../src/config/database';
import { cp31Service } from '../src/services/cp31/cp31Service';
import { computeCp31Streak } from '../src/services/cp31/cp31StreakService';
import { taskCompletionService } from '../src/services/task/taskCompletionService';
import { dailyChallengeSettingsService } from '../src/services/dailyChallenges/dailyChallengeSettingsService';
import { runBacklogCron } from '../src/cron/backlogCron';
import { runExpiryCron } from '../src/cron/expiryCron';
import { getCp31Problems } from '../src/services/plan/cp31SheetLoader';

const TZ = 'Asia/Kolkata';
let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) failures++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

const coinsOf = async (id: string) =>
  (await prisma.user.findUnique({ where: { id }, select: { coins: true } }))?.coins ?? 0;

async function main() {
  const emails = ['partc-test-1@test.local'];
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  const u = await prisma.user.create({
    data: {
      googleId: `partc1-${Date.now()}`,
      email: emails[0],
      name: 'Part C User',
      coins: 0,
      timezone: TZ,
      cp31Enabled: true,
      cp31Band: 1300,
      cp31DailyCount: 1,
    },
  });
  const uid = u.id;

  try {
    // 1. Ensure serves exactly cp31DailyCount tasks
    const served1 = await cp31Service.ensureCp31TasksForUser(uid, TZ);
    check('ensure serves 1 task', served1.length === 1 && served1[0].cp31ProblemId === 'cp31-1300-01');

    // 2. Option B pause: while task 1 is pending, ensure returns task 1
    const servedPause = await cp31Service.ensureCp31TasksForUser(uid, TZ);
    check('Option B: returns pending carryover', servedPause.length === 1 && servedPause[0].id === served1[0].id);

    // 3. Solve task 1 -> +10 coins, +4 revisions if rated
    await taskCompletionService.completeTask(uid, served1[0].id, 'medium', TZ);
    check('solve CP31 task → +15 coins (+10 solve + 5 medium bonus)', (await coinsOf(uid)) === 15);

    // 4. Ensure serves 0 tasks when quota met and no pending task
    const servedQuotaMet = await cp31Service.ensureCp31TasksForUser(uid, TZ);
    check('ensure serves 0 when quota met', servedQuotaMet.length === 0);

    const revs = await prisma.task.count({ where: { parentTaskId: served1[0].id, taskType: 'revision' } });
    check('medium rating on CP31 task creates 4 revisions', revs === 4);

    // 5. One More: serve next problem beyond quota
    const extra1 = await cp31Service.serveOneMore(uid, TZ);
    check('serveOneMore serves index 02', extra1.cp31ProblemId === 'cp31-1300-02');

    // Attempting One More while extra1 is pending should fail
    let oneMorePendingRejected = false;
    try {
      await cp31Service.serveOneMore(uid, TZ);
    } catch {
      oneMorePendingRejected = true;
    }
    check('One More fails if current task is pending', oneMorePendingRejected);

    // 6. Skip task 2 -> isSkipped: true, status: completed, 0 coins added
    const coinsBeforeSkip = await coinsOf(uid);
    const skippedTask = await cp31Service.skipProblem(uid, extra1.id);
    check('skipProblem sets isSkipped: true & status: completed', skippedTask.isSkipped === true && skippedTask.status === 'completed');
    check('skipProblem awards 0 coins', (await coinsOf(uid)) === coinsBeforeSkip);

    // 7. Cap at 3 extras/day: serve extras 2 and 3
    const extra2 = await cp31Service.serveOneMore(uid, TZ); // extra #2 (index 03)
    await cp31Service.skipProblem(uid, extra2.id);

    const extra3 = await cp31Service.serveOneMore(uid, TZ); // extra #3 (index 04)
    await cp31Service.skipProblem(uid, extra3.id);

    // 4th extra on same day (beyond 3 extras cap) should throw cap error
    let extraCapRejected = false;
    try {
      await cp31Service.serveOneMore(uid, TZ);
    } catch {
      extraCapRejected = true;
    }
    check('One More cap (3 extras/day) enforced', extraCapRejected);

    // 8. Advance band fails if band incomplete
    let advanceIncompleteRejected = false;
    try {
      await cp31Service.advanceBand(uid);
    } catch {
      advanceIncompleteRejected = true;
    }
    check('advanceBand fails if band incomplete', advanceIncompleteRejected);

    // 9. Complete remainder of 1300 band (indexes 05..31) synthetically to test band completion & advancement
    const p1300 = getCp31Problems(1300);
    for (const p of p1300.slice(4)) {
      await prisma.task.create({
        data: {
          userId: uid,
          taskType: 'cp31',
          cp31ProblemId: p.id,
          title: p.title,
          topic: 'Codeforces',
          difficulty: 'medium',
          platform: 'codeforces',
          problemUrl: p.url,
          status: 'completed',
          isSkipped: true,
          completedAt: new Date(),
        },
      });
    }

    const bandState = await cp31Service.bandStatus(uid);
    check('bandStatus returns complete-awaiting-confirm when 1300 full', bandState.status === 'complete-awaiting-confirm' && bandState.solved + bandState.skipped === 31);

    const advanceRes = await cp31Service.advanceBand(uid);
    check('advanceBand moves band to 1400', advanceRes.cp31Band === 1400);

    // 10. Streak computation derive-on-read
    const streak = await computeCp31Streak(uid, TZ);
    check('computeCp31Streak totalSolved counts solved non-skipped tasks', streak.totalSolved === 1);

    // 11. Crons: CP31 tasks never move to backlog or expire
    await prisma.task.create({
      data: {
        userId: uid,
        taskType: 'cp31',
        cp31ProblemId: 'cp31-1400-01',
        title: 'Old CP31',
        topic: 'Codeforces',
        status: 'pending',
        scheduledDateKey: '2020-01-01',
      },
    });

    await runBacklogCron();
    const cp31Backlog = await prisma.task.count({ where: { userId: uid, taskType: 'cp31', status: 'backlog' } });
    check('Backlog cron excludes cp31 tasks', cp31Backlog === 0);

    await runExpiryCron();
    const cp31Expired = await prisma.task.count({ where: { userId: uid, taskType: 'cp31', status: 'expired' } });
    check('Expiry cron excludes cp31 tasks', cp31Expired === 0);

  } finally {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? '\n✅ ALL PART C CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
