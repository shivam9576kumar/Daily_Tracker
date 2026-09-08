import type { Assignment, Prisma, Task } from '@prisma/client';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { taskRepository } from '../../repositories/taskRepository';
import { ensurePotdTaskForUser } from '../potd/potdService';
import { cp31Service } from '../cp31/cp31Service';
import {
  addDaysToKey,
  dateKeyInTz,
  todayKey,
  weekdayOfKey,
  zonedDayRangeUtc,
  zonedDayStartUtc,
} from '../../utils/dateKeys';
import type {
  DailyChallengeMeta,
  TodoDateGroup,
  TodoResponse,
  TodoTodayGroups,
} from './todoTypes';

const UPCOMING_DAYS_DEFAULT = 14;
const UPCOMING_DAYS_ALLOWED = [14, 30] as const;

export function normalizeUpcomingDays(raw: unknown): number {
  const n = parseInt(String(raw ?? ''), 10);
  return (UPCOMING_DAYS_ALLOWED as readonly number[]).includes(n)
    ? n
    : UPCOMING_DAYS_DEFAULT;
}

const COMPLETED_DAYS = 7;

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Visible = manual (planId null) OR belongs to the ACTIVE plan. Archived plans never leak. */
const LIVE_PLAN_FILTER: Prisma.TaskWhereInput = {
  OR: [{ planId: null }, { plan: { status: 'active' } }],
};

function isOpenBacklog(t: Task): boolean {
  return t.status !== 'completed' && t.status !== 'expired' && (t.status === 'backlog' || t.isBacklog);
}

/** 'Today' | 'Tomorrow' | 'Yesterday' | weekday name — relative to the user's today key. */
function labelFor(dateKey: string, today: string): string {
  if (dateKey === today) return 'Today';
  if (dateKey === addDaysToKey(today, 1)) return 'Tomorrow';
  if (dateKey === addDaysToKey(today, -1)) return 'Yesterday';
  return WEEKDAY[weekdayOfKey(dateKey)];
}

/** Assignments are saved from a date-only input → UTC midnight. Read the key back the same way. */
function assignmentDateKey(a: Assignment): string {
  return a.deadline.toISOString().slice(0, 10);
}

function upsertGroup(map: Map<string, TodoDateGroup>, dateKey: string, today: string): TodoDateGroup {
  let g = map.get(dateKey);
  if (!g) {
    g = { dateKey, label: labelFor(dateKey, today), tasks: [], assignments: [] };
    map.set(dateKey, g);
  }
  return g;
}

function byTitle(a: { title: string }, b: { title: string }) {
  return a.title.localeCompare(b.title);
}

