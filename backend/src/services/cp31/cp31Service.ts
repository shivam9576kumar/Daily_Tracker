import type { Prisma, Task } from '@prisma/client';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { NotFoundError, ValidationError } from '../../utils/error';
import { dateKeyInTz, todayKey, resolveTimeZone, taskScheduleForKey } from '../../utils/dateKeys';
import { resolvePlatformValue } from '../../utils/platform';
import { getCp31Bands, getCp31Problems, type Cp31Problem } from '../plan/cp31SheetLoader';

export const CP31_EXTRAS_CAP = 3;

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * 'none'                      — CP31 is disabled for this user.
 * 'active'                    — Band is in progress.
 * 'complete-awaiting-confirm' — Every problem in the band has been served and
 *                              resolved (solved or skipped); user must confirm-advance.
 */
export type Cp31BandStatus = 'none' | 'active' | 'complete-awaiting-confirm';

export interface Cp31Settings {
  enabled: boolean;
  band: number | null;
  dailyCount: number;
}

export interface Cp31BandProgress {
  band: number;
  bandSize: number;
  solved: number;
  skipped: number;
  pending: number;
  /** 1-based index of the next never-served rung; null when every rung has a row. */
  nextIndex: number | null;
  nextProblemId: string | null;
}

export interface Cp31State {
  enabled: boolean;
  band: number | null;
  dailyCount: number;
  bandSize: number;
  solvedInBand: number;
  skippedInBand: number;
  pendingCount: number;
  solvedToday: number;
  extrasUsedToday: number;
  extrasCap: number;
  quotaDoneToday: boolean;
  canOneMore: boolean;
  bandStatus: Cp31BandStatus;
  nextIndex: number | null;
  nextBand: number | null;
  /** Task ids created by THIS call (quota serves). Internal use only. */
  servedNow: string[];
  /** Task objects served or unparked by THIS call. Internal use only. */
  served: Task[];
  /** All pending cp31 task ids (current band) after this call. Internal use only. */
  pendingTaskIds: string[];
}

/**
 * Public-facing CP31 state: strips internal implementation fields that must
 * not be serialized into Todo, Dashboard, or mutation-endpoint responses.
 * ensureCp31TasksForUser and getCp31State continue to return the full Cp31State
 * for internal consumers (services, tests).
 */
export type Cp31PublicState = Omit<Cp31State, 'servedNow' | 'served' | 'pendingTaskIds'>;

export function toPublicCp31State(state: Cp31State): Cp31PublicState {
  const { servedNow: _servedNow, served: _served, pendingTaskIds: _pendingTaskIds, ...publicState } = state;
  return publicState;
}

export interface Cp31Overview {
  enabled: boolean;
  band: number | null;
  dailyCount: number;
  extrasCap: number;
  bands: Cp31BandProgress[];
}

const bandPrefix = (band: number) => `cp31-${band}-`;
const difficultyFor = (band: number): 'medium' | 'hard' => (band >= 1500 ? 'hard' : 'medium');

function nextBandAfter(band: number): number | null {
  return getCp31Bands().map((b) => b.band).find((b) => b > band) ?? null;
}

async function readSettings(userId: string): Promise<Cp31Settings> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { cp31Enabled: true, cp31Band: true, cp31DailyCount: true },
  });
  if (!u) throw new NotFoundError('User');
  return { enabled: u.cp31Enabled, band: u.cp31Band, dailyCount: u.cp31DailyCount };
}

export function emptyCp31State(partial?: Partial<Cp31State>): Cp31State {
  return {
    enabled: false, band: null, dailyCount: 1, bandSize: 0,
    solvedInBand: 0, skippedInBand: 0, pendingCount: 0, solvedToday: 0,
    extrasUsedToday: 0, extrasCap: CP31_EXTRAS_CAP, quotaDoneToday: false,
    canOneMore: false, bandStatus: 'none', nextIndex: null, nextBand: null,
    servedNow: [], served: [], pendingTaskIds: [],
    ...partial,
  };
}

async function bandRows(userId: string, band: number, db: DbClient = prisma): Promise<Task[]> {
  return db.task.findMany({
    where: { userId, taskType: 'cp31', cp31ProblemId: { startsWith: bandPrefix(band) } },
    orderBy: { createdAt: 'asc' },
  });
}

