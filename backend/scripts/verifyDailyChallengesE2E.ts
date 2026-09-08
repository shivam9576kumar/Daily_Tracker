/**
 * Daily Challenges (POTD toggle + CP31) — Part F end-to-end verification.
 * Service-level + HTTP-level (in-process Express, real JWT) across timezones.
 * Usage: npm run verify:daily-challenges --workspace=backend   (exit 1 on any failure)
 * Re-runnable: creates/deletes its own users; seeds today's PotdCache only if absent.
 */
import type { AddressInfo } from 'node:net';
import app from '../src/app';
import prisma from '../src/config/database';
import { generateToken } from '../src/services/auth/jwtService';
import { todoService } from '../src/services/todo/todoService';
import { dashboardService } from '../src/services/dashboard/dashboardService';
import { dailyChallengeSettingsService } from '../src/services/dailyChallenges/dailyChallengeSettingsService';
import { currentPotdDateKey, dismissPotdForUser, ensurePotdTaskForUser } from '../src/services/potd/potdService';
import { computePotdStreak } from '../src/services/potd/potdStreakService';
import { ensureCp31TasksForUser, getCp31State, advanceCp31Band } from '../src/services/cp31/cp31Service';
import { computeCp31Streak } from '../src/services/cp31/cp31StreakService';
import { taskCompletionService } from '../src/services/task/taskCompletionService';
import { personalTaskService } from '../src/services/todo/personalTaskService';
import { planGenerationService } from '../src/services/plan/planGenerationService';
import { planService } from '../src/services/plan/planService';
import { heatmapService } from '../src/services/progress/heatmapService';
import { topicProgressService } from '../src/services/progress/topicProgressService';
import { runBacklogCron } from '../src/cron/backlogCron';
import { runExpiryCron } from '../src/cron/expiryCron';
import { addDaysToKey, dateKeyInTz, todayKey } from '../src/utils/dateKeys';
import { getCp31Problems } from '../src/services/plan/cp31SheetLoader';

const IST = 'Asia/Kolkata';
const LA = 'America/Los_Angeles';
const KIRI = 'Pacific/Kiritimati';
const PREFIX = 'partf-';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) failures++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}
const coinsOf = async (id: string) =>
  (await prisma.user.findUnique({ where: { id }, select: { coins: true } }))?.coins ?? 0;
const expectThrow = async (fn: () => Promise<unknown>) => { try { await fn(); return false; } catch { return true; } };
const setKey = (id: string, key: string) =>
  prisma.task.update({ where: { id }, data: { scheduledDateKey: key, scheduledDate: new Date(`${key}T00:00:00.000Z`) } });
const mkUser = (tag: string, tz: string) =>
  prisma.user.create({ data: { googleId: `${PREFIX}${tag}-${Date.now()}`, email: `${PREFIX}${tag}@test.local`, name: tag, coins: 0, timezone: tz } });
const allToday = (t: any): any[] => [...t.backlog, ...t.plan, ...t.potd, ...t.revisions, ...t.manual, ...t.personal, ...t.cp31];
const expectedSummaryToday = (todo: any) => allToday(todo.today).length + todo.today.assignments.length;

async function seedPotdCacheIfMissing(dateKey: string): Promise<boolean> {
  if (await prisma.potdCache.findUnique({ where: { dateKey } })) return false;
  await prisma.potdCache.create({
    data: { dateKey, title: 'Verify POTD', titleSlug: 'verify-potd', difficulty: 'easy',
      url: 'https://leetcode.com/problems/two-sum/', topicTags: ['Array'], questionId: '1' },
  });
  return true;
}

