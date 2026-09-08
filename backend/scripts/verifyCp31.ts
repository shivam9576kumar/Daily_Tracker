/**
 * Part C verification — CP31 ladder engine. Runs against the local DB via services.
 * Usage: npm run verify:cp31 --workspace=backend
 * Note: step 14 runs the real backlog cron (idempotent, same as the daily job).
 */
import prisma from '../src/config/database';
import {
  ensureCp31TasksForUser, serveOneMore, skipCp31Problem, retrySkippedCp31,
  advanceCp31Band, getCp31Overview, listSkippedCp31, CP31_EXTRAS_CAP,
} from '../src/services/cp31/cp31Service';
import { computeCp31Streak } from '../src/services/cp31/cp31StreakService';
import { dailyChallengeSettingsService } from '../src/services/dailyChallenges/dailyChallengeSettingsService';
import { taskCompletionService } from '../src/services/task/taskCompletionService';
import { taskService } from '../src/services/task/taskService';
import { progressService } from '../src/services/progress/progressService';
import { streakService } from '../src/services/progress/streakService';
import { runBacklogCron } from '../src/cron/backlogCron';
import { getCp31Problems } from '../src/services/plan/cp31SheetLoader';
import { addDaysToKey, todayKey } from '../src/utils/dateKeys';

const TZ = 'Asia/Kolkata';
let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (!cond) failures++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
};
const coinsOf = async (id: string) =>
  (await prisma.user.findUnique({ where: { id }, select: { coins: true } }))?.coins ?? 0;
const yesterdayInstant = () => new Date(Date.now() - 24 * 3600 * 1000);
const utcMidnight = (k: string) => new Date(`${k}T00:00:00.000Z`);

async function rejects(fn: () => Promise<unknown>, label: string) {
  let r = false;
  try { await fn(); } catch { r = true; }
  check(`rejects: ${label}`, r);
}