function summarize(band: number, rows: Task[]): { progress: Cp31BandProgress; unserved: Cp31Problem[] } {
  const problems = getCp31Problems(band);
  const byId = new Map<string, Task>();
  for (const r of rows) if (r.cp31ProblemId) byId.set(r.cp31ProblemId, r);
  const unserved = problems.filter((p) => !byId.has(p.id));

  let solved = 0, skipped = 0, pending = 0;
  for (const r of rows) {
    if (r.status === 'completed') solved++;
    else if (r.status === 'skipped') skipped++;
    else if (r.status === 'pending') pending++;
    else logger.warn('cp31Service: unexpected CP31 task status', { id: r.id, status: r.status });
  }

  // Next problem is either the first pending problem or the first unserved problem
  const pendingProblem = problems.find((p) => byId.get(p.id)?.status === 'pending');
  const nextProblem = pendingProblem ?? unserved[0];

  return {
    progress: {
      band, bandSize: problems.length, solved, skipped, pending,
      nextIndex: nextProblem?.index ?? null,
      nextProblemId: nextProblem?.id ?? null,
    },
    unserved,
  };
}

function countSolvedToday(rows: Task[], tz: string, today: string): number {
  return rows.filter(
    (r) => r.status === 'completed' && r.completedAt !== null && dateKeyInTz(r.completedAt, tz) === today,
  ).length;
}

/**
 * Counts CP31 rows in this band flagged isCp31Extra that were RESOLVED
 * (solved or skipped) today, in the user's timezone. A still-pending
 * extra carried over from a previous day is intentionally excluded:
 * the existing `pending > 0` guard already fully blocks any new serve
 * (base or extra) until it is resolved, making its cap contribution
 * moot while it remains pending.
 *
 * This function is the core fix for the one-more/skip bypass exploit
 * described in Bug 5. Previously, extrasUsedToday was derived as
 * max(0, (pending + solvedToday) - dailyCount), which dropped back to 0
 * whenever an extra was skipped (since skip never increments solvedToday).
 * By tagging extras with isCp31Extra and counting resolved ones here,
 * each extra permanently consumes a cap slot once served, regardless of
 * whether it is later solved or skipped.
 */
function countExtrasUsedToday(rows: Task[], tz: string, today: string): number {
  return rows.filter((r) => {
    if (!r.isCp31Extra) return false;
    if (r.status === 'completed' && r.completedAt && dateKeyInTz(r.completedAt, tz) === today) {
      return true;
    }
    if (r.status === 'skipped' && r.skippedAt && dateKeyInTz(r.skippedAt, tz) === today) {
      return true;
    }
    return false;
  }).length;
}

/**
 * Create the task row for a sheet problem. Race-safe via user_cp31_unique.
 * @param isExtra — true only for rows served via the "+ One More" endpoint.
 *                  Must be false (or default) for all base-quota fills.
 */
async function materialize(
  userId: string,
  p: Cp31Problem,
  today: string,
  tz: string,
  isExtra: boolean = false,
): Promise<Task | null> {
  const schedule = taskScheduleForKey(today, resolveTimeZone(tz));
  try {
    const created = await prisma.task.create({
      data: {
        userId,
        planId: null,
        parentTaskId: null,
        taskType: 'cp31',
        status: 'pending',
        title: p.title,
        topic: `CF ${p.band}`,
        difficulty: difficultyFor(p.band),
        platform: resolvePlatformValue(p.url, 'codeforces'),
        problemUrl: p.url,
        scheduledDate: schedule.scheduledDate,
        scheduledDateKey: schedule.scheduledDateKey,
        cp31ProblemId: p.id,
        isCp31Extra: isExtra,
      },
    });
    return created;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const race = await prisma.task.findFirst({ where: { userId, cp31ProblemId: p.id } });
      return race ?? null;
    }
    logger.error('cp31Service: failed to materialize CP31 task', { userId, problemId: p.id, message: err?.message });
    return null;
  }
}

/**
 * buildState now takes extrasUsedToday as an explicit input (computed by
 * countExtrasUsedToday from the isCp31Extra flag) rather than deriving it
 * inline from pending+solvedToday. The old derivation was the root cause of
 * the cap-bypass exploit: skipping an extra left pending=0 and solvedToday
 * unchanged, causing the formula to drop back to 0. The new approach is
 * monotone: each resolved extra permanently counts toward the cap.
 *
 * The deficit formula for the BASE daily quota is intentionally unchanged
 * (still solvedToday-based only). Skip-and-replace within the base quota
 * must keep working: skipping a base rung creates a deficit and correctly
 * triggers a replacement serve. This is separate from extras accounting.
 */
