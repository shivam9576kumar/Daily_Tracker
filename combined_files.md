# Consolidated Code Files

This document consolidates the complete contents of the requested files.

---

## 1. `backend/src/services/plan/questionBankLoader.ts`

```typescript
import neetcodeSample from '../../data/neetcodeSample.json';
import coderArmySheet from '../../data/coderArmySheet.json';
import striverSheet from '../../data/striverSheet.json';
import { ValidationError } from '../../utils/error';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuestionBankEntry {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  url: string;
  order: number;
  tags?: string[];
}

export function loadQuestionBank(source: string = 'neetcode150'): QuestionBankEntry[] {
  let rawQuestions: QuestionBankEntry[];

  if (source === 'neetcode150') {
    rawQuestions = neetcodeSample as QuestionBankEntry[];
  } else if (source === 'coderarmy' || source === 'coderarmy700') {
    rawQuestions = coderArmySheet as QuestionBankEntry[];
  } else if (source === 'striver' || source === 'strivera2z' || source === 'takeuforward') {
    rawQuestions = striverSheet as QuestionBankEntry[];
  } else {
    throw new ValidationError(`Unsupported source: "${source}". Supported sources are "neetcode150", "coderarmy", and "striver".`);
  }

  return rawQuestions
    .filter((q) => q.id && q.title && q.topic && q.difficulty)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getTopicCount(questions: QuestionBankEntry[], topic: string): number {
  return questions.filter((q) => q.topic.toLowerCase() === topic.toLowerCase()).length;
}

export function getAvailableTopics(questions: QuestionBankEntry[]): string[] {
  return [...new Set(questions.map((q) => q.topic))];
}
```

---

## 2. `backend/src/services/plan/planGenerationService.ts`

