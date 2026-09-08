/**
 * Part B verification — POTD toggle state machine + settings validation.
 * Deterministic: seeds today's PotdCache row if absent (and removes it after).
 * Usage: npm run verify:potd-toggle --workspace=backend
 */
import prisma from '../src/config/database';
import {
  ensurePotdTaskForUser, currentPotdDateKey, dismissPotdForUser,
} from '../src/services/potd/potdService';
import { computePotdStreak } from '../src/services/potd/potdStreakService';
import { dailyChallengeSettingsService } from '../src/services/dailyChallenges/dailyChallengeSettingsService';
import { taskCompletionService } from '../src/services/task/taskCompletionService';
import { addDaysToKey } from '../src/utils/dateKeys';

const TZ = 'Asia/Kolkata';
let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) failures++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}
const coinsOf = async (id: string) =>
  (await prisma.user.findUnique({ where: { id }, select: { coins: true } }))?.coins ?? 0;

async function main() {
  const dateKey = currentPotdDateKey();
  let seeded = false;
  if (!(await prisma.potdCache.findUnique({ where: { dateKey } }))) {
    await prisma.potdCache.create({
      data: {
        dateKey, title: 'Verify POTD', titleSlug: 'verify-potd', difficulty: 'easy',
        url: 'https://leetcode.com/problems/two-sum/', topicTags: ['Array'], questionId: '1',
      },
    });
    seeded = true;
  }

  const emails = ['partb-toggle-1@test.local', 'partb-toggle-2@test.local'];
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  const u1 = await prisma.user.create({
    data: { googleId: `partb1-${Date.now()}`, email: emails[0], name: 'Part B', coins: 0, timezone: TZ },
  });
  const uid = u1.id;
  const pendingPotd = () => prisma.task.count({ where: { userId: uid, taskType: 'potd', status: { in: ['pending', 'backlog'] } } });

  try {
    // 1. defaults
    const s0 = await dailyChallengeSettingsService.get(uid);
    check('default potdEnabled=true', s0.potdEnabled === true);
    check('default cp31 off / band null / count 1', !s0.cp31Enabled && s0.cp31Band === null && s0.cp31DailyCount === 1);
    check('availableBands include 1300 & 1700', s0.availableBands.some((b) => b.band === 1300) && s0.availableBands.some((b) => b.band === 1700));

    // 2. ensure creates today's pending
    const e1 = await ensurePotdTaskForUser(uid, TZ);
    check('ensure (on) → enabled + task', e1.enabled && e1.taskId !== null);
    check('exactly one pending potd', (await pendingPotd()) === 1);

    // synthetic yesterday backlog POTD (unsolved) — must also be removed on disable
    const yKey = addDaysToKey(dateKey, -1);
    await prisma.task.create({
      data: {
        userId: uid, taskType: 'potd', status: 'backlog', isBacklog: true, backlogSince: new Date(),
        title: 'Old POTD', topic: 'Array', difficulty: 'easy', platform: 'leetcode',
        problemUrl: 'https://leetcode.com/problems/add-two-numbers/',
        scheduledDate: new Date(`${yKey}T00:00:00.000Z`), scheduledDateKey: yKey, potdDateKey: yKey,
      },
    });
    check('setup: 2 unsolved potd rows', (await pendingPotd()) === 2);

    // 3. disable → unsolved removed, nothing created afterwards, streak.enabled=false
    const off1 = await dailyChallengeSettingsService.update(uid, { potdEnabled: false });
    check('disable removes 2 unsolved rows', off1.changes.potdUnsolvedRemoved === 2 && (await pendingPotd()) === 0);
    const e2 = await ensurePotdTaskForUser(uid, TZ);
    check('ensure (off) → enabled=false, no task, no row', e2.enabled === false && e2.taskId === null && (await pendingPotd()) === 0);
    check('streak.enabled=false while off', (await computePotdStreak(uid, TZ)).enabled === false);

    // 4. same-day re-enable → re-materializes
    await dailyChallengeSettingsService.update(uid, { potdEnabled: true });
    const e3 = await ensurePotdTaskForUser(uid, TZ);
    check('re-enable same day recreates pending', e3.enabled && e3.taskId !== null && (await pendingPotd()) === 1);

    // 5. solve, then disable → solved survives, coins & streak numbers untouched
    await taskCompletionService.completeTask(uid, e3.taskId!, undefined, TZ);
    check('solve POTD → +10 coins', (await coinsOf(uid)) === 10);
    const stOn = await computePotdStreak(uid, TZ);
    const off2 = await dailyChallengeSettingsService.update(uid, { potdEnabled: false });
    check('disable after solve removes 0', off2.changes.potdUnsolvedRemoved === 0);
    const solvedRow = await prisma.task.findFirst({ where: { userId: uid, taskType: 'potd', status: 'completed' } });
    check('solved row survives disable', solvedRow !== null);
    check('coins unchanged by disable', (await coinsOf(uid)) === 10);
    const stOff = await computePotdStreak(uid, TZ);
    check('streak numbers unchanged by toggle',
      stOff.currentStreak === stOn.currentStreak && stOff.totalSolved === stOn.totalSolved && stOff.enabled === false);

    // 6. re-enable with solved-today → ensure returns existing, no duplicate
    await dailyChallengeSettingsService.update(uid, { potdEnabled: true });
    const e4 = await ensurePotdTaskForUser(uid, TZ);
    check('re-enable → existing solved row, no dup',
      e4.taskId === solvedRow!.id && (await prisma.task.count({ where: { userId: uid, taskType: 'potd' } })) === 1);

    // 7. validation matrix
    const rejects = async (patch: Record<string, unknown>, label: string) => {
      let r = false;
      try { await dailyChallengeSettingsService.update(uid, patch); } catch { r = true; }
      check(`rejects ${label}`, r);
    };
    await rejects({}, 'empty patch');
    await rejects({ potdEnabled: 'yes' }, 'non-boolean potdEnabled');
    await rejects({ cp31DailyCount: 0 }, 'count 0');
    await rejects({ cp31DailyCount: 4 }, 'count 4');
    await rejects({ cp31DailyCount: 2.5 }, 'non-integer count');
    await rejects({ cp31Band: 9999 }, 'unknown band');
    await rejects({ cp31Band: '1300' }, 'string band');
    await rejects({ cp31Enabled: true }, 'cp31 enable without band');
    const ok1 = await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31DailyCount: 2 });
    check('accepts band 1300 + count 2 (stored, inert)', ok1.settings.cp31Band === 1300 && ok1.settings.cp31DailyCount === 2);
    const ok2 = await dailyChallengeSettingsService.update(uid, { cp31Enabled: true });
    check('cp31Enabled accepted once band set', ok2.settings.cp31Enabled === true);
    check('no cp31 tasks materialize in Part B',
      (await prisma.task.count({ where: { userId: uid, taskType: 'cp31' } })) === 0);
    const ok3 = await dailyChallengeSettingsService.update(uid, { cp31Band: null, cp31Enabled: false });
    check('can clear band when disabling cp31', ok3.settings.cp31Band === null && ok3.settings.cp31Enabled === false);

    // 8. dismissal survives a toggle cycle (user 2)
    const u2 = await prisma.user.create({
      data: { googleId: `partb2-${Date.now()}`, email: emails[1], name: 'Part B2', coins: 0, timezone: TZ },
    });
    const f1 = await ensurePotdTaskForUser(u2.id, TZ);
    check('user2 potd created', f1.taskId !== null);
    await dismissPotdForUser(u2.id, dateKey);
    await dailyChallengeSettingsService.update(u2.id, { potdEnabled: false });
    await dailyChallengeSettingsService.update(u2.id, { potdEnabled: true });
    const f2 = await ensurePotdTaskForUser(u2.id, TZ);
    check('dismissal respected after off→on', f2.enabled === true && f2.taskId === null);
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    if (seeded) await prisma.potdCache.delete({ where: { dateKey } }).catch(() => {});
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? '\n✅ ALL PART B CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