function buildState(
  s: Cp31Settings,
  progress: Cp31BandProgress,
  solvedToday: number,
  extrasUsedToday: number,
  servedNow: string[],
  served: Task[],
  pendingTaskIds: string[],
): Cp31State {
  const quotaDoneToday = progress.pending === 0 && solvedToday >= s.dailyCount;
  const bandComplete = progress.nextIndex === null && progress.pending === 0;
  const bandStatus: Cp31BandStatus = bandComplete ? 'complete-awaiting-confirm' : 'active';
  const canOneMore = bandStatus === 'active' && quotaDoneToday && extrasUsedToday < CP31_EXTRAS_CAP;
  const nextIndex = (progress.pending > 0 && !quotaDoneToday) ? null : progress.nextIndex;

  return {
    enabled: true, band: progress.band, dailyCount: s.dailyCount, bandSize: progress.bandSize,
    solvedInBand: progress.solved, skippedInBand: progress.skipped, pendingCount: progress.pending,
    solvedToday, extrasUsedToday, extrasCap: CP31_EXTRAS_CAP, quotaDoneToday, canOneMore, bandStatus,
    nextIndex, nextBand: nextBandAfter(progress.band), servedNow, served, pendingTaskIds,
  };
}

/**
 * Idempotent. Safe to call on every dashboard/todo load.
 * 1. Carry-over: pending rungs of the current band move to today (Option B).
 * 2. Unpark: restore parked pending rungs of current band to today.
 * 3. Serve `deficit` next rungs so that pending + solvedToday == dailyCount.
 *    (deficit uses solvedToday only — the base quota formula is unchanged)
 */
export async function ensureCp31TasksForUser(userId: string, tz: string): Promise<Cp31State> {
  const s = await readSettings(userId);
  if (!s.enabled || s.band === null) return emptyCp31State({ band: s.band, dailyCount: s.dailyCount });

  const band = s.band;
  if (getCp31Problems(band).length === 0) {
    logger.warn('cp31Service: configured band missing from sheet', { userId, band });
    return emptyCp31State({ enabled: true, band, dailyCount: s.dailyCount });
  }

  const effectiveTz = resolveTimeZone(tz);
  const today = todayKey(effectiveTz);
  const schedule = taskScheduleForKey(today, effectiveTz);

  // Check for parked pending tasks of this band (scheduledDateKey == null) or overdue (scheduledDateKey < today)
  const pendingToUpdate = await prisma.task.findMany({
    where: {
      userId,
      taskType: 'cp31',
      status: 'pending',
      cp31ProblemId: { startsWith: bandPrefix(band) },
      OR: [{ scheduledDateKey: null }, { scheduledDateKey: { lt: today } }],
    },
  });

  const unparkedTasks: Task[] = [];
  if (pendingToUpdate.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: pendingToUpdate.map((t) => t.id) } },
      data: { scheduledDate: schedule.scheduledDate, scheduledDateKey: today, isBacklog: false, backlogSince: null, isExpired: false },
    });
    for (const t of pendingToUpdate) {
      if (t.scheduledDateKey === null) {
        unparkedTasks.push({ ...t, scheduledDateKey: today, scheduledDate: schedule.scheduledDate });
      }
    }
  }

  let rows = await bandRows(userId, band);
  const first = summarize(band, rows);
  const solvedToday = countSolvedToday(rows, effectiveTz, today);
  // Base quota deficit: unchanged — solvedToday-based only.
  // Skip-and-replace within base quota must keep working.
  const deficit = Math.max(0, s.dailyCount - (first.progress.pending + solvedToday));

  const newlyMaterialized: Task[] = [];
  for (const p of first.unserved.slice(0, deficit)) {
    // isExtra = false for base-quota fills (explicit for clarity)
    const task = await materialize(userId, p, today, effectiveTz, false);
    if (task) newlyMaterialized.push(task);
  }

  let progress = first.progress;
  if (newlyMaterialized.length > 0) {
    rows = await bandRows(userId, band);
    progress = summarize(band, rows).progress;
  }

  const servedTasks = newlyMaterialized.length > 0 ? newlyMaterialized : unparkedTasks;
  const servedNow = servedTasks.map((t) => t.id);
  const pendingTaskIds = rows.filter((r) => r.status === 'pending').map((r) => r.id);

  // Always use the freshest rows snapshot for extrasUsedToday (after any materialization)
  const extrasUsedToday = countExtrasUsedToday(rows, effectiveTz, today);

  return buildState(s, progress, solvedToday, extrasUsedToday, servedNow, servedTasks, pendingTaskIds);
}

