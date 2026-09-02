import { TaskStatus } from '../enums/TaskStatus';
import { TaskType } from '../enums/TaskType';
import { Difficulty } from '../enums/Difficulty';
import { Rating } from '../enums/Rating';
import { Platform } from '../enums/Platform';

export interface Task {
  id: string;
  userId: string;
  planId: string | null;
  parentTaskId: string | null;
  title: string;
  topic: string;
  difficulty: Difficulty;
  platform: Platform;
  problemUrl: string | null;
  taskType: TaskType;
  status: TaskStatus;
  scheduledDate: Date;
  originalSolveDate: Date | null;
  completedAt: Date | null;
  rating: Rating | null;
  revisionNumber: number;
  isBacklog: boolean;
  backlogSince: Date | null;
  isExpired: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  topic: string;
  difficulty: Difficulty;
  platform: Platform;
  problemUrl?: string;
  taskType?: TaskType;
  scheduledDate: string; // ISO date string
  planId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  topic?: string;
  difficulty?: Difficulty;
  platform?: Platform;
  problemUrl?: string;
  scheduledDate?: string;
  status?: TaskStatus;
}

export interface TaskWithRevisions extends Task {
  revisions: Task[];
  parentTask: Task | null;
}
