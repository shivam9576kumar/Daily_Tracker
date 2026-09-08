import type { Assignment, Task } from '@prisma/client';

export interface TodoSummary {
  inbox: number;
  today: number;
  upcoming: number;
  backlog: number;
  completedToday: number;
}

export interface TodoDateGroup {
  dateKey: string;
  label: string;
  tasks: Task[];
  assignments: Assignment[];
}

export interface TodoTodayGroups {
  backlog: Task[];
  plan: Task[];
  potd: Task[];
  revisions: Task[];
  manual: Task[];
  personal: Task[];
  completed: Task[];
  assignments: Assignment[];
}

export interface TodoDailyChallenges {
  potd: { enabled: boolean };
  // Part D adds cp31 here.
}

export interface TodoResponse {
  timezone: string;
  todayKey: string;
  generatedAt: string;
  upcomingDays: number;
  summary: TodoSummary;
  inbox: Task[];
  today: TodoTodayGroups;
  upcoming: TodoDateGroup[];
  backlog: Task[];
  completed: TodoDateGroup[];
  dailyChallenges: TodoDailyChallenges;
}