export async function getCp31State(userId: string, tz: string): Promise<Cp31State> {
  return ensureCp31TasksForUser(userId, tz);
}

/** One More: exactly one extra rung after today's quota is done. Cap = CP31_EXTRAS_CAP per day. */
export async function serveOneMore(
  userId: string,
  tz: string,
): Promise<{ task: Task; state: Cp31PublicState }> {
  const effectiveTz = resolveTimeZone(tz);
  const before = await ensureCp31TasksForUser(userId, effectiveTz);
  if (!before.enabled || before.band === null) throw new ValidationError('CP31 is turned off');
  if (before.bandStatus === 'complete-awaiting-confirm') throw new ValidationError('This band is complete — confirm your next band first');
  if (before.bandStatus !== 'active') throw new ValidationError('CP31 band unavailable');
  if (!before.quotaDoneToday) throw new ValidationError('Finish today\u2019s CP31 problems first');
  if (before.extrasUsedToday >= CP31_EXTRAS_CAP) throw new ValidationError('Great session. Come back tomorrow.');
  if (before.nextIndex === null) throw new ValidationError('No more problems in this band');

  const problem = getCp31Problems(before.band).find((p) => p.index === before.nextIndex);
  if (!problem) throw new ValidationError('Next problem not found in sheet');

  // isExtra = true — this is the only call site that sets this flag.
  // The isCp31Extra flag is what makes extrasUsedToday monotone on skip.
  const created = await materialize(userId, problem, todayKey(effectiveTz), effectiveTz, true);
  if (!created) throw new ValidationError('Could not serve the next problem — try again');

  const afterState = await ensureCp31TasksForUser(userId, effectiveTz);
  return { task: created, state: toPublicCp31State(afterState) };
}

/**
 * Skip: ladder advances past this rung. No coins. Retry-able.
 *
 * IMPORTANT: Do NOT reintroduce a manual fallback-materialize block here.
 * A previous version of this function had one, which bypassed CP31_EXTRAS_CAP:
 * skipping an extra would trigger a silent re-serve, resetting extrasUsedToday
 * to 0 and allowing infinite one-more/skip loops. The proper fix is:
 *  - For the BASE quota: ensureCp31TasksForUser's own deficit calculation
 *    already serves a replacement when this skip leaves the quota unmet.
 *  - For EXTRAS: skipping an extra must NOT auto-serve another. The user
 *    must re-request via "+ One More", which correctly enforces the cap via
 *    countExtrasUsedToday (which now counts this skipped extra via isCp31Extra).
 *
 * tz is required (previously optional with a silent IST fallback — removed).
 */
export async function skipCp31Problem(
  userId: string,
  taskId: string,
  tz: string,
): Promise<{ skipped: Task; served: Task[]; state: Cp31PublicState }> {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId, taskType: 'cp31' } });
  if (!task) throw new NotFoundError('CP31 task not found');
  if (task.status === 'completed') throw new ValidationError('Solved problems can\u2019t be skipped — undo the solve first');

  const skipped = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'skipped',
      isSkipped: true,
      skippedAt: new Date(),
      scheduledDate: null,
      scheduledDateKey: null,
      isBacklog: false,
      backlogSince: null,
      isExpired: false,
    },
  });

  // ensureCp31TasksForUser's deficit calculation handles base-quota replacement;
  // it correctly serves nothing when the base quota was already satisfied.
  // Extras are never auto-replaced here — the user must call + One More explicitly.
  const state = await ensureCp31TasksForUser(userId, resolveTimeZone(tz));

  return { skipped, served: state.served, state: toPublicCp31State(state) };
}

