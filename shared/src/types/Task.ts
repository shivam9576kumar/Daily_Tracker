import { TaskStatus } from '../enums/TaskStatus';
import { TaskType } from '../enums/TaskType';
import { Difficulty } from '../enums/Difficulty';
import { Rating } from '../enums/Rating';
import { Platform } from '../enums/Platform';
import { Recurrence } from '../enums/Recurrence';

export interface Task {
  id: string;
  userId: string;
  planId: string | null;
  parentTaskId: string | null;
  recurrenceParentId?: string | null;     // Bug 4
  title: string;
  topic: string;
  difficulty: Difficulty | null;          // nullable — matches current schema
  platform: Platform | string | null;     // nullable — matches current schema
  problemUrl: string | null;
  sourceUrl?: string | null;
  taskType: TaskType;
  status: TaskStatus;
  scheduledDate: string | null;
  scheduledDateKey?: string | null;
  originalSolveDate: string | null;
  completedAt: string | null;
  rating: Rating | null;
  revisionNumber: number;
  isBacklog: boolean;
  backlogSince: string | null;
  isExpired: boolean;
  notes: string | null;                   // Present in schema (see Section 1-C)
  recurrence?: Recurrence | null;
  dueTime?: string | null;                 // "HH:MM"
  durationMin?: number | null;
  potdDateKey?: string | null;
  cp31ProblemId?: string | null;
  isSkipped?: boolean;
  skippedAt?: string | null;
  isCp31Extra?: boolean;                   // Bug 5
  questionBankId?: string | null;
  createdAt: string;
  updatedAt: string;
  revisions?: Task[];
  parentTask?: Task | null;
  isPlanArchived?: boolean;
}

export interface CreateTaskInput {
  title: string;
  topic: string;
  difficulty?: Difficulty;
  platform?: Platform | string;
  problemUrl?: string;
  taskType?: TaskType;
  scheduledDate: string; // ISO date string
  planId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  topic?: string;
  difficulty?: Difficulty;
  platform?: Platform | string;
  problemUrl?: string;
  scheduledDate?: string;
  status?: TaskStatus;
}

export interface TaskWithRevisions extends Task {
  revisions: Task[];
  parentTask: Task | null;
}