export const todoService = {
  async getTodo(
    userId: string,
    tz: string,
    upcomingDays: number = UPCOMING_DAYS_DEFAULT,
  ): Promise<TodoResponse> {
    const today = todayKey(tz);
    const upcomingEnd = addDaysToKey(today, upcomingDays);
    const completedStartKey = addDaysToKey(today, -(COMPLETED_DAYS - 1));
    const completedStart = zonedDayStartUtc(completedStartKey, tz);
    const { end: completedEnd } = zonedDayRangeUtc(today, tz);

    // ── 1. POTD & CP31 ensure ──
    let potdDateKey: string | null = null;
    let potdEnabled = true;
    try {
      const ensured = await ensurePotdTaskForUser(userId, tz);
      potdEnabled = ensured.enabled;
      potdDateKey = ensured.potd?.dateKey ?? null;
    } catch (err) {
      logger.warn('todoService: POTD ensure failed, continuing', { message: (err as Error)?.message });
    }

    const cp31State = await cp31Service.ensureCp31TasksForUser(userId, tz);
    const skippedTasks = await cp31Service.listSkippedCp31(userId, cp31State.band ?? undefined);

    const cp31Meta: DailyChallengeMeta['cp31'] = {
      ...cp31State,
      bandStatus: cp31State.bandStatus === 'complete-awaiting-confirm' ? 'complete' : cp31State.bandStatus,
      nextIndex: (cp31State.pendingCount > 0 && !cp31State.quotaDoneToday) ? null : cp31State.nextIndex,
      skippedCount: skippedTasks.length,
    };

    // ── 2. Queries ──
    const [inboxRows, todayRows, upcomingRows, backlogRows, completedRows, assignments] = await Promise.all([
      prisma.task.findMany({
        where: { userId, taskType: 'personal', scheduledDateKey: null, status: 'pending' },
        orderBy: { createdAt: 'desc' },
      }),

      // Single source of truth for "today" — shared with Dashboard.
      taskRepository.getTodaysTasks(userId, tz),

      prisma.task.findMany({
        where: {
          userId,
          status: 'pending',
          isBacklog: false,
          isExpired: false,
          scheduledDateKey: { gt: today, lte: upcomingEnd },
          ...LIVE_PLAN_FILTER,
        },
        orderBy: [{ scheduledDateKey: 'asc' }, { taskType: 'asc' }, { title: 'asc' }],
      }),

      prisma.task.findMany({
        where: {
          userId,
          isBacklog: true,
          status: 'backlog',
          isExpired: false,
          ...LIVE_PLAN_FILTER,
        },
        orderBy: [{ scheduledDateKey: 'asc' }, { title: 'asc' }],
      }),

      prisma.task.findMany({
        where: {
          userId,
          status: 'completed',
          completedAt: { gte: completedStart, lt: completedEnd },
          ...LIVE_PLAN_FILTER,
        },
        orderBy: { completedAt: 'desc' },
      }),

      prisma.assignment.findMany({
        where: {
          userId,
          OR: [
            { status: 'pending' },
            { status: 'completed', completedAt: { gte: completedStart, lt: completedEnd } },
          ],
        },
        orderBy: { deadline: 'asc' },
      }),
    ]);

    // ── 3. Guarantee POTD is present in Today (UTC key may differ from local key) ──
    let todayTasks = todayRows;
    if (potdDateKey && !todayTasks.some((t) => t.potdDateKey === potdDateKey)) {
      const potdTask = await prisma.task.findFirst({
        where: { userId, potdDateKey, isExpired: false },
      });
      if (potdTask) todayTasks = [...todayTasks, potdTask];
    }

    // ── 4. Today groups ──
    const pending = todayTasks.filter((t) => t.status !== 'completed');
    const completedToday = todayTasks
      .filter((t) => t.status === 'completed')
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

    const backlogToday = pending.filter(isOpenBacklog);
    const regular = pending.filter((t) => !isOpenBacklog(t));

    const pendingAssignments = assignments.filter((a) => a.status === 'pending');
    const dueAssignments = pendingAssignments.filter((a) => assignmentDateKey(a) <= today);

    const todayGroups: TodoTodayGroups = {
      backlog: backlogToday,
      plan: regular.filter((t) => t.taskType === 'new' && t.planId !== null),
      potd: regular.filter((t) => t.taskType === 'potd'),
      revisions: regular.filter((t) => t.taskType === 'revision'),
      manual: regular.filter((t) => t.taskType === 'new' && t.planId === null),
      personal: regular.filter((t) => t.taskType === 'personal'),
      completed: completedToday,
      assignments: dueAssignments,
      cp31: regular.filter((t) => t.taskType === 'cp31'),
    };

    // ── 5. Upcoming groups ──
    const upcomingMap = new Map<string, TodoDateGroup>();
    for (const t of upcomingRows) upsertGroup(upcomingMap, t.scheduledDateKey!, today).tasks.push(t);
    for (const a of pendingAssignments) {
      const k = assignmentDateKey(a);
      if (k > today && k <= upcomingEnd) upsertGroup(upcomingMap, k, today).assignments.push(a);
    }
    const upcoming = [...upcomingMap.values()]
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .map((g) => ({ ...g, tasks: g.tasks.sort(byTitle), assignments: g.assignments.sort(byTitle) }));

    // ── 6. Completed groups (user-local day of completedAt) ──
    const completedMap = new Map<string, TodoDateGroup>();
    for (const t of completedRows) {
      if (!t.completedAt) continue;
      const k = dateKeyInTz(t.completedAt, tz);
      if (k < completedStartKey || k > today) continue;
      upsertGroup(completedMap, k, today).tasks.push(t);
    }
    for (const a of assignments) {
      if (a.status !== 'completed' || !a.completedAt) continue;
      const k = dateKeyInTz(a.completedAt, tz);
      if (k < completedStartKey || k > today) continue;
      upsertGroup(completedMap, k, today).assignments.push(a);
    }
    const completed = [...completedMap.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    // ── 7. Summary ──
    const upcomingCount = upcoming.reduce((n, g) => n + g.tasks.length + g.assignments.length, 0);

    return {
      timezone: tz,
      todayKey: today,
      generatedAt: new Date().toISOString(),
      upcomingDays,
      summary: {
        inbox: inboxRows.length,
        today: pending.length + dueAssignments.length,
        upcoming: upcomingCount,
        backlog: backlogRows.length,
        completedToday: completedToday.length,
      },
      inbox: inboxRows,
      today: todayGroups,
      upcoming,
      backlog: backlogRows,
      completed,
      dailyChallenges: {
        potd: { enabled: potdEnabled },
        cp31: cp31Meta,
      },
    };
  },
};