async function main() {
  const email = 'partc-cp31@test.local';
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({
    data: { googleId: `partc-${Date.now()}`, email, name: 'Part C', coins: 0, timezone: TZ },
  });
  const uid = user.id;
  const today = todayKey(TZ);
  const yKey = addDaysToKey(today, -1);
  let expectedCoins = 0;
  const cp31 = (extra: object = {}) => prisma.task.findMany({ where: { userId: uid, taskType: 'cp31', ...extra } });

  try {
    // 1. Off by default
    const s0 = await ensureCp31TasksForUser(uid, TZ);
    check('off → enabled=false, bandStatus none, no rows', !s0.enabled && s0.bandStatus === 'none' && (await cp31()).length === 0);

    // 2. Enable 1300 (count 1) → serves #1 exactly once
    await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31Enabled: true });
    const s1 = await ensureCp31TasksForUser(uid, TZ);
    const r1 = await cp31();
    check('enable → serves cp31-1300-01', s1.servedNow.length === 1 && r1.length === 1 && r1[0].cp31ProblemId === 'cp31-1300-01');
    check('row shape: planId null, platform codeforces, key today, topic CF 1300',
      r1[0].planId === null && r1[0].platform === 'codeforces' && r1[0].scheduledDateKey === today && r1[0].topic === 'CF 1300');
    const s1b = await ensureCp31TasksForUser(uid, TZ);
    check('ensure idempotent (no second serve)', s1b.servedNow.length === 0 && (await cp31()).length === 1);
    check('state: pending 1, quota not done, no One More', s1b.pendingCount === 1 && !s1b.quotaDoneToday && !s1b.canOneMore);

    // 3. Carry-over: simulate yesterday's serve → bumped to today, ladder paused
    await prisma.task.update({ where: { id: r1[0].id }, data: { scheduledDateKey: yKey, scheduledDate: utcMidnight(yKey) } });
    const s2 = await ensureCp31TasksForUser(uid, TZ);
    const bumped = await prisma.task.findUnique({ where: { id: r1[0].id } });
    check('carry-over bumped to today, no new serve (ladder pauses)', bumped?.scheduledDateKey === today && s2.servedNow.length === 0 && (await cp31()).length === 1);

    // 4. Solve #1 rated hard → +20 coins, 5 revisions, codeforces platform on revisions
    await taskCompletionService.completeTask(uid, r1[0].id, 'hard', TZ);
    expectedCoins += 20;
    check('solve hard → +20 coins', (await coinsOf(uid)) === expectedCoins);
    const revs = await prisma.task.findMany({ where: { userId: uid, parentTaskId: r1[0].id, taskType: 'revision' } });
    check('hard → 5 revisions, platform codeforces, no cp31ProblemId',
      revs.length === 5 && revs.every((r) => r.platform === 'codeforces' && r.cp31ProblemId === null));
    const s3 = await ensureCp31TasksForUser(uid, TZ);
    check('after quota: pending 0, solvedToday 1, quotaDone, canOneMore, extras 0',
      s3.pendingCount === 0 && s3.solvedToday === 1 && s3.quotaDoneToday && s3.canOneMore && s3.extrasUsedToday === 0 && s3.servedNow.length === 0);

    // 5. One More ×3 (must solve between), 4th rejected
    for (let i = 2; i <= 4; i++) {
      const om = await serveOneMore(uid, TZ);
      const t = await prisma.task.findUnique({ where: { id: om.taskId } });
      check(`One More #${i - 1} serves cp31-1300-0${i}`, t?.cp31ProblemId === `cp31-1300-0${i}` && !om.state.canOneMore);
      await rejects(() => serveOneMore(uid, TZ), `One More while #${i} pending`);
      await taskCompletionService.completeTask(uid, om.taskId, undefined, TZ);
      expectedCoins += 10;
    }
    const s4 = await ensureCp31TasksForUser(uid, TZ);
    check('extrasUsedToday = 3 = cap, canOneMore false', s4.extrasUsedToday === CP31_EXTRAS_CAP && !s4.canOneMore);
    await rejects(() => serveOneMore(uid, TZ), '4th One More (cap)');
    check('coins after One More session', (await coinsOf(uid)) === expectedCoins);

    // 6. Next day: shift completions to yesterday → quota refills with #5
    await prisma.task.updateMany({ where: { userId: uid, taskType: 'cp31', status: 'completed' }, data: { completedAt: yesterdayInstant() } });
    const s5 = await ensureCp31TasksForUser(uid, TZ);
    const t5 = await prisma.task.findFirst({ where: { userId: uid, cp31ProblemId: 'cp31-1300-05' } });
    check('next day serves #5; extras reset', s5.servedNow.length === 1 && t5?.status === 'pending' && s5.extrasUsedToday === 0);

    // 7. Skip #5 → ladder advances to #6; retry #5 → pending today
    await skipCp31Problem(uid, t5!.id);
    const s6 = await ensureCp31TasksForUser(uid, TZ);
    const t6 = await prisma.task.findFirst({ where: { userId: uid, cp31ProblemId: 'cp31-1300-06' } });
    const skipped = await listSkippedCp31(uid);
    check('skip → #5 skipped (null keys), #6 served', t6?.status === 'pending' && s6.skippedInBand === 1 && skipped.length === 1 && skipped[0].scheduledDateKey === null);
    await retrySkippedCp31(uid, t5!.id, TZ);
    const t5b = await prisma.task.findUnique({ where: { id: t5!.id } });
    check('retry → #5 pending today, skippedAt cleared', t5b?.status === 'pending' && t5b.scheduledDateKey === today && t5b.skippedAt === null);
    await rejects(() => retrySkippedCp31(uid, t6!.id, TZ), 'retry on a non-skipped task');
    await taskCompletionService.completeTask(uid, t5!.id, 'easy', TZ);   // easy → +10, 2 revisions
    expectedCoins += 10;
    await taskCompletionService.completeTask(uid, t6!.id, undefined, TZ);
    expectedCoins += 10;
    check('coins after retry+solve', (await coinsOf(uid)) === expectedCoins);

    // 8. Notes work on CP31 tasks (same Note system)
    const note = await prisma.note.create({ data: { taskId: t6!.id, userId: uid, content: 'greedy + prefix sums' } });
    check('note attaches to cp31 task', note.taskId === t6!.id);

    // 9. Band complete via skipped rows (no coin impact) → confirm-to-advance
    const served = new Set((await cp31()).map((r) => r.cp31ProblemId));
    const rest = getCp31Problems(1300).filter((p) => !served.has(p.id));
    await prisma.task.createMany({
      data: rest.map((p) => ({
        userId: uid, taskType: 'cp31', status: 'skipped', skippedAt: yesterdayInstant(),
        title: p.title, topic: 'CF 1300', difficulty: 'medium', platform: 'codeforces',
        problemUrl: p.url, scheduledDate: null, scheduledDateKey: null, cp31ProblemId: p.id,
      })),
    });
    const s7 = await ensureCp31TasksForUser(uid, TZ);
    check('band complete → awaiting confirm, nothing served', s7.bandStatus === 'complete-awaiting-confirm' && s7.servedNow.length === 0 && s7.nextBand === 1400);
    await rejects(() => serveOneMore(uid, TZ), 'One More on complete band');
    await rejects(() => advanceCp31Band(uid, 9999), 'advance to unknown band');
    const nb = await advanceCp31Band(uid);
    const s8 = await ensureCp31TasksForUser(uid, TZ);
    const t1400 = await prisma.task.findFirst({ where: { userId: uid, cp31ProblemId: 'cp31-1400-01' } });
    check('advance → 1400, serves cp31-1400-01', nb === 1400 && s8.band === 1400 && t1400?.status === 'pending');

    // 10. Disable → pending removed, history intact, coins unchanged
    const off = await dailyChallengeSettingsService.update(uid, { cp31Enabled: false });
    const s9 = await ensureCp31TasksForUser(uid, TZ);
    check('disable removes 1 pending, ensure off, coins same',
      off.changes.cp31PendingRemoved === 1 && !s9.enabled && (await cp31({ status: 'pending' })).length === 0 && (await coinsOf(uid)) === expectedCoins);
    check('completed + skipped rows survive disable', (await cp31({ status: 'completed' })).length === 6 && (await cp31({ status: 'skipped' })).length === rest.length);

    // 11. Re-enable same band → resume re-serves cp31-1400-01
    await dailyChallengeSettingsService.update(uid, { cp31Enabled: true });
    const s10 = await ensureCp31TasksForUser(uid, TZ);
    const t1400b = await prisma.task.findFirst({ where: { userId: uid, cp31ProblemId: 'cp31-1400-01' } });
    check('re-enable resumes at cp31-1400-01', s10.enabled && s10.band === 1400 && t1400b?.status === 'pending' && s10.servedNow.length === 1);

    // 12. Per-band memory: solve 1400-01/02, switch to 1500, switch back → next is #3
    await taskCompletionService.completeTask(uid, t1400b!.id, undefined, TZ); expectedCoins += 10;
    await prisma.task.update({ where: { id: t1400b!.id }, data: { completedAt: yesterdayInstant() } });
    const s11 = await ensureCp31TasksForUser(uid, TZ);
    const t1400c = await prisma.task.findFirst({ where: { userId: uid, cp31ProblemId: 'cp31-1400-02' } });
    check('serves 1400-02', s11.servedNow.length === 1 && t1400c?.status === 'pending');
    await taskCompletionService.completeTask(uid, t1400c!.id, undefined, TZ); expectedCoins += 10;
    const sw1 = await dailyChallengeSettingsService.update(uid, { cp31Band: 1500 });
    const s12 = await ensureCp31TasksForUser(uid, TZ);
    check('switch to 1500 (nothing pending removed) serves 1500-01', sw1.changes.cp31PendingRemoved === 0 && s12.band === 1500 && s12.servedNow.length === 1);
    const sw2 = await dailyChallengeSettingsService.update(uid, { cp31Band: 1400 });
    const s13 = await ensureCp31TasksForUser(uid, TZ);
    check('switch back removes pending 1500-01, 1400 memory nextIndex=3 (quota already done today)',
      sw2.changes.cp31PendingRemoved === 1 && s13.band === 1400 && s13.nextIndex === 3 && s13.solvedInBand === 2 && s13.servedNow.length === 0);
    const ov = await getCp31Overview(uid);
    const b1300 = ov.bands.find((b) => b.band === 1300)!;
    const b1400 = ov.bands.find((b) => b.band === 1400)!;
    const b1500 = ov.bands.find((b) => b.band === 1500)!;
    check('overview per-band', b1300.nextIndex === null && b1300.solved === 6 && b1400.solved === 2 && b1400.nextIndex === 3 && b1500.solved === 0 && b1500.nextIndex === 1);

    // 13. Streak + analytics inclusion
    const st = await computeCp31Streak(uid, TZ);
    check('cp31 streak: enabled, solvedToday, current ≥ 2 (yesterday shifted + today)', st.enabled && st.solvedToday && st.currentStreak >= 2 && st.totalSolved === 8);
    check('progress totalSolved counts cp31', (await progressService.getStats(uid, TZ)).totalSolved === 8);
    check('general streak activeToday via cp31', (await streakService.getStreaks(uid, TZ)).activeToday === true);

    // 14. Cron immunity: overdue pending cp31 never becomes backlog
    const p3 = getCp31Problems(1400).find((p) => p.index === 3)!;
    const stale = await prisma.task.create({
      data: {
        userId: uid, taskType: 'cp31', status: 'pending', title: p3.title, topic: 'CF 1400', difficulty: 'medium',
        platform: 'codeforces', problemUrl: p3.url, scheduledDate: utcMidnight(yKey), scheduledDateKey: yKey, cp31ProblemId: p3.id,
      },
    });
    await runBacklogCron();
    const staleAfter = await prisma.task.findUnique({ where: { id: stale.id } });
    check('backlog cron ignores cp31', staleAfter?.status === 'pending' && staleAfter.isBacklog === false);
    const s14 = await ensureCp31TasksForUser(uid, TZ);
    check('ensure bumps the stale rung to today', (await prisma.task.findUnique({ where: { id: stale.id } }))?.scheduledDateKey === today && s14.pendingCount === 1);

    // 15. Guards on generic task routes
    await rejects(() => taskService.deleteTask(stale.id, uid), 'deleteTask on cp31');
    await rejects(() => taskService.updateTask(stale.id, uid, { title: 'x' }), 'updateTask on cp31');
    await rejects(() => taskService.createTask(uid, { title: 'x', topic: 'CF', taskType: 'cp31', scheduledDate: today } as any), 'createTask taskType cp31');

    // 16. Coin invariant (only completeTask paths awarded coins)
    check('final coin invariant', (await coinsOf(uid)) === expectedCoins, `coins=${await coinsOf(uid)} expected=${expectedCoins}`);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? '\n✅ ALL PART C CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