```typescript
import prisma from '../../config/database';
import { QuestionBankEntry, loadQuestionBank } from './questionBankLoader';
import { calculateDailyCapacities, BusyDayInput } from './capacityCalculator';
import { scheduleQuestions, SchedulerResult, TopicQuota, ScheduleMode } from './weightedScheduler';
import { todayKey } from '../../utils/dateKeys';
import { NotFoundError, ValidationError } from '../../utils/error';
import { resolvePlatformValue } from '../../utils/platform';

export interface GeneratePlanInput {
  name?: string;
  source: 'neetcode150' | 'coderarmy' | 'striver' | string;
  startDate: string;
  durationDays: number;
  pace: 'relaxed' | 'moderate' | 'intensive' | 'custom';
  weekdayLoad: number;
  weekendLoad: number;
  topicQuotas?: TopicQuota[];
  focusTopics?: string[];
  avoidTopics?: string[];
  busyDays?: BusyDayInput[];
  bufferDay?: number;
  archiveExisting?: boolean;
  scheduleMode?: ScheduleMode;
}

export const planGenerationService = {
  /**
   * Preview a generated plan without writing to database.
   */
  async previewPlan(
    input: GeneratePlanInput
  ): Promise<SchedulerResult> {
    const {
      source = 'neetcode150',
      startDate = todayKey(),
      durationDays = 14,
      weekdayLoad = 2.0,
      weekendLoad = 3.0,
      topicQuotas,
      focusTopics = [],
      avoidTopics = [],
      busyDays = [],
      bufferDay = 0,
      scheduleMode = 'balanced',
    } = input;

    if (durationDays < 1 || durationDays > 365) {
      throw new ValidationError('durationDays must be between 1 and 365');
    }

    if (weekdayLoad <= 0 || weekendLoad <= 0) {
      throw new ValidationError('weekdayLoad and weekendLoad must be positive numbers');
    }

    const questions = loadQuestionBank(source);
    const capacities = calculateDailyCapacities({
      startDate,
      durationDays,
      weekdayLoad,
      weekendLoad,
      busyDays,
      bufferDay,
    });

    const result = scheduleQuestions({
      source,
      questions,
      capacities,
      topicQuotas,
      focusTopics,
      avoidTopics,
      weekdayLoad,
      weekendLoad,
      scheduleMode,
    });

    return result;
  },

  /**
   * Commit a generated plan into database (creates Plan + Tasks).
   */
  async commitPlan(userId: string, input: GeneratePlanInput) {
    const preview = await this.previewPlan(input);

    if (!preview.valid) {
      throw new ValidationError(
        preview.errors.join(' ') ||
          'Plan schedule is invalid. Please adjust duration or daily load.'
      );
    }

    const existingActive = await prisma.plan.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (existingActive && !input.archiveExisting) {
      throw new ValidationError(
        'You already have an active plan. Archive existing plan or pass archiveExisting: true.'
      );
    }

    const defaultTitle =
      input.source === 'coderarmy'
        ? 'Coder Army'
        : input.source === 'striver'
          ? "Striver's A2Z Sheet"
          : 'NeetCode 150';
    const planName =
      input.name?.trim() || `${defaultTitle} - ${input.durationDays} Day Plan`;
    const startDate = new Date(`${preview.summary.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${preview.summary.endDate}T23:59:59.999Z`);

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Archive existing active plan if requested
        if (existingActive && input.archiveExisting) {
          await tx.plan.update({
            where: { id: existingActive.id },
            data: { status: 'archived' },
          });
        }

        // 2. Create the new Plan
        const plan = await tx.plan.create({
          data: {
            userId,
            name: planName,
            source: input.source || 'neetcode150',
            startDate,
            endDate,
            status: 'active',
            weekdayCapacity: Math.round(preview.summary.weekdayLoad),
            weekendCapacity: Math.round(preview.summary.weekendLoad),
          },
        });

        const SOURCE_DEFAULT_PLATFORM: Record<string, string> = {
          striver: 'striver',
          strivera2z: 'striver',
          takeuforward: 'striver',
          coderarmy: 'custom',
          neetcode150: 'leetcode',
        };
        const sourceFallback = SOURCE_DEFAULT_PLATFORM[input.source] ?? 'custom';

        // 3. Batch insert tasks
        const tasksData: any[] = [];
        for (const day of preview.days) {
          const scheduledDate = new Date(`${day.date}T00:00:00.000Z`);

          for (const q of day.questions) {
            tasksData.push({
              userId,
              planId: plan.id,
              title: q.question.title,
              topic: q.question.topic,
              difficulty: q.question.difficulty,
              problemUrl: q.question.url || null,
              platform: resolvePlatformValue(q.question.url, (q.question as any).platform ?? sourceFallback),
              taskType: 'new',
              status: 'pending',
              scheduledDate,
              scheduledDateKey: day.date,
            });
          }
        }

        if (tasksData.length > 0) {
          await tx.task.createMany({
            data: tasksData,
          });
        }

        return {
          plan,
          tasksCreated: tasksData.length,
        };
      },
      {
        timeout: 15000,
      }
    );

    return result;
  },

  /**
   * Get the current active plan with all linked tasks.
   */
  async getActivePlan(userId: string) {
    const plan = await prisma.plan.findFirst({
      where: {
        userId,
        status: 'active',
      },
      include: {
        tasks: {
          orderBy: [
            { scheduledDate: 'asc' },
            { taskType: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
    });

    return plan;
  },

  /**
   * Archive an existing plan.
   */
  async archivePlan(userId: string, planId: string) {
    const plan = await prisma.plan.findFirst({
      where: {
        id: planId,
        userId,
      },
    });

    if (!plan) {
      throw new NotFoundError('Plan');
    }

    const updated = await prisma.plan.update({
      where: { id: planId },
      data: { status: 'archived' },
    });

    return updated;
  },
};
```

---

## 3. `backend/src/utils/platform.ts`

```typescript
// KEEP IN SYNC with the mirrored file in frontend/src/utils/platform.ts.
import logger from './logger';
import { env } from '../config/env';

const PLATFORM_HOST_MAP: [string, string][] = [
  ['leetcode.com', 'leetcode'],
  ['geeksforgeeks.org', 'gfg'],
  ['interviewbit.com', 'interviewbit'],
  ['codingninjas.com', 'codingninjas'],
  ['naukri.com/code360', 'codingninjas'],
  ['codeforces.com', 'codeforces'],
  ['hackerrank.com', 'hackerrank'],
  ['codechef.com', 'codechef'],
  ['takeuforward.org', 'striver'],
  ['striver', 'striver'],
];

export function platformFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  for (const [fragment, value] of PLATFORM_HOST_MAP) {
    if (lower.includes(fragment)) return value;
  }
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
    logger.warn(`Unmapped problem URL host: ${url}`);
  }
  return null;
}

/** URL-derived platform wins; explicit value is fallback. */
export function resolvePlatformValue(
  problemUrl?: string | null,
  explicit?: string | null,
): string {
  return platformFromUrl(problemUrl) ?? explicit ?? 'custom';
}
```

---

## 4. `frontend/src/utils/platform.ts`

```typescript
// KEEP IN SYNC with the mirrored file in backend/src/utils/platform.ts.
const PLATFORM_HOST_MAP: [string, string, string][] = [
  // [hostname fragment, platform value, display label]
  ['leetcode.com', 'leetcode', 'LeetCode'],
  ['geeksforgeeks.org', 'gfg', 'GFG'],
  ['interviewbit.com', 'interviewbit', 'InterviewBit'],
  ['codingninjas.com', 'codingninjas', 'Coding Ninjas'],
  ['naukri.com/code360', 'codingninjas', 'Coding Ninjas'],
  ['codeforces.com', 'codeforces', 'Codeforces'],
  ['hackerrank.com', 'hackerrank', 'HackerRank'],
  ['codechef.com', 'codechef', 'CodeChef'],
  ['takeuforward.org', 'striver', 'Striver (takeuforward)'],
  ['striver', 'striver', 'Striver (takeuforward)'],
];

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Derive { value, label } from a URL. Returns null if URL is missing/unrecognized. */
export function platformFromUrl(url?: string | null): { value: string; label: string } | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  for (const [fragment, value, label] of PLATFORM_HOST_MAP) {
    if (lower.includes(fragment)) return { value, label };
  }
  return null;
}

/**
 * Single source of truth for display: URL first, stored platform as fallback.
 * Use this EVERYWHERE a platform name is shown.
 */
export function resolvePlatform(
  problemUrl?: string | null,
  platform?: string | null,
): { value: string; label: string } | null {
  const fromUrl = platformFromUrl(problemUrl);
  if (fromUrl) return fromUrl;
  if (!platform) return null;
  return { value: platform, label: platform === 'custom' ? 'Custom' : titleCase(platform) };
}
```

---

## 5. `backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Users ───
model User {
  id        String   @id @default(uuid())
  googleId  String   @unique @map("google_id")
  email     String   @unique
  name      String   @default("")
  avatarUrl String?  @map("avatar_url")
  coins     Int      @default(0)
  timezone  String?  @map("timezone")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  plans          Plan[]
  tasks          Task[]
  assignments    Assignment[]
  notes          Note[]
  notifications  Notification[]
  classSchedules ClassSchedule[]
  potdDismissals PotdDismissal[]

  @@map("users")
}

// ─── Plans ───
model Plan {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  name            String
  source          String   @default("custom")
  startDate       DateTime @map("start_date")
  endDate         DateTime @map("end_date")
  status          String   @default("active") // active | completed | archived
  weekdayCapacity Int      @default(2) @map("weekday_capacity")
  weekendCapacity Int      @default(3) @map("weekend_capacity")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tasks Task[]

  @@map("plans")
}

// ─── Tasks ───
model Task {
  id                String    @id @default(uuid())
  userId            String    @map("user_id")
  planId            String?   @map("plan_id")
  parentTaskId      String?   @map("parent_task_id")
  title             String    @default("Untitled")
  topic             String    @default("General")
  difficulty        String?   @default("medium") // easy | medium | hard
  platform          String?   @default("custom") // coderarmy | striver | neetcode | leetcode | etc.
  problemUrl        String?   @map("problem_url")
  taskType          String    @default("new") @map("task_type") // new | revision | assignment
  status            String    @default("pending") // pending | completed | backlog | expired
  scheduledDate     DateTime  @default(now()) @map("scheduled_date")
  scheduledDateKey  String    @map("scheduled_date_key")
  originalSolveDate DateTime? @map("original_solve_date")
  completedAt       DateTime? @map("completed_at")
  rating            String? // easy | medium | hard
  revisionNumber    Int       @default(0) @map("revision_number")
  isBacklog         Boolean   @default(false) @map("is_backlog")
  backlogSince      DateTime? @map("backlog_since")
  isExpired         Boolean   @default(false) @map("is_expired")
  notes             String?
  /// 'YYYY-MM-DD' of the LeetCode POTD this task represents. Null for every non-POTD task.
  potdDateKey       String?   @map("potd_date_key")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @default(now()) @updatedAt @map("updated_at")

  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan            Plan?      @relation(fields: [planId], references: [id], onDelete: SetNull)
  parentTask      Task?      @relation("TaskRevisions", fields: [parentTaskId], references: [id], onDelete: SetNull)
  revisions       Task[]     @relation("TaskRevisions")
  taskNotes       Note[]
  revisionRecords Revision[] @relation("RevisionParent")
  revisionTasks   Revision[] @relation("RevisionTask")

  /// Guarantees exactly one POTD task per user per POTD date (no dupes on refresh/retry).
  @@unique([userId, potdDateKey], name: "user_potd_unique")
  @@index([userId, scheduledDate])
  @@index([userId, scheduledDateKey])
  @@index([userId, status])
  @@index([parentTaskId])
  @@index([userId, isBacklog, isExpired])
  @@index([parentTaskId, taskType])
  @@map("tasks")
}

// ─── Revisions ───
model Revision {
  id             String    @id @default(uuid())
  parentTaskId   String    @map("parent_task_id")
  revisionTaskId String    @map("revision_task_id")
  revisionNumber Int       @map("revision_number")
  scheduledDate  DateTime  @map("scheduled_date")
  status         String    @default("pending") // pending | completed | expired
  completedAt    DateTime? @map("completed_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  parentTask   Task @relation("RevisionParent", fields: [parentTaskId], references: [id], onDelete: Cascade)
  revisionTask Task @relation("RevisionTask", fields: [revisionTaskId], references: [id], onDelete: Cascade)

  @@index([parentTaskId])
  @@index([revisionTaskId])
  @@map("revisions")
}

// ─── Assignments ───
model Assignment {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  title       String
  description String?
  deadline    DateTime
  status      String    @default("pending") // pending | completed
  completedAt DateTime? @map("completed_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, deadline])
  @@map("assignments")
}

// ─── Notes ───
model Note {
  id        String   @id @default(uuid())
  taskId    String   @map("task_id")
  userId    String   @map("user_id")
  content   String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@map("notes")
}

// ─── Class Schedules ───
model ClassSchedule {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  dayOfWeek Int      @map("day_of_week") // 0=Sun .. 6=Sat
  subject   String
  startTime String   @map("start_time") // "HH:MM" 24h
  endTime   String   @map("end_time") // "HH:MM" 24h
  location  String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, dayOfWeek, startTime])
  @@map("class_schedules")
}

// ─── Notifications ───
model Notification {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  type      String // backlog | expired | revision | system
  title     String
  message   String
  metadata  Json?
  readAt    DateTime? @map("read_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
  @@index([userId, createdAt])
  @@map("notifications")
}

// ─── Cron Runs ───
model CronRun {
  id          String    @id @default(uuid())
  jobName     String    @map("job_name")
  runDate     String    @map("run_date") // YYYY-MM-DD
  status      String    @default("running") // running | completed | failed
  error       String?
  startedAt   DateTime  @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")

  @@unique([jobName, runDate])
  @@index([jobName, runDate])
  @@map("cron_runs")
}

// ─── POTD Cache ───
model PotdCache {
  /// 'YYYY-MM-DD' as returned by LeetCode (UTC-based). Primary key.
  dateKey     String   @id @map("date_key")
  title       String
  titleSlug   String   @map("title_slug")
  difficulty  String   // 'easy' | 'medium' | 'hard' (normalized lowercase)
  url         String
  topicTags   String[] @map("topic_tags")
  questionId  String?  @map("question_id")
  fetchedAt   DateTime @default(now()) @map("fetched_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("potd_cache")
}

// ─── POTD Dismissals ───
model PotdDismissal {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  dateKey   String   @map("date_key") // 'YYYY-MM-DD'
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, dateKey])
  @@map("potd_dismissals")
}
```
