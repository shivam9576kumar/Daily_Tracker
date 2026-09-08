import type { Prisma, Task } from '@prisma/client';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { NotFoundError, ValidationError } from '../../utils/error';
import { dateKeyInTz, todayKey } from '../../utils/dateKeys';
import { resolvePlatformValue } from '../../utils/platform';
import { getCp31Bands, getCp31Problems, type Cp31Problem } from '../plan/cp31SheetLoader';

export const CP31_EXTRAS_CAP = 3;

type DbClient = Prisma.TransactionClient | typeof prisma;

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
  /** Task ids created by THIS call (quota serves). */
  servedNow: string[];
  /** All pending cp31 task ids (current band) after this call. */
  pendingTaskIds: string[];
}

export interface Cp31Overview {
  enabled: boolean;
  band: number | null;
  dailyCount: number;
  extrasCap: number;
  bands: Cp31BandProgress[];
}

const bandPrefix = (band: number) => `cp31-${band}-`;
const utcMidnight = (dateKey: string) => new Date(`${dateKey}T00:00:00.000Z`);
const difficultyFor = (band: number): 'medium' | 'hard' => (band >= 1600 ? 'hard' : 'medium');

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
    servedNow: [], pendingTaskIds: [],
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

  return {
    progress: {
      band, bandSize: problems.length, solved, skipped, pending,
      nextIndex: unserved[0]?.index ?? null,
      nextProblemId: unserved[0]?.id ?? null,
    },
    unserved,
  };
}

function countSolvedToday(rows: Task[], tz: string, today: string): number {
  return rows.filter(
    (r) => r.status === 'completed' && r.completedAt !== null && dateKeyInTz(r.completedAt, tz) === today,
  ).length;
}

/** Create the task row for a sheet problem. Race-safe via user_cp31_unique. */
async function materialize(userId: string, p: Cp31Problem, today: string): Promise<string | null> {
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
        scheduledDate: utcMidnight(today),
        scheduledDateKey: today,
        cp31ProblemId: p.id,
      },
      select: { id: true },
    });
    return created.id;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const race = await prisma.task.findFirst({ where: { userId, cp31ProblemId: p.id }, select: { id: true } });
      return race?.id ?? null;
    }
    logger.error('cp31Service: failed to materialize CP31 task', { userId, problemId: p.id, message: err?.message });
    return null;
  }
}

function buildState(
  s: Cp31Settings, progress: Cp31BandProgress, solvedToday: number, servedNow: string[], pendingTaskIds: string[],
): Cp31State {
  const active = progress.pending + solvedToday;
  const extrasUsedToday = Math.max(0, active - s.dailyCount);
  const quotaDoneToday = progress.pending === 0 && solvedToday >= s.dailyCount;
  const bandComplete = progress.nextIndex === null && progress.pending === 0;
  const bandStatus: Cp31BandStatus = bandComplete ? 'complete-awaiting-confirm' : 'active';
  const canOneMore = bandStatus === 'active' && quotaDoneToday && extrasUsedToday < CP31_EXTRAS_CAP;

  return {
    enabled: true, band: progress.band, dailyCount: s.dailyCount, bandSize: progress.bandSize,
    solvedInBand: progress.solved, skippedInBand: progress.skipped, pendingCount: progress.pending,
    solvedToday, extrasUsedToday, extrasCap: CP31_EXTRAS_CAP, quotaDoneToday, canOneMore, bandStatus,
    nextIndex: progress.nextIndex, nextBand: nextBandAfter(progress.band), servedNow, pendingTaskIds,
  };
}

/**
 * Idempotent. Safe to call on every dashboard/todo load.
 * 1. Carry-over: pending rungs of the current band move to today (Option B).
 * 2. Serve `deficit` next rungs so that pending + solvedToday == dailyCount.
 */
export async function ensureCp31TasksForUser(userId: string, tz: string): Promise<Cp31State> {
  const s = await readSettings(userId);
  if (!s.enabled || s.band === null) return emptyCp31State({ band: s.band, dailyCount: s.dailyCount });

  const band = s.band;
  if (getCp31Problems(band).length === 0) {
    logger.warn('cp31Service: configured band missing from sheet', { userId, band });
    return emptyCp31State({ enabled: true, band, dailyCount: s.dailyCount });
  }

  const today = todayKey(tz);

  await prisma.task.updateMany({
    where: {
      userId, taskType: 'cp31', status: 'pending',
      cp31ProblemId: { startsWith: bandPrefix(band) },
      OR: [{ scheduledDateKey: null }, { scheduledDateKey: { lt: today } }],
    },
    data: { scheduledDate: utcMidnight(today), scheduledDateKey: today, isBacklog: false, backlogSince: null, isExpired: false },
  });

  let rows = await bandRows(userId, band);
  const first = summarize(band, rows);
  const solvedToday = countSolvedToday(rows, tz, today);
  const deficit = Math.max(0, s.dailyCount - (first.progress.pending + solvedToday));

  const servedNow: string[] = [];
  for (const p of first.unserved.slice(0, deficit)) {
    const id = await materialize(userId, p, today);
    if (id) servedNow.push(id);
  }

  let progress = first.progress;
  if (servedNow.length > 0) {
    rows = await bandRows(userId, band);
    progress = summarize(band, rows).progress;
  }

  const pendingTaskIds = rows.filter((r) => r.status === 'pending').map((r) => r.id);
  return buildState(s, progress, solvedToday, servedNow, pendingTaskIds);
}

