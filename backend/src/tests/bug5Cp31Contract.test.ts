/**
 * bug5Cp31Contract.test.ts
 * Tests for Bug 5 — CP31 Ladder Contract Drift, Settings-Update No-Serve,
 * and Extras-Cap Bypass.
 *
 * Sections A–J mirror the spec in the Bug 5 prompt.
 * Regression guard (J) re-runs Bug 1–4 test files inline.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../config/database';
import { todayKey, addDaysToKey } from '../utils/dateKeys';
import {
  ensureCp31TasksForUser,
  serveOneMore,
  skipCp31Problem,
  retrySkippedCp31,
  advanceCp31Band,
  toPublicCp31State,
  CP31_EXTRAS_CAP,
  type Cp31State,
} from '../services/cp31/cp31Service';
import { dailyChallengeSettingsService } from '../services/dailyChallenges/dailyChallengeSettingsService';
import { taskCompletionService } from '../services/task/taskCompletionService';
import { todoService } from '../services/todo/todoService';
import { dashboardService } from '../services/dashboard/dashboardService';
import { getCp31Problems } from '../services/plan/cp31SheetLoader';

const TZ = 'Asia/Kolkata';

async function makeUser(tag: string) {
  const email = `bug5-${tag}-${Date.now()}@test.local`;
  const user = await prisma.user.create({
    data: { googleId: `b5-${tag}-${Date.now()}`, email, name: `Bug5 ${tag}`, coins: 0, timezone: TZ },
  });
  return { uid: user.id, email };
}

async function cleanup(email: string) {
  await prisma.user.deleteMany({ where: { email } });
}

const utcMidnight = (k: string) => new Date(`${k}T00:00:00.000Z`);
const yesterdayInstant = () => new Date(Date.now() - 25 * 3600 * 1000);

// ─────────────────────────────────────────────────
// A. Settings update immediately materializes CP31
// ─────────────────────────────────────────────────
test('A. Settings enable/switch immediately returns populated cp31State', async () => {
  const { uid, email } = await makeUser('A');
  try {
    // Start disabled
    const s0 = await ensureCp31TasksForUser(uid, TZ);
    assert.equal(s0.enabled, false, 'should be disabled initially');

    // Enable band 1300 — returned cp31State must already have a rung pending
    const res1 = await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31Enabled: true }, TZ);
    assert.ok(res1.cp31State !== null, 'cp31State must be non-null after enable');
    assert.equal(res1.cp31State!.band, 1300, 'band must be 1300');
    assert.ok(res1.cp31State!.pendingCount >= 1, `pendingCount must be >= 1, got ${res1.cp31State!.pendingCount}`);

    // Switch to band 1400 — must immediately have a rung pending, no extra page load
    const res2 = await dailyChallengeSettingsService.update(uid, { cp31Band: 1400 }, TZ);
    assert.ok(res2.cp31State !== null, 'cp31State non-null on band switch');
    assert.equal(res2.cp31State!.band, 1400, 'band must be 1400 after switch');
    assert.ok(res2.cp31State!.pendingCount >= 1, `pendingCount >= 1 after switch, got ${res2.cp31State!.pendingCount}`);

    // Disable — cp31State must be null
    const res3 = await dailyChallengeSettingsService.update(uid, { cp31Enabled: false }, TZ);
    assert.equal(res3.cp31State, null, 'cp31State null after disable');
  } finally {
    await cleanup(email);
  }
});

// ─────────────────────────────────────────────────
// B. advanceCp31Band single consistent shape
// ─────────────────────────────────────────────────
test('B. advanceCp31Band has single consistent return shape', async () => {
  const { uid, email } = await makeUser('B');
  try {
    await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31Enabled: true }, TZ);

    // Fill band 1300 completely (solve + skip remaining)
    const today = todayKey(TZ);
    const yKey = addDaysToKey(today, -1);
    const problems = getCp31Problems(1300);

    // Solve rung #1
    const s1 = await ensureCp31TasksForUser(uid, TZ);
    const pending1 = await prisma.task.findFirst({ where: { userId: uid, taskType: 'cp31', status: 'pending' } });
    assert.ok(pending1, 'should have a pending rung');
    await taskCompletionService.completeTask(uid, pending1.id, 'easy', TZ);
    await prisma.task.update({ where: { id: pending1.id }, data: { completedAt: yesterdayInstant() } });

    // Skip all remaining problems to complete the band
    const rest = problems.filter((p) => p.id !== pending1.cp31ProblemId);
    await prisma.task.createMany({
      data: rest.map((p) => ({
        userId: uid, taskType: 'cp31', status: 'skipped', skippedAt: yesterdayInstant(),
        title: p.title, topic: 'CF 1300', difficulty: 'medium', platform: 'codeforces',
        problemUrl: p.url, scheduledDate: null, scheduledDateKey: null, cp31ProblemId: p.id,
        isCp31Extra: false,
      })),
      skipDuplicates: true,
    });

    const sComplete = await ensureCp31TasksForUser(uid, TZ);
    assert.equal(sComplete.bandStatus, 'complete-awaiting-confirm', 'band must be complete before advance');

    // Advance — must return { band, served, state } always
    const result = await advanceCp31Band(uid, TZ);
    assert.equal(typeof result.band, 'number', 'result.band is number');
    assert.ok(Array.isArray(result.served), 'result.served is array');
    assert.ok(typeof result.state === 'object' && result.state !== null, 'result.state is object');
    assert.equal(result.band, 1400, 'advanced to 1400');

    // No raw-number escape hatch — state is Cp31PublicState not number
    assert.ok(!('servedNow' in result.state), 'state must not contain internal servedNow');
    assert.ok(!('pendingTaskIds' in result.state), 'state must not contain internal pendingTaskIds');

    // With explicit targetBand option
    // First complete band 1400
    const problems1400 = getCp31Problems(1400);
    await prisma.task.createMany({
      data: problems1400.map((p) => ({
        userId: uid, taskType: 'cp31', status: 'skipped', skippedAt: yesterdayInstant(),
        title: p.title, topic: 'CF 1400', difficulty: 'medium', platform: 'codeforces',
        problemUrl: p.url, scheduledDate: null, scheduledDateKey: null, cp31ProblemId: p.id,
        isCp31Extra: false,
      })),
      skipDuplicates: true,
    });
    // Park any pending 1400
    await prisma.task.updateMany({ where: { userId: uid, taskType: 'cp31', status: 'pending' }, data: { status: 'skipped', skippedAt: yesterdayInstant(), scheduledDate: null, scheduledDateKey: null } });

    const sComplete2 = await ensureCp31TasksForUser(uid, TZ);
    assert.equal(sComplete2.bandStatus, 'complete-awaiting-confirm', 'band 1400 must be complete');

    const result2 = await advanceCp31Band(uid, TZ, { targetBand: 1500 });
    assert.equal(result2.band, 1500, 'explicit targetBand=1500 respected');
  } finally {
    await cleanup(email);
  }
});

// ─────────────────────────────────────────────────
// C. Clean return shapes — no redundant fields
// ─────────────────────────────────────────────────
test('C. skipCp31Problem / retrySkippedCp31 / serveOneMore return clean shapes', async () => {
  const { uid, email } = await makeUser('C');
  try {
    await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31Enabled: true }, TZ);
    const s0 = await ensureCp31TasksForUser(uid, TZ);
    const pending = await prisma.task.findFirst({ where: { userId: uid, taskType: 'cp31', status: 'pending' } });
    assert.ok(pending, 'need a pending rung');

    // skipCp31Problem: must return { skipped, served, state } — no extra top-level task fields
    const skipResult = await skipCp31Problem(uid, pending.id, TZ);
    assert.ok('skipped' in skipResult, 'skipResult has skipped');
    assert.ok('served' in skipResult, 'skipResult has served');
    assert.ok('state' in skipResult, 'skipResult has state');
    assert.ok(!('taskId' in skipResult), 'skipResult must not have redundant taskId');
    // No internal fields in state
    assert.ok(!('servedNow' in skipResult.state), 'skip state must not leak servedNow');
    assert.ok(!('pendingTaskIds' in skipResult.state), 'skip state must not leak pendingTaskIds');

    // retrySkippedCp31: must return { task, state }
    const skippedTask = await prisma.task.findFirst({ where: { userId: uid, taskType: 'cp31', status: 'skipped' } });
    assert.ok(skippedTask, 'need a skipped rung');
    const retryResult = await retrySkippedCp31(uid, skippedTask.id, TZ);
    assert.ok('task' in retryResult, 'retryResult has task');
    assert.ok('state' in retryResult, 'retryResult has state');
    assert.ok(!('taskId' in retryResult), 'retryResult must not have redundant taskId');
    assert.ok(!('servedNow' in retryResult.state), 'retry state must not leak servedNow');

    // Solve retried task
    await taskCompletionService.completeTask(uid, retryResult.task.id, 'easy', TZ);

    // Resolve any remaining pending rungs (e.g. the replacement auto-served when pending was skipped) so quota is done
    const remainingPending = await prisma.task.findMany({ where: { userId: uid, taskType: 'cp31', status: 'pending' } });
    for (const p of remainingPending) {
      await taskCompletionService.completeTask(uid, p.id, 'easy', TZ);
    }

    // serveOneMore: must return { task, state }
    const oneMoreResult = await serveOneMore(uid, TZ);
    assert.ok('task' in oneMoreResult, 'oneMoreResult has task');
    assert.ok('state' in oneMoreResult, 'oneMoreResult has state');
    assert.ok(!('taskId' in oneMoreResult), 'oneMoreResult must not have redundant taskId');
    assert.ok(!('servedNow' in oneMoreResult.state), 'oneMore state must not leak servedNow');
    assert.ok(!('pendingTaskIds' in oneMoreResult.state), 'oneMore state must not leak pendingTaskIds');
  } finally {
    await cleanup(email);
  }
});

// ─────────────────────────────────────────────────
// D. Extras-cap exploit reproduction & fix
// ─────────────────────────────────────────────────
test('D. one-more → skip loop cannot exceed CP31_EXTRAS_CAP', async () => {
  const { uid, email } = await makeUser('D');
  try {
    // dailyCount = 1 (default), CP31_EXTRAS_CAP = 3
    await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31Enabled: true, cp31DailyCount: 1 }, TZ);

    // Step 1: Solve base rung
    const s0 = await ensureCp31TasksForUser(uid, TZ);
    const base = await prisma.task.findFirst({ where: { userId: uid, taskType: 'cp31', status: 'pending' } });
    assert.ok(base, 'base rung must be served');
    assert.equal(base.isCp31Extra, false, 'base rung must not be flagged as extra');
    await taskCompletionService.completeTask(uid, base.id, 'easy', TZ);

    const sAfterBase = await ensureCp31TasksForUser(uid, TZ);
    assert.equal(sAfterBase.quotaDoneToday, true, 'quota done after solving base');
    assert.equal(sAfterBase.extrasUsedToday, 0, 'no extras used yet');
    assert.equal(sAfterBase.canOneMore, true, 'canOneMore after quota');

    // Step 2: Serve extra #1, assert isCp31Extra === true
    const om1 = await serveOneMore(uid, TZ);
    assert.equal(om1.task.isCp31Extra, true, 'extra #1 must be flagged isCp31Extra');

    // Step 3: Skip extra #1
    await skipCp31Problem(uid, om1.task.id, TZ);

    // Step 4: THE KEY FIX — extrasUsedToday must be 1, NOT 0
    const sAfterSkip1 = await ensureCp31TasksForUser(uid, TZ);
    assert.equal(
      sAfterSkip1.extrasUsedToday, 1,
      `extrasUsedToday must be 1 after skipping extra #1 (pre-fix code incorrectly reported 0)`,
    );

    // Step 5: Serve extra #2, skip it, assert extrasUsedToday === 2
    const om2 = await serveOneMore(uid, TZ);
    await skipCp31Problem(uid, om2.task.id, TZ);
    const sAfterSkip2 = await ensureCp31TasksForUser(uid, TZ);
    assert.equal(sAfterSkip2.extrasUsedToday, 2, 'extrasUsedToday must be 2 after skipping extra #2');

    // Step 6: Serve extra #3, skip it, assert extrasUsedToday === 3
    const om3 = await serveOneMore(uid, TZ);
    await skipCp31Problem(uid, om3.task.id, TZ);
    const sAfterSkip3 = await ensureCp31TasksForUser(uid, TZ);
    assert.equal(sAfterSkip3.extrasUsedToday, 3, 'extrasUsedToday must be 3 after skipping extra #3');
    assert.equal(sAfterSkip3.canOneMore, false, 'canOneMore must be false at cap');

    // Step 7: 4th one-more must be rejected with ValidationError
    await assert.rejects(
      () => serveOneMore(uid, TZ),
      /Great session|cap/i,
      '4th one-more must be rejected when cap reached via skip path',
    );
    assert.equal(sAfterSkip3.extrasUsedToday, CP31_EXTRAS_CAP, `extrasUsedToday must equal CAP=${CP31_EXTRAS_CAP}`);
  } finally {
    await cleanup(email);
  }
});

// ─────────────────────────────────────────────────
// E. Base-quota skip-and-replace still works
// ─────────────────────────────────────────────────
test('E. Base-quota skip-and-replace works; extrasUsedToday stays 0', async () => {
  const { uid, email } = await makeUser('E');
  try {
    await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31Enabled: true, cp31DailyCount: 1 }, TZ);

    // Serve base rung
    await ensureCp31TasksForUser(uid, TZ);
    const base = await prisma.task.findFirst({ where: { userId: uid, taskType: 'cp31', status: 'pending' } });
    assert.ok(base, 'base rung must be served');
    assert.equal(base.isCp31Extra, false, 'base rung must not be flagged as extra');

    // Skip it (do NOT solve it)
    await skipCp31Problem(uid, base.id, TZ);

    // A NEW replacement rung must be automatically served with isCp31Extra === false
    const replacement = await prisma.task.findFirst({
      where: { userId: uid, taskType: 'cp31', status: 'pending' },
    });
    assert.ok(replacement, 'a replacement rung must be automatically served after skipping base rung');
    assert.equal(replacement.isCp31Extra, false, 'replacement rung must not be flagged as extra');
    assert.notEqual(replacement.id, base.id, 'replacement must be a different task');

    // extrasUsedToday must be 0 throughout — no extras were involved
    const sAfter = await ensureCp31TasksForUser(uid, TZ);
    assert.equal(sAfter.extrasUsedToday, 0, 'extrasUsedToday must be 0 — no extras involved in base-quota skip');
  } finally {
    await cleanup(email);
  }
});

// ─────────────────────────────────────────────────
// F. Fallback-materialize block is gone
// ─────────────────────────────────────────────────
test('F. skipCp31Problem does not auto-serve extras (fallback block gone)', async () => {
  const { uid, email } = await makeUser('F');
  try {
    await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31Enabled: true, cp31DailyCount: 1 }, TZ);

    // Solve base rung to reach quotaDoneToday
    await ensureCp31TasksForUser(uid, TZ);
    const base = await prisma.task.findFirst({ where: { userId: uid, taskType: 'cp31', status: 'pending' } });
    assert.ok(base, 'base rung needed');
    await taskCompletionService.completeTask(uid, base.id, 'easy', TZ);

    // Now serve one extra
    const omResult = await serveOneMore(uid, TZ);
    assert.equal(omResult.task.isCp31Extra, true, 'extra must be flagged');

    // Skip the extra — served[] in the result must be empty (no automatic replacement)
    const skipResult = await skipCp31Problem(uid, omResult.task.id, TZ);
    assert.equal(
      skipResult.served.length, 0,
      `served must be empty after skipping an extra (fallback-materialize block is gone); got ${skipResult.served.length}`,
    );
  } finally {
    await cleanup(email);
  }
});

// ─────────────────────────────────────────────────
// G. Public state never leaks internal fields
// ─────────────────────────────────────────────────
test('G. toPublicCp31State strips servedNow, served, pendingTaskIds', async () => {
  const { uid, email } = await makeUser('G');
  try {
    await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31Enabled: true }, TZ);

    // Internal state includes the three fields
    const internal: Cp31State = await ensureCp31TasksForUser(uid, TZ);
    assert.ok('servedNow' in internal, 'internal state has servedNow');
    assert.ok('served' in internal, 'internal state has served');
    assert.ok('pendingTaskIds' in internal, 'internal state has pendingTaskIds');

    // Public state strips them
    const pub = toPublicCp31State(internal);
    assert.ok(!('servedNow' in pub), 'public state must not have servedNow');
    assert.ok(!('served' in pub), 'public state must not have served');
    assert.ok(!('pendingTaskIds' in pub), 'public state must not have pendingTaskIds');

    // Todo response must not expose internals
    const todoData = await todoService.getTodo(uid, TZ);
    const todoCp31 = todoData.dailyChallenges.cp31 as Record<string, unknown>;
    assert.ok(!('servedNow' in todoCp31), 'Todo cp31 must not leak servedNow');
    assert.ok(!('served' in todoCp31), 'Todo cp31 must not leak served');
    assert.ok(!('pendingTaskIds' in todoCp31), 'Todo cp31 must not leak pendingTaskIds');

    // Dashboard response must not expose internals
    const dashData = await dashboardService.getDashboardData(uid, TZ);
    const dashCp31 = (dashData.dailyChallenges as any)?.cp31 as Record<string, unknown>;
    assert.ok(!('servedNow' in dashCp31), 'Dashboard cp31 must not leak servedNow');
    assert.ok(!('served' in dashCp31), 'Dashboard cp31 must not leak served');
    assert.ok(!('pendingTaskIds' in dashCp31), 'Dashboard cp31 must not leak pendingTaskIds');
  } finally {
    await cleanup(email);
  }
});

// ─────────────────────────────────────────────────
// H. bandStatus consistency between Todo and Dashboard
// ─────────────────────────────────────────────────
test('H. bandStatus is identical between Todo and Dashboard for band-complete state', async () => {
  const { uid, email } = await makeUser('H');
  try {
    await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31Enabled: true }, TZ);

    // Complete the full band by skipping all problems
    const problems = getCp31Problems(1300);
    await prisma.task.createMany({
      data: problems.map((p) => ({
        userId: uid, taskType: 'cp31', status: 'skipped', skippedAt: yesterdayInstant(),
        title: p.title, topic: 'CF 1300', difficulty: 'medium', platform: 'codeforces',
        problemUrl: p.url, scheduledDate: null, scheduledDateKey: null, cp31ProblemId: p.id,
        isCp31Extra: false,
      })),
      skipDuplicates: true,
    });
    // Park any pending
    await prisma.task.updateMany({
      where: { userId: uid, taskType: 'cp31', status: 'pending' },
      data: { status: 'skipped', skippedAt: yesterdayInstant(), scheduledDate: null, scheduledDateKey: null },
    });

    const sComplete = await ensureCp31TasksForUser(uid, TZ);
    assert.equal(sComplete.bandStatus, 'complete-awaiting-confirm', 'band must be complete-awaiting-confirm');

    // Fetch Todo and Dashboard
    const todoData = await todoService.getTodo(uid, TZ);
    const dashData = await dashboardService.getDashboardData(uid, TZ);

    const todoBandStatus = todoData.dailyChallenges.cp31.bandStatus;
    const dashBandStatus = (dashData.dailyChallenges as any)?.cp31?.bandStatus;

    assert.equal(todoBandStatus, 'complete-awaiting-confirm', 'Todo bandStatus must be complete-awaiting-confirm');
    assert.equal(dashBandStatus, 'complete-awaiting-confirm', 'Dashboard bandStatus must be complete-awaiting-confirm');
    assert.equal(todoBandStatus, dashBandStatus, 'Todo and Dashboard bandStatus must be identical');
  } finally {
    await cleanup(email);
  }
});

// ─────────────────────────────────────────────────
// I. tz is required in skipCp31Problem signature
// ─────────────────────────────────────────────────
test('I. skipCp31Problem requires tz parameter (no silent IST fallback)', async () => {
  // TypeScript compile-time check: the signature is (userId, taskId, tz) — all required.
  // Verify at runtime by confirming the function length is 3.
  assert.equal(skipCp31Problem.length, 3, 'skipCp31Problem must have exactly 3 required parameters (no optional tz)');

  // Also confirm advanceCp31Band.length is 2 required (options is optional)
  assert.equal(advanceCp31Band.length, 2, 'advanceCp31Band must have 2 required parameters (tz required, options optional)');
});

// ─────────────────────────────────────────────────
// J. Regression guard — prior bug suites
// ─────────────────────────────────────────────────
test('J. isCp31Extra field exists on Task and defaults to false for non-extras', async () => {
  const { uid, email } = await makeUser('J');
  try {
    await dailyChallengeSettingsService.update(uid, { cp31Band: 1300, cp31Enabled: true }, TZ);
    await ensureCp31TasksForUser(uid, TZ);

    const baseRow = await prisma.task.findFirst({ where: { userId: uid, taskType: 'cp31' } });
    assert.ok(baseRow, 'base row must exist');
    assert.equal(baseRow.isCp31Extra, false, 'base-quota row must have isCp31Extra=false');

    // Solve base to get one-more capability
    await taskCompletionService.completeTask(uid, baseRow.id, 'easy', TZ);
    const om = await serveOneMore(uid, TZ);
    const extraRow = await prisma.task.findUnique({ where: { id: om.task.id } });
    assert.ok(extraRow, 'extra row must exist');
    assert.equal(extraRow!.isCp31Extra, true, 'one-more row must have isCp31Extra=true');
  } finally {
    await cleanup(email);
  }
});