/** Retry a skipped rung: it becomes today's pending problem again. */
export async function retrySkippedCp31(
  userId: string,
  taskId: string,
  tz: string,
): Promise<{ task: Task; state: Cp31PublicState }> {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId, taskType: 'cp31' } });
  if (!task) throw new NotFoundError('CP31 task not found');
  if (task.status !== 'skipped') throw new ValidationError('Only skipped problems can be retried');
  const effectiveTz = resolveTimeZone(tz);
  const today = todayKey(effectiveTz);
  const schedule = taskScheduleForKey(today, effectiveTz);
  const retried = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'pending',
      isSkipped: false,
      skippedAt: null,
      scheduledDate: schedule.scheduledDate,
      scheduledDateKey: today,
    },
  });
  const state = await ensureCp31TasksForUser(userId, effectiveTz);
  return { task: retried, state: toPublicCp31State(state) };
}
export const retrySkippedCp31Problem = retrySkippedCp31;

export async function listSkippedCp31(userId: string, band?: number): Promise<Task[]> {
  return prisma.task.findMany({
    where: {
      userId,
      taskType: 'cp31',
      status: 'skipped',
      ...(band ? { cp31ProblemId: { startsWith: bandPrefix(band) } } : {}),
    },
    orderBy: { skippedAt: 'desc' },
  });
}

/**
 * Confirm-to-advance: moves to the next band (or an explicitly chosen band).
 *
 * Previously had a `targetBandOrTz?: number | string` positional overload
 * that conflated "explicit band" and "timezone" into one ambiguous argument,
 * plus a `targetBandOrTz === undefined` escape hatch that returned a raw
 * `number` instead of the documented object shape (used only by the old
 * verifyCp31.ts Part C escape hatch). Both are removed.
 *
 * Now: tz is always required as the second parameter; optional target band
 * is passed via a typed options object to avoid any ambiguity.
 */
export async function advanceCp31Band(
  userId: string,
  tz: string,
  options: { targetBand?: number } = {},
): Promise<{ band: number; served: Task[]; state: Cp31PublicState }> {
  const s = await readSettings(userId);
  if (!s.enabled || s.band === null) throw new ValidationError('CP31 is turned off');

  const { progress } = summarize(s.band, await bandRows(userId, s.band));
  const complete = progress.nextIndex === null && progress.pending === 0;
  if (!complete) {
    throw new ValidationError(`Band ${s.band} isn\u2019t complete yet (${progress.solved + progress.skipped}/${progress.bandSize})`);
  }

  const bands = getCp31Bands().map((b) => b.band);
  const next = options?.targetBand ?? nextBandAfter(s.band);
  if (next === null) throw new ValidationError('You\u2019ve finished the highest band available \u2014 more bands coming soon');
  if (!bands.includes(next)) throw new ValidationError(`Unknown band ${next}`);
  if (next === s.band) throw new ValidationError('Choose a different band');

  await prisma.user.update({ where: { id: userId }, data: { cp31Band: next } });
  const state = await ensureCp31TasksForUser(userId, resolveTimeZone(tz));

  return { band: next, served: state.served, state: toPublicCp31State(state) };
}

/** Toggle-off / band-change transition: park pending rows with null keys so notes survive. */
export async function parkUnsolvedCp31Tasks(userId: string, db: DbClient = prisma): Promise<number> {
  const res = await db.task.updateMany({
    where: { userId, taskType: 'cp31', status: 'pending', scheduledDateKey: { not: null } },
    data: { scheduledDate: null, scheduledDateKey: null },
  });
  return res.count;
}
export const removeUnsolvedCp31Tasks = parkUnsolvedCp31Tasks;

/** Per-band progress for band picker / resume dialog. */
export async function getCp31Overview(userId: string): Promise<Cp31Overview> {
  const s = await readSettings(userId);
  const rows = await prisma.task.findMany({ where: { userId, taskType: 'cp31' } });
  const bands = getCp31Bands().map(({ band }) => {
    const mine = rows.filter((r) => r.cp31ProblemId?.startsWith(bandPrefix(band)));
    return summarize(band, mine).progress;
  });
  return { enabled: s.enabled, band: s.band, dailyCount: s.dailyCount, extrasCap: CP31_EXTRAS_CAP, bands };
}

export const cp31Service = {
  ensureCp31TasksForUser,
  getCp31State,
  serveOneMore,
  skipCp31Problem,
  retrySkippedCp31,
  retrySkippedCp31Problem,
  listSkippedCp31,
  advanceCp31Band,
  parkUnsolvedCp31Tasks,
  removeUnsolvedCp31Tasks,
  getCp31Overview,
  toPublicCp31State,
};