/** One More: exactly one extra rung after today's quota is done. Cap = CP31_EXTRAS_CAP per day. */
export async function serveOneMore(userId: string, tz: string): Promise<{ taskId: string; state: Cp31State }> {
  const before = await ensureCp31TasksForUser(userId, tz);
  if (!before.enabled || before.band === null) throw new ValidationError('CP31 is turned off');
  if (before.bandStatus === 'complete-awaiting-confirm') throw new ValidationError('This band is complete — confirm your next band first');
  if (before.bandStatus !== 'active') throw new ValidationError('CP31 band unavailable');
  if (!before.quotaDoneToday) throw new ValidationError('Finish today’s CP31 problems first');
  if (before.extrasUsedToday >= CP31_EXTRAS_CAP) throw new ValidationError('Great session. Come back tomorrow.');
  if (before.nextIndex === null) throw new ValidationError('No more problems in this band');

  const problem = getCp31Problems(before.band).find((p) => p.index === before.nextIndex);
  if (!problem) throw new ValidationError('Next problem not found in sheet');

  const taskId = await materialize(userId, problem, todayKey(tz));
  if (!taskId) throw new ValidationError('Could not serve the next problem — try again');

  return { taskId, state: await ensureCp31TasksForUser(userId, tz) };
}

/** Skip: ladder advances past this rung. No coins. Retry-able. */
export async function skipCp31Problem(userId: string, taskId: string): Promise<Task> {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId, taskType: 'cp31' } });
  if (!task) throw new NotFoundError('CP31 task');
  if (task.status === 'completed') throw new ValidationError('Solved problems can’t be skipped — undo the solve first');
  if (task.status === 'skipped') return task;
  return prisma.task.update({
    where: { id: taskId },
    data: { status: 'skipped', skippedAt: new Date(), scheduledDate: null, scheduledDateKey: null, isBacklog: false, backlogSince: null, isExpired: false },
  });
}

/** Retry a skipped rung: it becomes today's pending problem again. */
export async function retrySkippedCp31(userId: string, taskId: string, tz: string): Promise<Task> {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId, taskType: 'cp31' } });
  if (!task) throw new NotFoundError('CP31 task');
  if (task.status !== 'skipped') throw new ValidationError('Only skipped problems can be retried');
  const today = todayKey(tz);
  return prisma.task.update({
    where: { id: taskId },
    data: { status: 'pending', skippedAt: null, scheduledDate: utcMidnight(today), scheduledDateKey: today },
  });
}

export async function listSkippedCp31(userId: string): Promise<Task[]> {
  return prisma.task.findMany({
    where: { userId, taskType: 'cp31', status: 'skipped' },
    orderBy: { skippedAt: 'desc' },
  });
}

/** Confirm-to-advance. Default target = next higher band. Explicit band allowed (≠ current). */
export async function advanceCp31Band(userId: string, targetBand?: number): Promise<number> {
  const s = await readSettings(userId);
  if (!s.enabled || s.band === null) throw new ValidationError('CP31 is turned off');

  const { progress } = summarize(s.band, await bandRows(userId, s.band));
  const complete = progress.nextIndex === null && progress.pending === 0;
  if (!complete) {
    throw new ValidationError(`Band ${s.band} isn’t complete yet (${progress.solved + progress.skipped}/${progress.bandSize})`);
  }

  const bands = getCp31Bands().map((b) => b.band);
  const next = targetBand ?? nextBandAfter(s.band);
  if (next === null) throw new ValidationError('You’ve finished the highest band available — more bands coming soon');
  if (!bands.includes(next)) throw new ValidationError(`Unknown band ${next}`);
  if (next === s.band) throw new ValidationError('Choose a different band');

  await prisma.user.update({ where: { id: userId }, data: { cp31Band: next } });
  return next;
}

/** Toggle-off / band-change transition: pending rows only. Solved + skipped are history. */
export async function removeUnsolvedCp31Tasks(userId: string, db: DbClient = prisma): Promise<number> {
  const res = await db.task.deleteMany({ where: { userId, taskType: 'cp31', status: 'pending' } });
  return res.count;
}

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