async function seedCompletedBand(uid: string, band: number, upTo: number, tz: string) {
  const y = addDaysToKey(todayKey(tz), -1);
  await prisma.task.createMany({
    data: getCp31Problems(band).filter((p) => p.index <= upTo).map((p) => ({
      userId: uid, taskType: 'cp31', status: 'completed', title: p.title, topic: 'Codeforces',
      difficulty: 'medium', platform: 'codeforces', problemUrl: p.url, cp31ProblemId: p.id,
      scheduledDate: new Date(`${y}T00:00:00.000Z`), scheduledDateKey: y, completedAt: new Date(`${y}T10:00:00.000Z`),
    })),
  });
}

let base = '';
async function http(method: string, path: string, token: string, tz: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Timezone': tz },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = {};
  try { json = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, json };
}

async function main() {
  const potdKey = currentPotdDateKey();
  const seeded = await seedPotdCacheIfMissing(potdKey);
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    /* ═══════════ 1. HTTP CONTRACT (Part D) ═══════════ */
    const H = await mkUser('http', IST);
    const tok = generateToken({ userId: H.id, email: H.email });
    const rq = (m: string, p: string, b?: unknown) => http(m, p, tok, IST, b);
    const today = todayKey(IST);

    let r = await rq('GET', '/api/daily-challenges/settings');
    check('HTTP settings 200 + defaults', r.status === 200 && r.json.data.potdEnabled === true && r.json.data.cp31Enabled === false);
    r = await http('GET', '/api/daily-challenges/settings', 'not-a-jwt', IST);
    check('HTTP 401 with bad JWT', r.status === 401);
    r = await rq('PATCH', '/api/daily-challenges/settings', { cp31Band: 9999 });
    check('HTTP 400 unknown band', r.status === 400 && r.json.success === false);
    r = await rq('POST', '/api/tasks', { title: 'x', topic: 'Arrays', difficulty: 'easy', platform: 'leetcode', scheduledDate: today, taskType: 'cp31' });
    check('HTTP 400 manual cp31 task blocked', r.status === 400);
    r = await rq('PATCH', '/api/daily-challenges/settings', { cp31Band: 1300, cp31Enabled: true });
    check('HTTP enable cp31 (band 1300)', r.status === 200 && r.json.data.settings.cp31Enabled === true);

    r = await rq('GET', '/api/todo');
    let todo = r.json.data;
    const dc = todo.dailyChallenges;
    check('todo.dailyChallenges shape',
      dc?.potd?.enabled === true && dc?.cp31?.enabled === true && dc.cp31.band === 1300 && dc.cp31.dailyCount === 1 &&
      dc.cp31.bandSize === 31 && dc.cp31.extrasCap === 3 && typeof dc.cp31.skippedCount === 'number' &&
      dc.cp31.bandStatus === 'active' && dc.cp31.nextIndex === null && typeof dc.cp31.quotaDoneToday === 'boolean');
    check('todo.today.cp31 = [#01]', Array.isArray(todo.today.cp31) && todo.today.cp31.length === 1 && todo.today.cp31[0].cp31ProblemId === 'cp31-1300-01');
    check('todo.today.potd = 1', todo.today.potd.length === 1);
    check('summary.today counts cp31', todo.summary.today === expectedSummaryToday(todo));
    check('backlog/upcoming contain no cp31',
      !todo.backlog.some((t: any) => t.taskType === 'cp31') && !todo.upcoming.some((g: any) => g.tasks.some((t: any) => t.taskType === 'cp31')));

    const t01 = todo.today.cp31[0];
    r = await rq('POST', '/api/daily-challenges/cp31/one-more');
    check('one-more 400 while rung pending', r.status === 400);
    await taskCompletionService.completeTask(H.id, t01.id, undefined, IST);
    r = await rq('POST', '/api/daily-challenges/cp31/one-more');
    check('one-more 200 → #02, extras 1', r.status === 200 && r.json.data.task.cp31ProblemId === 'cp31-1300-02' && r.json.data.state.extrasUsedToday === 1);
    const t02 = r.json.data.task;
    r = await rq('POST', `/api/daily-challenges/cp31/skip/${t02.id}`);
    check('skip 200 → skipped + #03 served', r.status === 200 && r.json.data.skipped.status === 'skipped' && r.json.data.served[0]?.cp31ProblemId === 'cp31-1300-03');
    const t03 = r.json.data.served[0];
    r = await rq('GET', '/api/daily-challenges/cp31/skipped');
    check('skipped list has #02', r.status === 200 && r.json.data.some((x: any) => x.id === t02.id));
    r = await rq('GET', '/api/todo');
    check('skipped row absent from todo; skippedCount 1',
      !allToday(r.json.data.today).some((t: any) => t.id === t02.id) && r.json.data.dailyChallenges.cp31.skippedCount === 1);
    r = await rq('POST', `/api/daily-challenges/cp31/retry/${t02.id}`);
    check('retry 200 → pending today', r.status === 200 && r.json.data.task.status === 'pending' && r.json.data.task.scheduledDateKey === today);
    const personal = await personalTaskService.create(H.id, { title: 'not a cp31 task' });
    r = await rq('POST', `/api/daily-challenges/cp31/skip/${personal.id}`);
    check('skip 404 for non-cp31 id', r.status === 404);
    r = await rq('POST', '/api/daily-challenges/cp31/advance-band');
    check('advance 400 (band not complete)', r.status === 400);
    r = await rq('GET', '/api/daily-challenges/cp31/streak');
    check('cp31 streak endpoint', r.status === 200 && r.json.data.enabled === true && r.json.data.solvedToday === true && r.json.data.currentStreak === 1);
    r = await rq('GET', '/api/dashboard/today');
    check('dashboard: dailyChallenges + cp31Streak + cp31 in hitlist',
      r.json.data.dailyChallenges?.cp31?.enabled === true && r.json.data.cp31Streak?.enabled === true &&
      r.json.data.todaysHitlist.pending.some((x: any) => x.taskType === 'cp31'));

    r = await rq('GET', '/api/todo');
    const sumBefore = r.json.data.summary.today;
    const pendBefore = r.json.data.today.cp31.length;                 // #02 + #03
    r = await rq('PATCH', '/api/daily-challenges/settings', { cp31Enabled: false });
    check('disable parks pending cp31 (2)', r.json.data.changes.cp31PendingParked === 2);
    r = await rq('GET', '/api/todo');
    check('after disable: cp31 empty, flag false, summary drops by parked',
      r.json.data.today.cp31.length === 0 && r.json.data.dailyChallenges.cp31.enabled === false && r.json.data.summary.today === sumBefore - pendBefore);
    r = await rq('PATCH', '/api/daily-challenges/settings', { cp31Enabled: true });
    r = await rq('GET', '/api/todo');
    const ids = r.json.data.today.cp31.map((t: any) => t.id).sort();
    check('re-enable resumes same rungs (#02,#03), nothing new', ids.join() === [t02.id, t03.id].sort().join());

    /* ═══════════ 2. TIMEZONE MATRIX ═══════════ */
    for (const tz of [IST, LA, KIRI]) {
      const u = await mkUser(`tz-${tz.replace(/\\W/g, '')}`, tz);
      await dailyChallengeSettingsService.update(u.id, { cp31Band: 1400, cp31Enabled: true });
      const td = await todoService.getTodo(u.id, tz);
      check(`${tz}: exactly 1 potd + 1 cp31 in Today`, td.today.cp31.length === 1 && td.today.potd.length === 1);
      check(`${tz}: cp31 key = local today`, td.today.cp31[0].scheduledDateKey === todayKey(tz));
      check(`${tz}: potd key = UTC potd day`, td.today.potd[0].potdDateKey === potdKey);
      check(`${tz}: summary.today consistent`, td.summary.today === expectedSummaryToday(td));
      const dash = await dashboardService.getDashboardData(u.id, tz);
      const a = new Set(allToday(td.today).map((x: any) => x.id));
      const b = new Set(dash.todaysHitlist.pending.map((x) => x.id));
      check(`${tz}: dashboard pending ids == todo today ids`, a.size === b.size && [...a].every((id) => b.has(id)));
      await taskCompletionService.completeTask(u.id, td.today.cp31[0].id, undefined, tz);
      await taskCompletionService.completeTask(u.id, td.today.potd[0].id, undefined, tz);
      const after = await todoService.getTodo(u.id, tz);
      check(`${tz}: both in Completed Today`, after.today.completed.filter((x: any) => x.taskType === 'cp31' || x.taskType === 'potd').length === 2);
      const cs = await computeCp31Streak(u.id, tz);
      const ps = await computePotdStreak(u.id, tz);
      check(`${tz}: cp31 streak 1 / solvedToday; potd solvedToday`, cs.currentStreak === 1 && cs.solvedToday && ps.solvedToday);
    }
    check('DST bucketing: 01:30 EST & 03:30 EDT on 2026-03-08 → same NY day',
      dateKeyInTz(new Date('2026-03-08T06:30:00.000Z'), 'America/New_York') === '2026-03-08' &&
      dateKeyInTz(new Date('2026-03-08T07:30:00.000Z'), 'America/New_York') === '2026-03-08');

    /* ═══════════ 3. TOGGLE STATE MACHINE (both features) ═══════════ */
    const S = await mkUser('state', IST);
    // POTD
    const p1 = await ensurePotdTaskForUser(S.id, IST);
    const off1 = await dailyChallengeSettingsService.update(S.id, { potdEnabled: false });
    todo = await todoService.getTodo(S.id, IST);
    check('POTD off: pending removed, payload flag false, no potd row', off1.changes.potdUnsolvedRemoved === 1 && todo.dailyChallenges.potd.enabled === false && todo.today.potd.length === 0);
    check('POTD off: ensure returns enabled=false', (await ensurePotdTaskForUser(S.id, IST)).enabled === false);
    await dailyChallengeSettingsService.update(S.id, { potdEnabled: true });
    const p2 = await ensurePotdTaskForUser(S.id, IST);
    check('POTD on: same-day re-materialize', p2.taskId !== null && p1.taskId !== null);
    await taskCompletionService.completeTask(S.id, p2.taskId!, undefined, IST);
    const stBefore = await computePotdStreak(S.id, IST);
    await dailyChallengeSettingsService.update(S.id, { potdEnabled: false });
    const stOff = await computePotdStreak(S.id, IST);
    check('POTD off after solve: solved stays, coins & streak numbers untouched',
      (await prisma.task.count({ where: { userId: S.id, taskType: 'potd', status: 'completed' } })) === 1 && (await coinsOf(S.id)) === 10 &&
      stOff.enabled === false && stOff.currentStreak === stBefore.currentStreak && stOff.totalSolved === stBefore.totalSolved);
    await dailyChallengeSettingsService.update(S.id, { potdEnabled: true });
    check('POTD on: no duplicate row', (await prisma.task.count({ where: { userId: S.id, taskType: 'potd' } })) === 1);
    const S2 = await mkUser('state2', IST);
    await ensurePotdTaskForUser(S2.id, IST);
    await dismissPotdForUser(S2.id, potdKey);
    await dailyChallengeSettingsService.update(S2.id, { potdEnabled: false });
    await dailyChallengeSettingsService.update(S2.id, { potdEnabled: true });
    check('POTD dismissal survives off→on', (await ensurePotdTaskForUser(S2.id, IST)).taskId === null);

    // CP31 enable → note → disable (park) → resume → band switch memory
    await dailyChallengeSettingsService.update(S.id, { cp31Band: 1300, cp31Enabled: true });
    const c01 = (await ensureCp31TasksForUser(S.id, IST)).served[0];
    await prisma.note.create({ data: { taskId: c01.id, userId: S.id, content: 'greedy + sort' } });
    const off2 = await dailyChallengeSettingsService.update(S.id, { cp31Enabled: false });
    todo = await todoService.getTodo(S.id, IST);
    check('CP31 off: parked 1, hidden, count consistent, note kept',
      off2.changes.cp31PendingParked === 1 && todo.today.cp31.length === 0 && todo.summary.today === expectedSummaryToday(todo) &&
      (await prisma.note.count({ where: { taskId: c01.id } })) === 1 && (await computeCp31Streak(S.id, IST)).enabled === false);
    await dailyChallengeSettingsService.update(S.id, { cp31Enabled: true });
    todo = await todoService.getTodo(S.id, IST);
    check('CP31 resume: same #01 row returns, nothing new', todo.today.cp31.length === 1 && todo.today.cp31[0].id === c01.id);
    await dailyChallengeSettingsService.update(S.id, { cp31Band: 1500 });
    todo = await todoService.getTodo(S.id, IST);
    check('band switch 1500: #01 parked, 1500-01 served, difficulty hard',
      todo.today.cp31.length === 1 && todo.today.cp31[0].cp31ProblemId === 'cp31-1500-01' && todo.today.cp31[0].difficulty === 'hard' &&
      (await prisma.task.findUnique({ where: { id: c01.id } }))?.scheduledDateKey === null);
    await dailyChallengeSettingsService.update(S.id, { cp31Band: 1300 });
    todo = await todoService.getTodo(S.id, IST);
    check('switch back 1300: #01 resumes (per-band memory)', todo.today.cp31.length === 1 && todo.today.cp31[0].id === c01.id);

    // band complete → "Not now" state → advance
    const Bc = await mkUser('bandcomplete', IST);
    await dailyChallengeSettingsService.update(Bc.id, { cp31Band: 1300, cp31Enabled: true });
    await seedCompletedBand(Bc.id, 1300, 30, IST);
    const last = (await ensureCp31TasksForUser(Bc.id, IST)).served[0];
    check('band 1300: serves only #31', last?.cp31ProblemId === 'cp31-1300-31');
    await taskCompletionService.completeTask(Bc.id, last.id, undefined, IST);
    todo = await todoService.getTodo(Bc.id, IST);
    check('band complete: bandStatus complete, nextBand 1400, no rows served, canOneMore false',
      todo.dailyChallenges.cp31.bandStatus === 'complete' && todo.dailyChallenges.cp31.nextBand === 1400 &&
      todo.today.cp31.length === 0 && todo.dailyChallenges.cp31.canOneMore === false);
    check('"Not now" = repeated loads serve nothing', (await ensureCp31TasksForUser(Bc.id, IST)).served.length === 0);
    const adv = await advanceCp31Band(Bc.id, IST);
    check('advance → 1400-01 served', adv.band === 1400 && adv.served[0]?.cp31ProblemId === 'cp31-1400-01');
    check('state after advance is active 1400', (await getCp31State(Bc.id, IST)).band === 1400);

    /* ═══════════ 4. CROSS-FEATURE ═══════════ */
    const X = await mkUser('cross', IST);
    const committed = await planGenerationService.commitPlan(X.id, {
      source: 'striver', startDate: todayKey(IST), durationDays: 7, pace: 'custom', weekdayLoad: 2, weekendLoad: 2,
      topicQuotas: [{ topic: 'Arrays', count: 4 }], scheduleMode: 'balanced',
    });
    await dailyChallengeSettingsService.update(X.id, { cp31Band: 1300, cp31Enabled: true });
    await personalTaskService.create(X.id, { title: 'read notes', scheduledDateKey: todayKey(IST) });
    todo = await todoService.getTodo(X.id, IST);
    check('one Today has plan + potd + cp31 + personal',
      committed.tasksCreated === 4 && todo.today.plan.length >= 1 && todo.today.potd.length === 1 && todo.today.cp31.length === 1 && todo.today.personal.length === 1);
    check('cross: summary.today consistent', todo.summary.today === expectedSummaryToday(todo));
    const xc = todo.today.cp31[0];
    await taskCompletionService.completeTask(X.id, xc.id, 'medium', IST);
    const revs = await prisma.task.findMany({ where: { parentTaskId: xc.id, taskType: 'revision' } });
    const active = await planService.getActivePlan(X.id);
    todo = await todoService.getTodo(X.id, IST);
    const upcomingIds = new Set(todo.upcoming.flatMap((g: any) => g.tasks.map((t: any) => t.id)));
    check('cp31 medium → 4 revisions (planId null) on Roadmap + Todo Upcoming',
      revs.length === 4 && revs.every((v) => v.planId === null) && revs.every((v) => active.revisions.some((a) => a.id === v.id)) &&
      revs.every((v) => upcomingIds.has(v.id)));
    check('cp31 solve +10 + medium +5 = 15', (await coinsOf(X.id)) === 15);
    await planGenerationService.archivePlan(X.id, committed.plan.id);
    todo = await todoService.getTodo(X.id, IST);
    check('archive plan: plan rows gone, potd/cp31/personal/revisions untouched',
      todo.today.plan.length === 0 && todo.today.potd.length === 1 && todo.today.personal.length === 1 &&
      todo.today.completed.some((t: any) => t.id === xc.id) && revs.every((v) => upcomingIds.has(v.id)));
    await planService.restorePlan(X.id, committed.plan.id);
    check('restore plan: plan rows back', (await todoService.getTodo(X.id, IST)).today.plan.length >= 1);
    await planService.deletePlan(X.id, committed.plan.id);
    check('delete plan: cp31 solve + revisions survive',
      (await prisma.task.count({ where: { id: xc.id } })) === 1 && (await prisma.task.count({ where: { parentTaskId: xc.id } })) === 4);

    /* ═══════════ 5. CRON IMMUNITY ═══════════ */
    const K = await mkUser('cron', IST);
    await dailyChallengeSettingsService.update(K.id, { cp31Band: 1300, cp31Enabled: true });
    const k01 = (await ensureCp31TasksForUser(K.id, IST)).served[0];
    const yKey = addDaysToKey(todayKey(IST), -1);
    await setKey(k01.id, yKey);
    const ctrl = await personalTaskService.create(K.id, { title: 'ctrl', scheduledDateKey: yKey });
    await runBacklogCron();
    await runExpiryCron();
    const k01r = await prisma.task.findUnique({ where: { id: k01.id } });
    const ctrlr = await prisma.task.findUnique({ where: { id: ctrl.id } });
    check('crons: cp31 overdue stays pending (not backlog/expired); personal control → backlog',
      k01r?.status === 'pending' && k01r?.isBacklog === false && k01r?.isExpired === false && ctrlr?.status === 'backlog');
    todo = await todoService.getTodo(K.id, IST);
    check('roll-forward on load: overdue cp31 in Today, none in Backlog view',
      todo.today.cp31.some((t: any) => t.id === k01.id) && !todo.backlog.some((t: any) => t.id === k01.id) &&
      (await prisma.task.findUnique({ where: { id: k01.id } }))?.scheduledDateKey === todayKey(IST));

    /* ═══════════ 6. ANALYTICS ═══════════ */
    const hm = await heatmapService.getHeatmap(X.id, IST, 1);
    const tp = await topicProgressService.getTopicProgress(X.id, 'all');
    const dashX = await dashboardService.getDashboardData(X.id, IST);
    const solvedParents = await prisma.task.count({ where: { userId: X.id, status: 'completed', taskType: { in: ['new', 'potd', 'cp31'] } } });
    check('analytics include cp31: heatmap ≥1, topic Codeforces, totalQuestions counts cp31',
      hm.summary.totalCount >= 1 && tp.topics.some((t) => t.topic === 'Codeforces' && t.solved >= 1) && dashX.statusOverview.totalQuestions === solvedParents);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    if (seeded) await prisma.potdCache.delete({ where: { dateKey: potdKey } }).catch(() => {});
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? '\n✅ ALL DAILY-CHALLENGES E2E CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
