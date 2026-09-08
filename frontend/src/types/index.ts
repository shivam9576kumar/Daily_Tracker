export type Difficulty = 'easy' | 'medium' | 'hard';
export type Rating = 'easy' | 'medium' | 'hard';
export type TaskType = 'new' | 'revision' | 'assignment' | 'potd' | 'personal' | 'cp31';
export type TaskStatus = 'pending' | 'completed' | 'backlog' | 'expired' | 'skipped';
export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

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
  notes: string | null;
  potdDateKey?: string | null;
  cp31ProblemId?: string | null;
  skippedAt?: string | null;
  questionBankId?: string | null;
  recurrence?: Recurrence | null;
  dueTime?: string | null;
  durationMin?: number | null;
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

export interface PotdStreak {
  enabled?: boolean;
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
  lastSolvedDateKey: string | null;
  solvedToday: boolean;
}

export interface DailyChallengeSettings {
  potdEnabled: boolean;
  cp31Enabled: boolean;
  cp31Band: number | null;
  cp31DailyCount: number;
  availableBands: { band: number; count: number }[];
}

export interface DailyChallengeSettingsPatch {
  potdEnabled?: boolean;
  cp31Enabled?: boolean;
  cp31Band?: number | null;
  cp31DailyCount?: number;
}

export interface DailyChallengeSettingsResponse {
  settings: DailyChallengeSettings;
  changes: {
    potdUnsolvedRemoved: number;
    cp31PendingParked: number;
    cp31PendingRemoved?: number;
  };
}

export interface TodoDailyChallenges {
  potd: { enabled: boolean };
}

export interface Cp31StreakResult {
  enabled: boolean;
  currentStreak: number;
  longestStreak: number;
  lastSolvedDateKey: string | null;
  solvedToday: boolean;
  totalSolved: number;
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
  potd?: { dateKey: string; stale: boolean } | null;
  potdStreak?: PotdStreak | null;
  cp31Streak?: Cp31StreakResult | null;
  dailyChallenges?: DailyChallengeMeta;
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

export type PlanSource = 'neetcode150' | 'coderarmy' | 'striver' | 'strivera2z';
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

export type ScheduleMode = 'balanced' | 'sequential';

export interface TopicQuota {
  topic: string;
  count: number;
  all?: boolean;
}

export interface AIDraft {
  source: PlanSource | null;
  startDate: string | null;
  durationDays: number | null;
  pace: PlanPace | null;
  weekdayLoad: number | null;
  weekendLoad: number | null;
  topicQuotas: TopicQuota[] | null;
  focusTopics: string[] | null;
  avoidTopics: string[] | null;
  busyDays: BusyDayInput[] | null;
  bufferDay: number | null;
  scheduleMode?: ScheduleMode | null;
}

export type AIIntent =
  | 'general_chat'
  | 'plan_building'
  | 'request_preview'
  | 'request_commit'
  | 'off_topic';

export type AIAction = 'none' | 'show_draft' | 'offer_preview';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIConversationRequest {
  messages: AIChatMessage[];
  draft: AIDraft;
  timezone?: string;
}

export interface AIConversationResponse {
  reply: string;
  intent: AIIntent;
  action: AIAction;
  draft: AIDraft;
  missingFields: string[];
  done: boolean;
  confidence: 'high' | 'low';
  warnings: string[];
  assumptions: string[];
}

export interface GeneratePlanPayload {
  name?: string;
  source: PlanSource;
  startDate: string;
  durationDays: number;
  pace: PlanPace;
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

export interface Plan {
  id: string;
  name: string;
  source: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived' | 'completed';
  weekdayCapacity?: number;
  weekendCapacity?: number;
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
  originKey?: string;
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
  taskType: 'new' | 'revision' | 'potd';
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

// ─── Todo (Part 2) ───
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
  cp31: Task[];
}

export interface DailyChallengeMeta {
  potd: { enabled: boolean };
  cp31: {
    enabled: boolean;
    band: number | null;
    dailyCount: number;
    solvedInBand: number;
    bandSize: number;
    quotaDoneToday: boolean;
    extrasUsedToday: number;
    extrasCap: number;
    canOneMore?: boolean;
    bandStatus: 'none' | 'active' | 'complete' | 'complete-awaiting-confirm';
    nextIndex?: number | null;
    nextBand?: number | null;
    skippedCount: number;
  };
}

export type TodoData = TodoResponse;

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
  dailyChallenges: DailyChallengeMeta;
}
