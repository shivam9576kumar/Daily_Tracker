export interface HeatmapDay {
  date: string; // YYYY-MM-DD in user tz
  count: number;
}

export interface HeatmapMonth {
  key: string;          // YYYY-MM
  year: number;
  month: number;        // 1-12
  label: string;        // 'Sep'
  daysInMonth: number;
  firstWeekday: number; // 0 = Sunday
  weeks: number;        // grid columns needed
  activeDays: number;
  totalCount: number;
  badge: 'full-month' | null;
  days: HeatmapDay[];   // day 1..today only (never future)
}

export interface HeatmapData {
  tz: string;
  from: string;
  to: string;
  weekStart: 0;
  months: HeatmapMonth[];
  summary: {
    totalCount: number;      // in range
    activeDays: number;      // in range
    bestDay: HeatmapDay | null;
  };
}

export interface StreakResult {
  current: number;
  best: number;
  activeToday: boolean;
  activeDays: number; // all time
}

export type ProgressScope = 'plan' | 'all';

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
  scope: ProgressScope;
  hasActivePlan: boolean;
  planId: string | null;
  planName: string | null;
  topics: TopicProgressItem[];
  difficulty: {
    easy: DifficultyBucket;
    medium: DifficultyBucket;
    hard: DifficultyBucket;
  };
  totals: DifficultyBucket;
}
