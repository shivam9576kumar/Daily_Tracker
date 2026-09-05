import prisma from '../../config/database';
import logger from '../../utils/logger';
import { dateKeyInTz } from '../../utils/dateKeys';

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';
const FETCH_TIMEOUT_MS = 8000;

/** LeetCode flips the POTD at UTC midnight, so the canonical POTD day is a UTC date key. */
export function currentPotdDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface PotdInfo {
  dateKey: string;
  title: string;
  titleSlug: string;
  difficulty: 'easy' | 'medium' | 'hard';
  url: string;
  topicTags: string[];
  questionId: string | null;
}

const QUERY = `
  query questionOfToday {
    activeDailyCodingChallengeQuestion {
      date
      link
      question {
        questionFrontendId
        title
        titleSlug
        difficulty
        topicTags { name }
      }
    }
  }
`;

function normalizeDifficulty(value: unknown): 'easy' | 'medium' | 'hard' {
  const v = String(value ?? '').toLowerCase();
  if (v === 'easy' || v === 'medium' || v === 'hard') return v;
  return 'medium';
}

/** Raw network call. Throws on any failure — callers must handle. */
async function fetchFromLeetCode(): Promise<PotdInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(LEETCODE_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // LeetCode rejects requests without a browser-like UA / Referer.
        'User-Agent': 'Mozilla/5.0 (compatible; DailyTracker/1.0)',
        Referer: 'https://leetcode.com/problemset/all/',
      },
      body: JSON.stringify({ query: QUERY, operationName: 'questionOfToday' }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`LeetCode HTTP ${res.status}`);

    const json: any = await res.json();
    const node = json?.data?.activeDailyCodingChallengeQuestion;
    const q = node?.question;
    if (!node?.date || !q?.titleSlug || !q?.title) {
      throw new Error('Unexpected LeetCode payload shape');
    }

    return {
      dateKey: String(node.date).slice(0, 10),
      title: String(q.title),
      titleSlug: String(q.titleSlug),
      difficulty: normalizeDifficulty(q.difficulty),
      url: node.link
        ? `https://leetcode.com${node.link}`
        : `https://leetcode.com/problems/${q.titleSlug}/`,
      topicTags: Array.isArray(q.topicTags)
        ? q.topicTags.map((t: any) => String(t?.name ?? '')).filter(Boolean)
        : [],
      questionId: q.questionFrontendId ? String(q.questionFrontendId) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns today's POTD, using the DB cache first.
 * Only ONE network call per day for the entire server.
 * Never throws — returns null if LeetCode is down and nothing is cached.
 */
export async function getTodayPotd(): Promise<PotdInfo | null> {
  const today = currentPotdDateKey();

  const cached = await prisma.potdCache.findUnique({ where: { dateKey: today } });
  if (cached) return cacheRowToInfo(cached);

  try {
    const fresh = await fetchFromLeetCode();

    const row = await prisma.potdCache.upsert({
      where: { dateKey: fresh.dateKey },
      create: {
        dateKey: fresh.dateKey,
        title: fresh.title,
        titleSlug: fresh.titleSlug,
        difficulty: fresh.difficulty,
        url: fresh.url,
        topicTags: fresh.topicTags,
        questionId: fresh.questionId,
      },
      update: {
        title: fresh.title,
        titleSlug: fresh.titleSlug,
        difficulty: fresh.difficulty,
        url: fresh.url,
        topicTags: fresh.topicTags,
        questionId: fresh.questionId,
      },
    });

    return cacheRowToInfo(row);
  } catch (err) {
    logger.warn('potdService: LeetCode fetch failed, falling back to latest cache', {
      message: (err as Error)?.message,
    });

    const latest = await prisma.potdCache.findFirst({ orderBy: { dateKey: 'desc' } });
    return latest ? cacheRowToInfo(latest) : null;
  }
}

function cacheRowToInfo(row: any): PotdInfo {
  return {
    dateKey: row.dateKey,
    title: row.title,
    titleSlug: row.titleSlug,
    difficulty: normalizeDifficulty(row.difficulty),
    url: row.url,
    topicTags: Array.isArray(row.topicTags) ? row.topicTags : [],
    questionId: row.questionId ?? null,
  };
}

/**
 * Ensures the given user has a POTD Task row for today.
 * - Skips if the user dismissed today's POTD.
 * - Idempotent: safe to call on every dashboard load.
 * - Never throws.
 */
export async function ensurePotdTaskForUser(
  userId: string,
  timezone: string,
): Promise<{ taskId: string | null; potd: PotdInfo | null; stale: boolean }> {
  const potd = await getTodayPotd();
  if (!potd) return { taskId: null, potd: null, stale: false };

  const stale = potd.dateKey !== currentPotdDateKey();

  const dismissed = await prisma.potdDismissal.findUnique({
    where: { userId_dateKey: { userId, dateKey: potd.dateKey } },
  });
  if (dismissed) return { taskId: null, potd, stale };

  const existing = await prisma.task.findFirst({
    where: { userId, potdDateKey: potd.dateKey },
    select: { id: true },
  });
  if (existing) return { taskId: existing.id, potd, stale };

  // scheduledDate = UTC midnight of the POTD's OWN date (not the user's local date).
  // dashboardService then places it on the correct local day via dateKeyInTz.
  const scheduledDate = new Date(`${potd.dateKey}T00:00:00.000Z`);
  const topic = potd.topicTags[0] || 'Daily Challenge';

  try {
    const created = await prisma.task.create({
      data: {
        userId,
        planId: null,               // CRITICAL: never part of a plan → never counts toward load
        taskType: 'potd',
        status: 'pending',
        title: potd.title,
        topic,
        difficulty: potd.difficulty,
        platform: 'leetcode',
        problemUrl: potd.url,
        scheduledDate,
        potdDateKey: potd.dateKey,
      },
      select: { id: true },
    });
    return { taskId: created.id, potd, stale };
  } catch (err: any) {
    // P2002 = another concurrent request created it first. Fetch and return that one.
    if (err?.code === 'P2002') {
      const race = await prisma.task.findFirst({
        where: { userId, potdDateKey: potd.dateKey },
        select: { id: true },
      });
      return { taskId: race?.id ?? null, potd, stale };
    }
    logger.error('potdService: failed to create POTD task', {
      userId,
      dateKey: potd.dateKey,
      message: err?.message,
    });
    return { taskId: null, potd, stale };
  }
}

/** User removed today's POTD from their hitlist — remember it so lazy creation does not resurrect it. */
export async function dismissPotdForUser(userId: string, dateKey: string): Promise<void> {
  await prisma.potdDismissal.upsert({
    where: { userId_dateKey: { userId, dateKey } },
    create: { userId, dateKey },
    update: {},
  });
  await prisma.task.deleteMany({
    where: { userId, potdDateKey: dateKey, status: { in: ['pending', 'backlog'] } },
  });
}
