export type Difficulty = 'easy' | 'medium' | 'hard';
export type Rating = 'easy' | 'medium' | 'hard';
export type TaskType = 'new' | 'revision' | 'assignment';
export type TaskStatus = 'pending' | 'completed' | 'backlog' | 'expired';

export interface Task {
  id: string;
  userId: string;
  planId: string | null;
  parentTaskId: string | null;
  title: string;
  topic: string;
  difficulty: Difficulty | null;
  platform: string | null;
  problemUrl: string | null;
  taskType: TaskType;
  status: TaskStatus;
  scheduledDate: string;
  originalSolveDate: string | null;
  completedAt: string | null;
  rating: Rating | null;
  revisionNumber: number;
  isBacklog: boolean;
  backlogSince: string | null;
  isExpired: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  revisions?: Task[];
  parentTask?: Task | null;
}

export interface StatusOverview {
  totalQuestions: number;
  streak: number;
  streakActiveToday?: boolean;
  backlog: number;
  expired: number;
  coins: number;
}

export interface Vibe {
  emoji: string;
  message: string;
  intensity: 'none' | 'low' | 'medium' | 'high';
}

export type AssignmentUrgency = 'today' | 'tomorrow' | 'future';

export interface Assignment {
  id: string;
  userId?: string;
  title: string;
  description: string | null;
  deadline: string;
  status: 'pending' | 'completed';
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  urgency?: AssignmentUrgency;
}

export interface Note {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentPayload {
  title: string;
  description?: string;
  deadline: string; // ISO or yyyy-mm-dd
}

export interface ClassRow {
  id: string;
  userId?: string;
  dayOfWeek: number;
  subject: string;
  startTime: string; // "HH:MM"
  endTime: string;
  location: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardData {
  hasActivePlan?: boolean;
  activePlan?: { id: string; name: string } | null;
  statusOverview: StatusOverview;
  vibe: Vibe;
  pendingAssignments: Assignment[];
  todaysHitlist: {
    pending: Task[];
    completed: Task[];
  };
  classes: ClassRow[];
}

export interface CreateTaskPayload {
  title: string;
  topic: string;
  difficulty: Difficulty;
  platform: string;
  problemUrl?: string;
  scheduledDate: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'backlog' | 'expired' | 'revision' | 'system';
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export type PlanSource = 'neetcode150' | 'coderarmy';
export type PlanPace = 'relaxed' | 'moderate' | 'intensive' | 'custom';

export interface BusyDayInput {
  date: string;
  reason?: string;
  loadReduction: number;
}

export interface ScheduledQuestion {
  title: string;
  topic: string;
  difficulty: Difficulty;
  platform?: string;
  problemUrl?: string;
  question?: {
    id?: string;
    title: string;
    topic: string;
    difficulty: Difficulty;
    platform?: string;
    problemUrl?: string;
  };
  load?: number;
}

export interface DaySchedule {
  date: string;
  dayOfWeek: number;
  capacityLoad: number;
  usedLoad: number;
  isWeekend: boolean;
  isBufferDay: boolean;
  busyReason?: string;
  questions: ScheduledQuestion[];
}

export interface PlanPreviewData {
  valid: boolean;
  warnings: string[];
  errors: string[];
  summary: {
    source: string;
    totalQuestions: number;
    totalLoad: number;
    durationDays: number;
    startDate: string;
    endDate: string;
    weekdayLoad: number;
    weekendLoad: number;
    estimatedQuestionsPerDay: number;
  };
  days: DaySchedule[];
}

export interface GeneratePlanPayload {
  name?: string;
  source: PlanSource;
  startDate: string;
  durationDays: number;
  pace: PlanPace;
  weekdayLoad: number;
  weekendLoad: number;
  focusTopics?: string[];
  avoidTopics?: string[];
  busyDays?: BusyDayInput[];
  bufferDay?: number;
  archiveExisting?: boolean;
}

export interface Plan {
  id: string;
  name: string;
  source: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived' | 'completed';
  createdAt: string;
}

export interface ArchivedPlan extends Plan {
  progress: { total: number; solved: number; revPending: number };
}

export interface ActivePlanResponse {
  plan: Plan | null;
  tasks: Task[];       // the active plan's problems only (never revisions)
  revisions: Task[];   // ALL revision tasks, any source, not expired, dated on/after origin
  origin: string;      // ISO — Roadmap week 1 starts here (min of plan start, today)
}

export interface ParsedPlanSettings {
  source: PlanSource;
  durationDays: number;
  pace: PlanPace;
  weekdayLoad: number;
  weekendLoad: number;
  focusTopics: string[];
  avoidTopics: string[];
  busyDays: BusyDayInput[];
  bufferDay: number;
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface HeatmapMonth {
  key: string;
  year: number;
  month: number;
  label: string;
  daysInMonth: number;
  firstWeekday: number;
  weeks: number;
  activeDays: number;
  totalCount: number;
  badge: 'full-month' | null;
  days: HeatmapDay[];
}

export interface HeatmapData {
  tz: string;
  from: string;
  to: string;
  weekStart: 0;
  months: HeatmapMonth[];
  summary: { totalCount: number; activeDays: number; bestDay: HeatmapDay | null };
}

export interface ProgressStats {
  totalSolved: number;
  revisionsDone: number;
  pendingRevisions: number;
  coins: number;
  currentStreak: number;
  bestStreak: number;
  activeToday: boolean;
  activeDays: number;
}

export interface TopicProgressItem {
  topic: string;
  total: number;
  solved: number;
  percent: number;
}

export interface DifficultyBucket {
  solved: number;
  total: number;
}

export interface TopicProgressData {
  scope: 'plan' | 'all';
  hasActivePlan: boolean;
  planId: string | null;
  planName: string | null;
  topics: TopicProgressItem[];
  difficulty: { easy: DifficultyBucket; medium: DifficultyBucket; hard: DifficultyBucket };
  totals: DifficultyBucket;
}

export interface ActivityItem {
  id: string;
  title: string;
  topic: string;
  difficulty: string | null;
  taskType: 'new' | 'revision';
  rating: string | null;
  revisionNumber: number;
  completedAt: string;
  problemUrl: string | null;
}

export interface ProgressOverview {
  stats: ProgressStats;
  heatmap: HeatmapData;
  topics: TopicProgressData;
  activity: ActivityItem[];
  generatedAt: string;
}
